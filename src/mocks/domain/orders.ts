/**
 * Pedidos: criação idempotente, revalidação da cotação, snapshot imutável,
 * reserva de estoque e resolução assíncrona (confirmado/recusado) com `order.updated`.
 * Na confirmação, o próprio servidor tira do carrinho do comprador as linhas e
 * quantidades compradas (o cliente não precisa estar em nenhuma página específica).
 *
 * Idempotência (escopo por usuário):
 * - mesma chave + mesmo payload  -> devolve o mesmo pedido (200), mesmo durante a criação;
 * - mesma chave + payload diferente -> 409 IDEMPOTENCY_KEY_REUSED.
 * Pedidos pendentes sobrevivem a reload: a resolução fica em `orderJobs` com horário
 * absoluto e é reagendada ao carregar o módulo.
 */
import type { CreateOrderInput, NetworkId, Order, User } from '@/api/contracts'

import {
  commit,
  getDb,
  idempotencyScope,
  now,
  nowIso,
  onClockChange,
  onDbReset,
  userCartKey,
} from '../db'
import { mockEvents } from '../events'
import { getScenario } from '../scenarios'
import { sha256Hex, stableStringify, uid } from '../utils'
import { consumeItems } from './cart'
import { ApiProblem, problems } from './errors'
import { adjustAvailability } from './nfts'
import { computeQuote, createQuote, hasBlockingIssues } from './quote'

export const DECLINE_REASON = 'Pagamento recusado pela carteira'

const EXPLORERS: Record<NetworkId, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/',
}

const inflight = new Map<string, Promise<Order>>()

export interface CreateOrderResult {
  order: Order
  /** false quando a resposta é uma repetição idempotente. */
  created: boolean
}

export async function createOrder(
  user: User,
  input: CreateOrderInput,
  idempotencyKey: string,
): Promise<CreateOrderResult> {
  const scope = idempotencyScope(user.id, idempotencyKey)
  const payloadHash = await sha256Hex(stableStringify(input))

  // Daqui até registrar o inflight, tudo é síncrono: cliques repetidos não criam dois pedidos.
  const replay = replayIfKnown(scope, payloadHash)
  if (replay) return replay
  const running = inflight.get(scope)
  if (running) {
    await running
    const after = replayIfKnown(scope, payloadHash)
    if (after) return after
  }

  const task = doCreate(user, input, idempotencyKey, scope, payloadHash)
  inflight.set(scope, task)
  try {
    return { order: await task, created: true }
  } finally {
    inflight.delete(scope)
  }
}

function replayIfKnown(scope: string, payloadHash: string): CreateOrderResult | null {
  const db = getDb()
  const record = db.idempotency[scope]
  if (!record) return null
  if (record.payloadHash !== payloadHash) {
    throw new ApiProblem(
      409,
      'IDEMPOTENCY_KEY_REUSED',
      'Esta chave de idempotência já foi usada com outro conteúdo.',
      { meta: { orderId: record.orderId } },
    )
  }
  const order = db.orders[record.orderId]
  if (!order) return null
  return { order, created: false }
}

async function doCreate(
  user: User,
  input: CreateOrderInput,
  idempotencyKey: string,
  scope: string,
  payloadHash: string,
): Promise<Order> {
  const db = getDb()
  const stored = db.quotes[input.quoteId]
  if (!stored || stored.userId !== user.id) {
    throw problems.notFound('Cotação não encontrada. Gere uma nova cotação.')
  }
  const cart = db.carts[userCartKey(user.id)] ?? null
  const quoteInput = { ...stored.input, network: input.network }
  const fresh = await computeQuote(quoteInput, cart)
  const expired = Date.parse(stored.expiresAt) <= now().getTime()

  if (expired || fresh.fingerprint !== input.quoteFingerprint) {
    const quote = await createQuote(quoteInput, { key: stored.ownerKey, userId: user.id }, cart)
    throw new ApiProblem(
      409,
      'QUOTE_STALE',
      expired
        ? 'A cotação expirou. Revise os valores atualizados.'
        : 'Preço, disponibilidade ou taxas mudaram. Revise e confirme novamente.',
      { meta: { quote } },
    )
  }
  if (hasBlockingIssues(fresh)) {
    const quote = await createQuote(quoteInput, { key: stored.ownerKey, userId: user.id }, cart)
    throw new ApiProblem(409, 'OUT_OF_STOCK', 'Há itens sem disponibilidade suficiente.', {
      meta: { quote },
    })
  }

  const wallet = db.wallets[input.walletId]
  if (!wallet || wallet.userId !== user.id) {
    throw problems.validation({ walletId: ['Selecione uma carteira cadastrada.'] })
  }
  // A conexão aprovada em POST /wallets/:id/connect é revalidada aqui: sem ela, não há pedido.
  if (!db.walletConnections[wallet.id]) {
    throw new ApiProblem(
      409,
      'WALLET_NOT_CONNECTED',
      'Conecte a carteira antes de confirmar a compra.',
    )
  }

  const createdAt = nowIso()
  const order: Order = {
    id: uid('ord'),
    userId: user.id,
    status: 'pending',
    snapshot: {
      lines: fresh.lines.map((l) => ({ ...l })),
      subtotalEth: fresh.subtotalEth,
      discountEth: fresh.discountEth,
      networkFeeEth: fresh.networkFeeEth,
      totalEth: fresh.totalEth,
      couponCode: fresh.coupon?.code ?? null,
      network: input.network,
      wallet: { label: wallet.label, address: wallet.address, provider: wallet.provider },
      collector: { ...input.collector },
    },
    txHash: null,
    explorerUrl: null,
    declineReason: null,
    idempotencyKey,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  }

  const scenario = getScenario()
  db.orders[order.id] = order
  db.idempotency[scope] = { payloadHash, orderId: order.id, createdAt }
  db.orderJobs[order.id] = {
    outcome: scenario.orderOutcome,
    resolveAt: new Date(now().getTime() + scenario.orderResolveDelayMs).toISOString(),
  }
  // A cotação é de uso único: outra chave de idempotência não reaproveita o mesmo checkout.
  delete db.quotes[stored.id]
  commit()

  // Reserva o estoque já na criação (emite nft.updated por linha).
  for (const line of order.snapshot.lines)
    adjustAvailability(line.nftId, line.editionId, -line.quantity)
  schedule(order.id)
  return order
}

// Resolução ---------------------------------------------------------------------

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function schedule(orderId: string) {
  const job = getDb().orderJobs[orderId]
  if (!job) return
  const existing = timers.get(orderId)
  if (existing) clearTimeout(existing)
  const delay = Math.max(0, Date.parse(job.resolveAt) - now().getTime())
  timers.set(
    orderId,
    setTimeout(() => {
      timers.delete(orderId)
      void resolveOrder(orderId, job.outcome)
    }, delay),
  )
}

/** Resolve um pedido pendente. Pedidos confirmados/recusados são terminais (sem efeito). */
export async function resolveOrder(
  orderId: string,
  status: 'confirmed' | 'declined',
): Promise<Order | null> {
  const txHash = `0x${await sha256Hex(`tx:${orderId}`)}`
  const db = getDb()
  const order = db.orders[orderId]
  if (!order) return null
  if (order.status !== 'pending') return order

  const timer = timers.get(orderId)
  if (timer) clearTimeout(timer)
  timers.delete(orderId)
  delete db.orderJobs[orderId]

  order.status = status
  if (status === 'confirmed') {
    order.txHash = txHash
    order.explorerUrl = `${EXPLORERS[order.snapshot.network]}${txHash}`
  } else {
    order.declineReason = DECLINE_REASON
  }
  order.updatedAt = nowIso()
  order.version += 1
  commit()

  // Recusa devolve a reserva de estoque e preserva o carrinho; confirmação consome
  // do carrinho só o que foi comprado (bump de `version`) ANTES do evento, para que
  // o refetch disparado por `order.updated` já veja o carrinho atualizado.
  if (status === 'declined') {
    for (const line of order.snapshot.lines)
      adjustAvailability(line.nftId, line.editionId, line.quantity)
  } else {
    consumePurchasedLines(order)
  }

  mockEvents.emit({
    type: 'order.updated',
    eventId: crypto.randomUUID(),
    emittedAt: nowIso(),
    resource: { kind: 'order', id: order.id },
    userId: order.userId,
    version: order.version,
    payload: {
      status: order.status,
      txHash: order.txHash,
      explorerUrl: order.explorerUrl,
      declineReason: order.declineReason,
    },
  })
  return order
}

function consumePurchasedLines(order: Order): void {
  const key = userCartKey(order.userId)
  if (!getDb().carts[key]) return
  consumeItems(
    { key, cartId: `cart_${order.userId}`, userId: order.userId },
    order.snapshot.lines.map((l) => ({
      nftId: l.nftId,
      editionId: l.editionId,
      quantity: l.quantity,
    })),
  )
}

/** Reagenda a resolução de todo pedido pendente (carga do módulo, avanço de relógio). */
export function resumePendingOrders(): void {
  const db = getDb()
  for (const order of Object.values(db.orders)) {
    if (order.status !== 'pending') continue
    db.orderJobs[order.id] ??= { outcome: 'confirmed', resolveAt: nowIso() }
    schedule(order.id)
  }
}

onDbReset(() => {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  inflight.clear()
})
onClockChange(resumePendingOrders)
resumePendingOrders()

// Consultas ---------------------------------------------------------------------

export function listOrders(userId: string): Order[] {
  return Object.values(getDb().orders)
    .filter((o) => o.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function getOrderFor(userId: string, orderId: string): Order {
  const order = getDb().orders[orderId]
  if (!order) throw problems.notFound('Pedido não encontrado.')
  if (order.userId !== userId) throw problems.forbidden('Este pedido pertence a outra conta.')
  return order
}

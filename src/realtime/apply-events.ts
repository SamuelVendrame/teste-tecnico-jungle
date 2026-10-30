/**
 * Aplica eventos Socket.IO ao cache do TanStack Query.
 *
 * Fluxo de cada evento: valida o payload com o contrato (zod) -> filtra por usuário
 * (`order.updated`) -> descarta duplicata/versão antiga (`eventLog`) -> atualiza o
 * cache in-place com `setQueryData`, sempre comparando com a `version` que já está
 * no cache (nunca regride um estado mais novo vindo do REST).
 *
 * Mapa evento -> chaves de query:
 * - `nft.updated`: todo cache sob ['nfts'] (listas, páginas infinitas, detalhe,
 *   destaques, relacionados; o NFT é localizado pelo id dentro dos dados, pois o
 *   detalhe é chaveado por slug), todo ['cart', owner] (snapshot de preço e
 *   disponibilidade da edição + `nft.version` do item) e invalida ['quote'].
 * - `order.updated`: ['orders', userId, 'detail', orderId] e invalida
 *   ['orders', userId, 'list']. Se `confirmed`, invalida também ['cart', userId]
 *   (o servidor já tirou do carrinho os itens comprados) e ['quote'].
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query'

import {
  SOCKET_EVENTS,
  nftUpdatedEvent,
  orderUpdatedEvent,
  type Cart,
  type CartItem,
  type Nft,
  type NftUpdatedEvent,
  type Order,
  type OrderStatus,
  type OrderUpdatedEvent,
} from '@/api/contracts'
import { compareEth, formatEth } from '@/lib/money'
import { queryKeys } from '@/lib/query-keys'

import { eventLog } from './event-log'
import { realtimeNotices } from './notices'

export interface ApplyContext {
  /** Usuário autenticado no momento em que o evento chegou; null sem sessão válida. */
  userId: string | null
}

export type ApplyOutcome = 'applied' | 'ignored' | 'invalid'

const log = (...args: unknown[]) => console.debug('[realtime]', ...args)

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function isNftLike(value: unknown): value is Nft {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    typeof value.version === 'number' &&
    typeof value.priceEth === 'string' &&
    Array.isArray(value.editions)
  )
}

function isCartLike(value: unknown): value is Cart {
  return isPlainObject(value) && Array.isArray(value.items)
}

function isOrderLike(value: unknown): value is Order {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    typeof value.status === 'string' &&
    typeof value.version === 'number'
  )
}

function isTerminal(status: OrderStatus): boolean {
  return status === 'confirmed' || status === 'declined'
}

/**
 * Um fetch em andamento pode ter saído antes da mudança e voltaria com versão
 * antiga, sobrescrevendo o que o evento acabou de aplicar. Reiniciamos esse
 * fetch (invalidate cancela o anterior) para que a resposta aceita pela query
 * seja posterior ao evento.
 */
function restartInFlight(queryClient: QueryClient, queryKey: QueryKey) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
    if (query.state.fetchStatus === 'fetching') {
      void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true })
    }
  }
}

// ---------------------------------------------------------------------------
// nft.updated
// ---------------------------------------------------------------------------

function patchNft(nft: Nft, event: NftUpdatedEvent): Nft {
  const editionsById = new Map(event.payload.editions.map((e) => [e.id, e]))
  return {
    ...nft,
    priceEth: event.payload.priceEth,
    compareAtPriceEth: event.payload.compareAtPriceEth,
    editions: nft.editions.map((edition) => {
      const update = editionsById.get(edition.id)
      return update
        ? { ...edition, priceEth: update.priceEth, available: update.available }
        : edition
    }),
    version: event.version,
  }
}

const MAX_DEPTH = 6

/**
 * Percorre qualquer formato de dado sob ['nfts'] (Nft, Nft[], CatalogPage,
 * InfiniteData<CatalogPage>, FeaturedResponse...) e substitui o NFT do evento.
 * Devolve a MESMA referência quando nada mudou (preserva structural sharing).
 */
function patchNftsDeep(value: unknown, event: NftUpdatedEvent, depth = 0): unknown {
  if (depth > MAX_DEPTH || typeof value !== 'object' || value === null) return value
  if (isNftLike(value)) {
    if (value.id !== event.resource.id || event.version <= value.version) return value
    return patchNft(value, event)
  }
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item: unknown) => {
      const patched = patchNftsDeep(item, event, depth + 1)
      if (patched !== item) changed = true
      return patched
    })
    return changed ? next : value
  }
  if (isPlainObject(value)) {
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const patched = patchNftsDeep(item, event, depth + 1)
      if (patched !== item) changed = true
      next[key] = patched
    }
    return changed ? next : value
  }
  return value
}

interface CartItemChange {
  item: CartItem
  previous: CartItem['edition']
  next: CartItem['edition']
}

function patchCart(
  cart: Cart,
  event: NftUpdatedEvent,
): { cart: Cart; changes: CartItemChange[] } | null {
  const editionsById = new Map(event.payload.editions.map((e) => [e.id, e]))
  const changes: CartItemChange[] = []
  let touched = false

  const items = cart.items.map((item) => {
    if (item.nftId !== event.resource.id || event.version <= item.nft.version) return item
    touched = true
    const update = editionsById.get(item.editionId)
    const edition = update
      ? { ...item.edition, priceEth: update.priceEth, available: update.available }
      : item.edition
    const nextItem: CartItem = { ...item, nft: { ...item.nft, version: event.version }, edition }
    const priceChanged = compareEth(item.edition.priceEth, edition.priceEth) !== 0
    if (priceChanged || item.edition.available !== edition.available) {
      changes.push({ item: nextItem, previous: item.edition, next: edition })
    }
    return nextItem
  })

  return touched ? { cart: { ...cart, items }, changes } : null
}

function availabilityMessage(label: string, available: number, inCart: number): string {
  if (available === 0) return `${label} esgotou e não pode mais ser comprado.`
  if (available < inCart) {
    return `Restam apenas ${available} unidade(s) de ${label}; seu carrinho tem ${inCart}.`
  }
  return `A disponibilidade de ${label} mudou para ${available} unidade(s).`
}

function pushCartNotices(changes: CartItemChange[]) {
  const done = new Set<string>()
  for (const { item, previous, next } of changes) {
    const key = `${item.nftId}:${item.editionId}`
    if (done.has(key)) continue // mesmo item em mais de um carrinho em cache
    done.add(key)
    const label = `${item.nft.name} (${item.edition.name})`

    if (next.available !== previous.available) {
      realtimeNotices.push({
        kind: 'nft-availability',
        message: availabilityMessage(label, next.available, item.quantity),
        nftId: item.nftId,
      })
    }
    // Esgotado: o aviso de disponibilidade já basta; preço deixa de importar.
    if (next.available > 0 && compareEth(previous.priceEth, next.priceEth) !== 0) {
      const from = formatEth(previous.priceEth)
      const to = formatEth(next.priceEth)
      realtimeNotices.push({
        kind: 'nft-price',
        message: `O preço de ${label} mudou de ${from} para ${to}.`,
        nftId: item.nftId,
      })
    }
  }
}

/** Atualiza todos os caches que exibem o NFT. Retorna quantas queries mudaram. */
export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent): number {
  let touched = 0

  for (const [queryKey, data] of queryClient.getQueriesData({ queryKey: queryKeys.nfts.all })) {
    const patched = patchNftsDeep(data, event)
    if (patched === data) continue
    queryClient.setQueryData(queryKey, patched)
    touched += 1
  }

  const cartChanges: CartItemChange[] = []
  for (const [queryKey, data] of queryClient.getQueriesData({ queryKey: ['cart'] })) {
    if (!isCartLike(data)) continue
    const result = patchCart(data, event)
    if (!result) continue
    queryClient.setQueryData<Cart>(queryKey, result.cart)
    cartChanges.push(...result.changes)
    touched += 1
  }
  pushCartNotices(cartChanges)

  restartInFlight(queryClient, queryKeys.nfts.all)
  restartInFlight(queryClient, ['cart'])
  // Uma cotação aberta no checkout precisa ser recalculada pelo servidor.
  void queryClient.invalidateQueries({ queryKey: ['quote'] })
  return touched
}

// ---------------------------------------------------------------------------
// order.updated
// ---------------------------------------------------------------------------

function orderNoticeMessage(event: OrderUpdatedEvent): string {
  const shortId = event.resource.id.slice(-8)
  if (event.payload.status === 'confirmed') {
    return `Pagamento confirmado. O pedido ${shortId} foi concluído.`
  }
  const reason = event.payload.declineReason
  return `Pagamento recusado no pedido ${shortId}${reason ? `: ${reason}` : '.'}`
}

/** Atualiza o detalhe do pedido do usuário atual. Retorna true se o cache mudou. */
export function applyOrderUpdated(
  queryClient: QueryClient,
  event: OrderUpdatedEvent,
  userId: string,
): boolean {
  const detailKey = queryKeys.orders.detail(userId, event.resource.id)
  const cached: unknown = queryClient.getQueryData(detailKey)
  const previousStatus = isOrderLike(cached) ? cached.status : null
  let changed = false

  // Pedidos confirmados ou recusados são terminais: nada os move de volta.
  if (isOrderLike(cached) && event.version > cached.version && !isTerminal(cached.status)) {
    queryClient.setQueryData<Order>(detailKey, {
      ...cached,
      status: event.payload.status,
      txHash: event.payload.txHash,
      explorerUrl: event.payload.explorerUrl,
      declineReason: event.payload.declineReason,
      version: event.version,
      updatedAt: event.emittedAt,
    })
    changed = true
  }

  restartInFlight(queryClient, detailKey)
  void queryClient.invalidateQueries({ queryKey: queryKeys.orders.list(userId) })
  // Confirmação consome os itens comprados no servidor: badge e página do carrinho
  // se atualizam em qualquer rota, sem depender da página do pedido estar aberta.
  if (event.payload.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) })
    void queryClient.invalidateQueries({ queryKey: ['quote'] })
  }

  if (isTerminal(event.payload.status) && previousStatus !== event.payload.status) {
    realtimeNotices.push({
      kind: 'order',
      orderId: event.resource.id,
      message: orderNoticeMessage(event),
    })
  }
  return changed
}

// ---------------------------------------------------------------------------
// Entrada única
// ---------------------------------------------------------------------------

/** Valida, deduplica e aplica um evento recebido do socket. */
export function applyRealtimeEvent(
  queryClient: QueryClient,
  name: string,
  payload: unknown,
  ctx: ApplyContext,
): ApplyOutcome {
  if (name === SOCKET_EVENTS.nftUpdated) {
    const parsed = nftUpdatedEvent.safeParse(payload)
    if (!parsed.success) {
      log('invalid', name, parsed.error.issues)
      return 'invalid'
    }
    const event = parsed.data
    if (!eventLog.shouldApply(event)) {
      log('ignored', event.eventId, 'duplicate or stale version')
      return 'ignored'
    }
    const touched = applyNftUpdated(queryClient, event)
    log('applied', event.eventId, { touched })
    return 'applied'
  }

  if (name === SOCKET_EVENTS.orderUpdated) {
    const parsed = orderUpdatedEvent.safeParse(payload)
    if (!parsed.success) {
      log('invalid', name, parsed.error.issues)
      return 'invalid'
    }
    const event = parsed.data
    // Evento de outra sessão/usuário nunca toca o cache atual.
    if (ctx.userId === null || event.userId !== ctx.userId) {
      log('ignored', event.eventId, 'other user')
      return 'ignored'
    }
    if (!eventLog.shouldApply(event)) {
      log('ignored', event.eventId, 'duplicate or stale version')
      return 'ignored'
    }
    const changed = applyOrderUpdated(queryClient, event, ctx.userId)
    log('applied', event.eventId, { changed })
    return 'applied'
  }

  return 'ignored'
}

/**
 * Após uma reconexão podemos ter perdido eventos: reconcilia com o REST tudo
 * que está sendo exibido (queries inativas ficam stale e refazem ao montar).
 */
export function reconcileAfterReconnect(queryClient: QueryClient): void {
  for (const root of ['nfts', 'cart', 'orders', 'quote'] as const) {
    void queryClient.invalidateQueries({ queryKey: [root], refetchType: 'active' })
  }
}

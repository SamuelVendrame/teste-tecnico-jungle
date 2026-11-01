/**
 * Smoke test da API simulada, fora do navegador.
 * Executa os handlers MSW reais via `getResponse` (rotas, cenário, validação, domínio).
 *
 *   npx tsx src/mocks/__smoke__.ts
 *
 * Fluxo: cadastro -> login -> carteira -> carrinho -> cotação -> pedido (mesma
 * Idempotency-Key duas vezes = mesmo pedido) -> chave reaproveitada com outro payload (409)
 * -> isolamento entre usuários (403) -> confirmação via order.updated.
 * Lança erro (exit != 0) na primeira divergência.
 */
import type { Cart, Order, Quote, Session, Wallet } from '@/api/contracts'

import type { DomainEvent as DomainEventLike } from './events'

// MSW resolve caminhos relativos ('/api/...') contra `location`. Em Node não existe.
const g = globalThis as unknown as { location?: { href: string; origin: string } }
g.location ??= { href: 'http://localhost/', origin: 'http://localhost' }

const { getResponse } = await import('msw')
const { handlers } = await import('./handlers')
const { mockEvents } = await import('./events')
const { getDb } = await import('./db')

const ORIGIN = 'http://localhost'
const events: DomainEventLike[] = []
mockEvents.subscribe((e) => events.push(e))

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FALHOU: ${message}`)
}

async function call<T>(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const response = await getResponse(handlers, request)
  assert(response, `sem handler para ${method} ${path}`)
  const text = await response.text()
  const body = (text ? JSON.parse(text) : null) as T
  console.log(`  ${method.padEnd(6)} ${path.padEnd(34)} -> ${response.status}`)
  return { status: response.status, body }
}

const started = Date.now()
console.log('Smoke da API simulada')

const register = await call<Session>('POST', '/api/auth/register', {
  body: { name: 'Carla Smoke', email: 'carla@kurio.dev', password: 'Senha123' },
})
assert(register.status === 201, 'cadastro deve responder 201')
const dup = await call<{ error: { code: string } }>('POST', '/api/auth/register', {
  body: { name: 'Carla Smoke', email: 'CARLA@kurio.dev', password: 'Senha123' },
})
assert(dup.status === 409 && dup.body.error.code === 'EMAIL_TAKEN', 'e-mail repetido deve dar 409')

const login = await call<Session>('POST', '/api/auth/login', {
  body: { email: 'carla@kurio.dev', password: 'Senha123' },
})
assert(login.status === 200, 'login deve responder 200')
const token = login.body.token
const stored = Object.values(getDb().passwordHashes)
assert(!stored.includes('Senha123'), 'senha não pode ficar em claro')

const wallet = await call<Wallet>('POST', '/api/wallets', {
  token,
  body: {
    kind: 'primary',
    label: 'Minha MetaMask',
    address: '0x1111111111111111111111111111111111111111',
    network: 'ethereum',
    provider: 'metamask',
    displayName: 'Carla Smoke',
    profileName: 'Carla S.',
    secondaryRef: '',
    referralCode: 'SMOKE-01',
    email: 'carla@kurio.dev',
    ensSuffix: '.eth',
    ensName: 'carlasmoke',
  },
})
assert(wallet.status === 201, 'carteira deve ser criada')

const before = getDb().nfts['nft_001']?.editions[0]?.available ?? -1
const cart = await call<Cart>('POST', '/api/cart/items', {
  token,
  body: { nftId: 'nft_001', editionId: 'nft_001-ed1', quantity: 2 },
})
assert(cart.status === 200 && cart.body.items[0]?.quantity === 2, 'item deve entrar no carrinho')

const quote = await call<Quote>('POST', '/api/checkout/quote', {
  token,
  body: {
    items: [{ nftId: 'nft_001', editionId: 'nft_001-ed1', quantity: 2 }],
    couponCode: 'KURIO10',
    network: 'ethereum',
  },
})
assert(quote.status === 200, 'cotação deve responder 200')
console.log(
  `  cotação: subtotal ${quote.body.subtotalEth} - desconto ${quote.body.discountEth} + taxa ${quote.body.networkFeeEth} = ${quote.body.totalEth}`,
)
assert(quote.body.subtotalEth === '2.38', 'subtotal 2 x 1.19 = 2.38')
assert(quote.body.totalEth === '2.1441', 'total 2.38 - 0.238 + 0.0021 = 2.1441')

const orderBody = {
  quoteId: quote.body.id,
  quoteFingerprint: quote.body.fingerprint,
  walletId: wallet.body.id,
  network: 'ethereum',
  collector: {
    displayName: 'Carla Smoke',
    username: 'carla_smoke',
    profileName: 'Carla S.',
    secondaryRef: '',
    referralCode: 'SMOKE-01',
    email: 'carla@kurio.dev',
    ensSuffix: '.eth',
    ensName: 'carlasmoke',
    note: '',
  },
}
const key = 'smoke-key-0001'
const [first, second] = await Promise.all([
  call<Order>('POST', '/api/orders', {
    token,
    body: orderBody,
    headers: { 'Idempotency-Key': key },
  }),
  call<Order>('POST', '/api/orders', {
    token,
    body: orderBody,
    headers: { 'Idempotency-Key': key },
  }),
])
assert(
  first.body.id && first.body.id === second.body.id,
  'mesma chave deve devolver o mesmo pedido',
)
assert(
  [first.status, second.status].sort().join() === '200,201',
  'um 201 (criação) e um 200 (repetição)',
)
const retry = await call<Order>('POST', '/api/orders', {
  token,
  body: orderBody,
  headers: { 'Idempotency-Key': key },
})
assert(retry.status === 200 && retry.body.id === first.body.id, 'reenvio devolve o mesmo pedido')
assert(Object.keys(getDb().orders).length === 2, 'apenas um pedido novo (mais o do seed)')

const reused = await call<{ error: { code: string } }>('POST', '/api/orders', {
  token,
  body: { ...orderBody, network: 'polygon' },
  headers: { 'Idempotency-Key': key },
})
assert(
  reused.status === 409 && reused.body.error.code === 'IDEMPOTENCY_KEY_REUSED',
  'chave reaproveitada = 409',
)

const after = getDb().nfts['nft_001']?.editions[0]?.available ?? -1
assert(after === before - 2, `estoque reservado (${before} -> ${after})`)

const bruno = await call<Session>('POST', '/api/auth/login', {
  body: { email: 'bruno@kurio.dev', password: 'Senha123' },
})
const foreign = await call<unknown>('GET', `/api/orders/${first.body.id}`, {
  token: bruno.body.token,
})
assert(foreign.status === 403, 'pedido de outro usuário deve dar 403')

console.log('  aguardando resolução do pagamento (2,5 s)...')
await new Promise((r) => setTimeout(r, 2700))
const final = await call<Order>('GET', `/api/orders/${first.body.id}`, { token })
assert(final.body.status === 'confirmed', 'pedido deve ser confirmado')
assert(/^0x[0-9a-f]{64}$/.test(final.body.txHash ?? ''), 'txHash 0x + 64 hex')
assert(final.body.version === 2, 'versão do pedido incrementada')

const nftEvents = events.filter((e) => e.type === 'nft.updated')
const orderEvents = events.filter((e) => e.type === 'order.updated')
assert(nftEvents.length >= 1, 'nft.updated emitido na reserva')
assert(orderEvents.length === 1 && orderEvents[0]?.version === 2, 'order.updated com versão 2')
assert(new Set(events.map((e) => e.eventId)).size === events.length, 'eventIds únicos')

console.log(
  `OK: pedido ${first.body.id} confirmado (${final.body.explorerUrl}); ` +
    `${nftEvents.length} nft.updated, ${orderEvents.length} order.updated; ${Date.now() - started} ms`,
)

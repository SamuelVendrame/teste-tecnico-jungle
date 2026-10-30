/**
 * Motor de cenários da API simulada.
 *
 * O cenário ativo é lido a cada requisição (troca sem reload) e persistido em
 * localStorage (`kurio:scenario`). Flags de "disparo único" (sessão expirada,
 * mudança de preço, esgotamento) ficam em `kurio:scenario-runtime`, para que um
 * reload não as dispare de novo. Latências usam PRNG com semente fixa, reiniciado
 * a cada troca de cenário: a mesma sequência de requisições gera os mesmos atrasos.
 */
import { resetDb } from './db'
import { STORAGE_KEYS, readJson, readRaw, writeJson, writeRaw } from './persistence'
import { createPrng, type Prng } from './utils'

export type ScenarioName =
  | 'default'
  | 'slow'
  | 'flaky'
  | 'offline'
  | 'empty-catalog'
  | 'session-expired'
  | 'order-declined'
  | 'order-timeout'
  | 'price-change'
  | 'coupon-expired'
  | 'out-of-order'
  | 'sold-out'

export interface Scenario {
  name: ScenarioName
  label: string
  description: string
  latency: { min: number; max: number }
  /** Toda requisição /api falha como erro de rede (HttpResponse.error()). */
  offline: boolean
  /** A cada N requisições aos prefixos, responde 503 SERVICE_UNAVAILABLE. */
  flaky: { every: number; prefixes: string[] } | null
  /** Listagem, destaques e relacionados voltam vazios. */
  emptyCatalog: boolean
  /** A primeira requisição autenticada após ativar o cenário recebe 401 e a sessão é invalidada. */
  expireSessionOnce: boolean
  /** Resultado da simulação de pagamento. */
  orderOutcome: 'confirmed' | 'declined'
  /** Tempo até o pedido pendente ser resolvido. */
  orderResolveDelayMs: number
  /** Atraso extra da resposta HTTP de criação de pedido (o pedido já existe). */
  orderResponseDelayMs: number
  /** Após criar uma cotação, reajusta o preço da 1ª linha. Dispara uma vez por ativação. */
  priceChangeAfterQuote: { afterMs: number; percent: number } | null
  /** Após criar uma cotação, esgota a edição da 1ª linha. Dispara uma vez por ativação. */
  soldOutAfterQuote: { afterMs: number } | null
  /** Todo cupom responde COUPON_EXPIRED. */
  couponsExpired: boolean
  /** Alterna atrasos longos/curtos na listagem do catálogo para forçar respostas fora de ordem. */
  outOfOrderCatalog: boolean
}

const BASE: Omit<Scenario, 'name' | 'label' | 'description'> = {
  latency: { min: 150, max: 450 },
  offline: false,
  flaky: null,
  emptyCatalog: false,
  expireSessionOnce: false,
  orderOutcome: 'confirmed',
  orderResolveDelayMs: 2500,
  orderResponseDelayMs: 0,
  priceChangeAfterQuote: null,
  soldOutAfterQuote: null,
  couponsExpired: false,
  outOfOrderCatalog: false,
}

function preset(
  name: ScenarioName,
  label: string,
  description: string,
  overrides: Partial<Scenario> = {},
): Scenario {
  return { ...BASE, ...overrides, name, label, description }
}

export const SCENARIO_PRESETS: Record<ScenarioName, Scenario> = {
  default: preset('default', 'Padrão', 'Latência 150–450 ms, pagamento confirmado em 2,5 s.'),
  slow: preset('slow', 'Rede lenta', 'Toda requisição leva 1,5–3 s (skeletons visíveis).', {
    latency: { min: 1500, max: 3000 },
  }),
  flaky: preset(
    'flaky',
    'Instável',
    'A cada 3 requisições a /api/nfts* e /api/cart*, uma responde 503 SERVICE_UNAVAILABLE.',
    { flaky: { every: 3, prefixes: ['/api/nfts', '/api/cart'] } },
  ),
  offline: preset('offline', 'Sem conexão', 'Toda requisição /api falha como erro de rede.', {
    offline: true,
  }),
  'empty-catalog': preset(
    'empty-catalog',
    'Catálogo vazio',
    'Listagem, destaques e relacionados retornam zero itens.',
    { emptyCatalog: true },
  ),
  'session-expired': preset(
    'session-expired',
    'Sessão expirada',
    'A primeira requisição autenticada após ativar o cenário recebe 401 e a sessão é invalidada.',
    { expireSessionOnce: true },
  ),
  'order-declined': preset(
    'order-declined',
    'Pagamento recusado',
    'Pedidos são recusados após 2,5 s e a disponibilidade é devolvida.',
    { orderOutcome: 'declined' },
  ),
  'order-timeout': preset(
    'order-timeout',
    'Timeout no pedido',
    'POST /orders cria o pedido mas só responde após 12 s (cliente desiste em 8 s). ' +
      'Reenvio com a mesma Idempotency-Key devolve o mesmo pedido na hora.',
    { orderResponseDelayMs: 12_000 },
  ),
  'price-change': preset(
    'price-change',
    'Preço alterado',
    '10 s após a primeira cotação, o preço da 1ª linha sobe 15% (nft.updated) e o pedido ' +
      'seguinte recebe QUOTE_STALE.',
    { priceChangeAfterQuote: { afterMs: 10_000, percent: 15 } },
  ),
  'coupon-expired': preset(
    'coupon-expired',
    'Cupom expirado',
    'Qualquer cupom responde 422 COUPON_EXPIRED.',
    { couponsExpired: true },
  ),
  'out-of-order': preset(
    'out-of-order',
    'Fora de ordem',
    'Latência 100–2500 ms por requisição; listagens do catálogo alternam lenta/rápida para que ' +
      'uma requisição antiga responda depois da mais nova.',
    { latency: { min: 100, max: 2500 }, outOfOrderCatalog: true },
  ),
  'sold-out': preset(
    'sold-out',
    'Edição esgotada',
    '3 s após a primeira cotação, a edição da 1ª linha fica com disponibilidade 0 (nft.updated).',
    { soldOutAfterQuote: { afterMs: 3_000 } },
  ),
}

export const SCENARIO_NAMES = Object.keys(SCENARIO_PRESETS) as ScenarioName[]

export function isScenarioName(value: unknown): value is ScenarioName {
  return typeof value === 'string' && value in SCENARIO_PRESETS
}

// Estado de execução -----------------------------------------------------------

interface ScenarioRuntime {
  /** Cenário que armou as flags (flags de outro cenário são ignoradas). */
  armedFor: ScenarioName
  sessionExpiryArmed: boolean
  priceChangeArmed: boolean
  soldOutArmed: boolean
}

const PRNG_SEED = 424242

function armedRuntime(name: ScenarioName): ScenarioRuntime {
  const s = SCENARIO_PRESETS[name]
  return {
    armedFor: name,
    sessionExpiryArmed: s.expireSessionOnce,
    priceChangeArmed: s.priceChangeAfterQuote !== null,
    soldOutArmed: s.soldOutAfterQuote !== null,
  }
}

function loadName(): ScenarioName {
  const raw = readRaw(STORAGE_KEYS.scenario)
  return isScenarioName(raw) ? raw : 'default'
}

let currentName: ScenarioName = loadName()
let runtime: ScenarioRuntime = (() => {
  const persisted = readJson<ScenarioRuntime>(STORAGE_KEYS.scenarioRuntime)
  return persisted && persisted.armedFor === currentName ? persisted : armedRuntime(currentName)
})()
let prng: Prng = createPrng(PRNG_SEED)
let requestCounters = new Map<string, number>()
let catalogListSeq = 0

function persistRuntime() {
  writeJson(STORAGE_KEYS.scenarioRuntime, runtime)
}

export function getScenario(): Scenario {
  return SCENARIO_PRESETS[currentName]
}

export function setScenario(name: ScenarioName): void {
  if (!isScenarioName(name)) throw new Error(`Cenário desconhecido: ${String(name)}`)
  currentName = name
  writeRaw(STORAGE_KEYS.scenario, name)
  runtime = armedRuntime(name)
  persistRuntime()
  prng = createPrng(PRNG_SEED)
  requestCounters = new Map()
  catalogListSeq = 0
  injectedFailures = []
}

/** Restaura o seed completo: banco (inclui sessões e carrinhos), cenário e flags. */
export function resetMockDb(): void {
  resetDb()
  setScenario('default')
}

/**
 * Lê `?scenario=<nome>` e `?reset=1` da URL atual. Seguro antes de o worker iniciar
 * (só mexe em localStorage/memória). Remove os parâmetros da URL para que um refresh
 * não repita o reset.
 */
export function applyScenarioFromUrl(): void {
  if (typeof location === 'undefined') return
  const params = new URLSearchParams(location.search)
  const reset = params.get('reset')
  const scenario = params.get('scenario')
  if (reset === '1' || reset === 'true') resetMockDb()
  if (isScenarioName(scenario)) setScenario(scenario)
  else if (scenario !== null) console.warn(`[mocks] cenário desconhecido: ${scenario}`)

  if ((reset !== null || scenario !== null) && typeof history !== 'undefined') {
    params.delete('reset')
    params.delete('scenario')
    const search = params.toString()
    const url = `${location.pathname}${search ? `?${search}` : ''}${location.hash}`
    history.replaceState(history.state, '', url)
  }
}

// Consultas usadas pelos handlers ------------------------------------------------

/** Atraso da requisição conforme o cenário (PRNG com semente: reproduzível). */
export function nextLatency(pathname: string, method: string): number {
  const s = getScenario()
  if (s.outOfOrderCatalog && method === 'GET' && pathname === '/api/nfts') {
    // Ímpares lentas, pares rápidas: a 1ª busca termina depois da 2ª.
    catalogListSeq += 1
    return catalogListSeq % 2 === 1 ? prng.int(1800, 2500) : prng.int(100, 400)
  }
  return prng.int(s.latency.min, s.latency.max)
}

/** true quando esta requisição deve falhar com 503 no cenário "flaky". */
export function shouldFailFlaky(pathname: string): boolean {
  const flaky = getScenario().flaky
  if (!flaky) return false
  const prefix = flaky.prefixes.find((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (!prefix) return false
  const count = (requestCounters.get(prefix) ?? 0) + 1
  requestCounters.set(prefix, count)
  return count % flaky.every === 0
}

/** Consome a flag de sessão expirada. Devolve true uma única vez por ativação. */
export function consumeSessionExpiry(): boolean {
  if (!getScenario().expireSessionOnce || !runtime.sessionExpiryArmed) return false
  runtime = { ...runtime, sessionExpiryArmed: false }
  persistRuntime()
  return true
}

export function isPriceChangeArmed(): boolean {
  return getScenario().priceChangeAfterQuote !== null && runtime.priceChangeArmed
}

export function disarmPriceChange(): void {
  runtime = { ...runtime, priceChangeArmed: false }
  persistRuntime()
}

export function isSoldOutArmed(): boolean {
  return getScenario().soldOutAfterQuote !== null && runtime.soldOutArmed
}

export function disarmSoldOut(): void {
  runtime = { ...runtime, soldOutArmed: false }
  persistRuntime()
}

export function scenarioRuntimeSnapshot() {
  return { ...runtime }
}

// Falhas injetadas (one-shot) -----------------------------------------------------

export interface InjectedFailure {
  /** Método HTTP (GET, POST...) ou '*' para qualquer. */
  method: string
  /** Caminho exato (`/api/favorites/nft_001`) ou prefixo terminado em `*` (`/api/favorites*`). */
  path: string
  status: number
  code: string
  message: string
  /** Quantas requisições ainda vão falhar. */
  remaining: number
}

let injectedFailures: InjectedFailure[] = []

export function injectFailure(rule: InjectedFailure): void {
  injectedFailures.push(rule)
}

export function clearInjectedFailures(): void {
  injectedFailures = []
}

export function listInjectedFailures(): InjectedFailure[] {
  return injectedFailures.map((r) => ({ ...r }))
}

/** Consome a primeira regra que casa com a requisição, se houver. */
export function takeInjectedFailure(method: string, pathname: string): InjectedFailure | null {
  const rule = injectedFailures.find((r) => {
    const methodOk = r.method === '*' || r.method.toUpperCase() === method.toUpperCase()
    const pathOk = r.path.endsWith('*')
      ? pathname.startsWith(r.path.slice(0, -1))
      : pathname === r.path
    return methodOk && pathOk && r.remaining > 0
  })
  if (!rule) return null
  rule.remaining -= 1
  injectedFailures = injectedFailures.filter((r) => r.remaining > 0)
  return { ...rule }
}

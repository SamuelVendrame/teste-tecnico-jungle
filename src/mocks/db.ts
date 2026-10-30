/**
 * Banco em memória da API simulada.
 *
 * - Objetos simples, serializáveis em JSON, persistidos inteiros em localStorage
 *   (`kurio:mockdb`) com versão de schema. Fora do navegador a persistência é no-op.
 * - Todo recurso mutável carrega `version` (inteiro) incrementado a cada mudança.
 * - Datas são strings ISO. O relógio da API é `now()`: tempo real + deslocamento
 *   controlável por `POST /__mock/clock/advance` (útil para expirar sessão/cotação).
 * - Os handlers alteram `getDb()` e chamam `commit()` para persistir.
 */
import type { Nft, NetworkId, Order, QuoteInput, User, Wallet } from '@/api/contracts'

import { createSeed } from './fixtures'
import {
  DB_SCHEMA_VERSION,
  STORAGE_KEYS,
  onExternalChange,
  readJson,
  writeJson,
} from './persistence'

export interface DbSession {
  userId: string
  createdAt: string
  expiresAt: string
}

export interface DbCartItem {
  /** Determinístico por NFT + edição: o mesmo par nunca gera duas linhas. */
  id: string
  nftId: string
  editionId: string
  quantity: number
  /** Preço da edição quando o item foi adicionado/alterado. Base do aviso `price-changed`. */
  snapshotPriceEth: string
  addedAt: string
}

export interface DbCart {
  id: string
  userId: string | null
  items: DbCartItem[]
  couponCode: string | null
  updatedAt: string
  version: number
}

export interface DbCoupon {
  code: string
  description: string
  percentOff: number | null
  amountOffEth: string | null
  minSubtotalEth: string | null
  expiresAt: string | null
}

export interface DbQuote {
  id: string
  /** Dono da cotação: `user:<id>` ou `guest:<cartId>`. */
  ownerKey: string
  userId: string | null
  input: QuoteInput
  fingerprint: string
  createdAt: string
  expiresAt: string
}

export interface DbIdempotencyRecord {
  payloadHash: string
  orderId: string
  createdAt: string
}

export interface DbOrderJob {
  outcome: 'confirmed' | 'declined'
  resolveAt: string
}

export interface DbFavorites {
  nftIds: string[]
  version: number
}

export interface MockDb {
  meta: {
    schemaVersion: number
    seedClock: string
    clockOffsetMs: number
    spotlightNftId: string | null
  }
  users: Record<string, User>
  /** userId -> SHA-256 hex de `userId:senha`. */
  passwordHashes: Record<string, string>
  /** token -> sessão. */
  sessions: Record<string, DbSession>
  /** id -> NFT. A ordem de inserção é a ordem do seed. */
  nfts: Record<string, Nft>
  /** userId -> favoritos. */
  favorites: Record<string, DbFavorites>
  /** ownerKey (`user:<id>` | `guest:<cartId>`) -> carrinho. */
  carts: Record<string, DbCart>
  /** código em maiúsculas -> cupom. */
  coupons: Record<string, DbCoupon>
  quotes: Record<string, DbQuote>
  orders: Record<string, Order>
  /** orderId -> resolução agendada de pedido pendente. */
  orderJobs: Record<string, DbOrderJob>
  /** `${userId}:${idempotencyKey}` -> registro. Escopo por usuário: chaves nunca vazam entre contas. */
  idempotency: Record<string, DbIdempotencyRecord>
  wallets: Record<string, Wallet>
  networkFees: Record<NetworkId, string>
}

interface PersistedDb {
  schemaVersion: number
  data: MockDb
}

type Hook = () => void

const replacedHooks = new Set<Hook>()

function load(): MockDb {
  const persisted = readJson<PersistedDb>(STORAGE_KEYS.db)
  if (persisted && persisted.schemaVersion === DB_SCHEMA_VERSION && persisted.data?.meta) {
    return persisted.data
  }
  const seed = createSeed()
  writeJson(STORAGE_KEYS.db, { schemaVersion: DB_SCHEMA_VERSION, data: seed })
  return seed
}

let state: MockDb = load()

// Outra aba gravou o banco: adota a versão mais recente para não sobrescrevê-la.
onExternalChange(STORAGE_KEYS.db, (raw) => {
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as PersistedDb
    if (parsed.schemaVersion === DB_SCHEMA_VERSION) state = parsed.data
  } catch {
    // conteúdo inválido: mantém o estado atual
  }
})

export function getDb(): MockDb {
  return state
}

/** Persiste o banco inteiro. Chame após cada mutação. */
export function commit(): void {
  writeJson(STORAGE_KEYS.db, { schemaVersion: DB_SCHEMA_VERSION, data: state })
}

/** Restaura o seed (determinístico) e avisa os módulos que guardam timers. */
export function resetDb(): void {
  state = createSeed()
  commit()
  for (const hook of replacedHooks) hook()
}

/** Registra um callback chamado sempre que o banco é substituído por um reset. */
export function onDbReset(hook: Hook): () => void {
  replacedHooks.add(hook)
  return () => replacedHooks.delete(hook)
}

// Relógio ---------------------------------------------------------------------

const clockHooks = new Set<Hook>()

export function now(): Date {
  return new Date(Date.now() + state.meta.clockOffsetMs)
}

export function nowIso(): string {
  return now().toISOString()
}

export function advanceClock(ms: number): void {
  state.meta.clockOffsetMs += ms
  commit()
  for (const hook of clockHooks) hook()
}

export function onClockChange(hook: Hook): () => void {
  clockHooks.add(hook)
  return () => clockHooks.delete(hook)
}

// Helpers de chave ----------------------------------------------------------

export function userCartKey(userId: string): string {
  return `user:${userId}`
}

export function guestCartKey(cartId: string): string {
  return `guest:${cartId}`
}

export function idempotencyScope(userId: string, key: string): string {
  return `${userId}:${key}`
}

export function dbCounts() {
  const s = state
  return {
    users: Object.keys(s.users).length,
    sessions: Object.keys(s.sessions).length,
    nfts: Object.keys(s.nfts).length,
    carts: Object.keys(s.carts).length,
    quotes: Object.keys(s.quotes).length,
    orders: Object.keys(s.orders).length,
    pendingOrders: Object.values(s.orders).filter((o) => o.status === 'pending').length,
    wallets: Object.keys(s.wallets).length,
    favorites: Object.values(s.favorites).reduce((n, f) => n + f.nftIds.length, 0),
    coupons: Object.keys(s.coupons).length,
  }
}

/** Dono de um token de sessão válido (não expirado), ou null. Usado também pelo socket simulado. */
export function getUserIdByToken(token: string | null | undefined): string | null {
  if (!token) return null
  const session = state.sessions[token]
  if (!session || Date.parse(session.expiresAt) <= now().getTime()) return null
  return session.userId
}

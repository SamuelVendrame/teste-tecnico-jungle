/**
 * Sessões e identidade. Tokens opacos (Bearer) com expiração de 2 h no relógio da API.
 */
import { HEADERS, type Session, type User } from '@/api/contracts'

import { commit, getDb, now, type DbSession } from '../db'
import { consumeSessionExpiry } from '../scenarios'
import { uid } from '../utils'
import { problems } from './errors'

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000

export function bearerToken(request: Request): string | null {
  const header = request.headers.get(HEADERS.authorization)
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

export function createSession(userId: string): Session {
  const db = getDb()
  const user = db.users[userId]
  if (!user) throw problems.notFound('Usuário não encontrado.')
  const token = uid('tok')
  const created = now()
  const session: DbSession = {
    userId,
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + SESSION_TTL_MS).toISOString(),
  }
  db.sessions[token] = session
  commit()
  return { user, token, expiresAt: session.expiresAt }
}

export interface AuthContext {
  user: User
  token: string
  session: DbSession
}

/**
 * Resolve o usuário do header Authorization.
 * - Sem token: null (rota decide se é pública).
 * - Token desconhecido/expirado: 401 (o cliente marca a sessão como expirada).
 * - Cenário `session-expired`: a primeira requisição autenticada derruba a sessão.
 */
/**
 * Encerra a sessão e desfaz as conexões de carteira da conta: sem sessão, nenhuma
 * carteira continua "conectada" no servidor simulado (expiração, cenário ou logout).
 */
function dropSession(token: string): void {
  const db = getDb()
  const session = db.sessions[token]
  if (!session) return
  for (const wallet of Object.values(db.wallets)) {
    if (wallet.userId === session.userId) delete db.walletConnections[wallet.id]
  }
  delete db.sessions[token]
  commit()
}

export function optionalAuth(request: Request): AuthContext | null {
  const token = bearerToken(request)
  if (!token) return null
  const db = getDb()
  const session = db.sessions[token]
  if (!session) throw problems.unauthorized()
  if (Date.parse(session.expiresAt) <= now().getTime()) {
    dropSession(token)
    throw problems.unauthorized('Sua sessão expirou. Entre novamente.')
  }
  if (consumeSessionExpiry()) {
    dropSession(token)
    throw problems.unauthorized('Sua sessão expirou. Entre novamente.')
  }
  const user = db.users[session.userId]
  if (!user) throw problems.unauthorized()
  return { user, token, session }
}

export function requireAuth(request: Request): AuthContext {
  const auth = optionalAuth(request)
  if (!auth) throw problems.unauthorized('Entre na sua conta para continuar.')
  return auth
}

export function revokeSession(token: string): boolean {
  if (!getDb().sessions[token]) return false
  dropSession(token)
  return true
}

/** Expira (sem apagar) a sessão, para simular expiração natural. */
export function expireSession(token: string): boolean {
  const session = getDb().sessions[token]
  if (!session) return false
  session.expiresAt = new Date(now().getTime() - 1000).toISOString()
  commit()
  return true
}

/** Gera um username único a partir do e-mail (regra do contrato: [a-z0-9_], 3–24). */
export function deriveUsername(email: string): string {
  const users = Object.values(getDb().users)
  const base =
    (email.split('@')[0] ?? 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 18) || 'user'
  const padded = base.length < 3 ? `${base}_kurio` : base
  let candidate = padded
  let n = 2
  while (users.some((u) => u.username === candidate)) {
    candidate = `${padded}_${n}`
    n += 1
  }
  return candidate
}

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase()
  return Object.values(getDb().users).find((u) => u.email.toLowerCase() === normalized)
}

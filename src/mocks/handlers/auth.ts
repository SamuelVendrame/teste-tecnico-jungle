/**
 * Sessão e conta: cadastro, login, consulta da sessão e logout.
 */
import { loginInput, registerInput, type Session, type User } from '@/api/contracts'

import { commit, getDb, nowIso } from '../db'
import {
  bearerToken,
  createSession,
  deriveUsername,
  findUserByEmail,
  requireAuth,
  revokeSession,
} from '../domain/auth'
import { ApiProblem } from '../domain/errors'
import { hashPassword, uid } from '../utils'
import { json, noContent, parseBody, route } from './http'

export const authHandlers = [
  route('post', '/auth/register', async ({ request }) => {
    const input = await parseBody(request, registerInput)
    if (findUserByEmail(input.email)) {
      throw new ApiProblem(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', {
        details: { email: ['Este e-mail já está cadastrado.'] },
      })
    }
    const db = getDb()
    const id = uid('usr')
    const user: User = {
      id,
      name: input.name,
      username: deriveUsername(input.email),
      email: input.email.toLowerCase(),
      bio: null,
      avatarUrl: null,
      createdAt: nowIso(),
      version: 1,
    }
    db.users[id] = user
    db.passwordHashes[id] = await hashPassword(id, input.password)
    db.favorites[id] = { nftIds: [], version: 1 }
    commit()
    return json<Session>(createSession(id), 201)
  }),

  route('post', '/auth/login', async ({ request }) => {
    const input = await parseBody(request, loginInput)
    const user = findUserByEmail(input.email)
    const hash = user ? await hashPassword(user.id, input.password) : null
    if (!user || hash !== getDb().passwordHashes[user.id]) {
      throw new ApiProblem(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    }
    return json<Session>(createSession(user.id))
  }),

  route('get', '/auth/session', ({ request }) => {
    const { user, token, session } = requireAuth(request)
    return json<Session>({ user, token, expiresAt: session.expiresAt })
  }),

  route('post', '/auth/logout', ({ request }) => {
    const token = bearerToken(request)
    const session = token ? getDb().sessions[token] : undefined
    if (session) {
      // Nenhuma carteira da conta continua "conectada" depois de sair.
      const db = getDb()
      for (const wallet of Object.values(db.wallets)) {
        if (wallet.userId === session.userId) delete db.walletConnections[wallet.id]
      }
      commit()
    }
    if (token) revokeSession(token)
    return noContent()
  }),
]

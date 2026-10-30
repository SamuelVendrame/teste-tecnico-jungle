/**
 * Perfil e carteiras (privados).
 * - Username único: 422 VALIDATION_ERROR com details.username.
 * - Senha atual errada: 422 VALIDATION_ERROR com details.currentPassword.
 * - No máximo uma carteira `primary` e uma `secondary` por usuário: 409 WALLET_LIMIT.
 */
import { z } from 'zod'

import {
  changePasswordInput,
  updateProfileInput,
  walletInput,
  type User,
  type Wallet,
} from '@/api/contracts'

import { commit, getDb, nowIso } from '../db'
import { requireAuth } from '../domain/auth'
import { ApiProblem, problems } from '../domain/errors'
import { hashPassword, uid } from '../utils'
import { json, noContent, param, parseBody, route } from './http'

/** Data URL de avatar até ~1 MB, para caber no localStorage da simulação. */
const MAX_AVATAR_LENGTH = 1_000_000

const passwordChangeInput = z.object({
  currentPassword: changePasswordInput.shape.currentPassword,
  newPassword: changePasswordInput.shape.newPassword,
})

function walletsOf(userId: string): Wallet[] {
  return Object.values(getDb().wallets)
    .filter((w) => w.userId === userId)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'primary' ? -1 : 1))
}

function walletLimit(kind: Wallet['kind']) {
  const label = kind === 'primary' ? 'principal' : 'secundária'
  return new ApiProblem(409, 'WALLET_LIMIT', `Você já tem uma carteira ${label}.`, {
    details: { kind: [`Você já tem uma carteira ${label}.`] },
  })
}

export const accountHandlers = [
  route('get', '/me', ({ request }) => json<User>(requireAuth(request).user)),

  route('patch', '/me', async ({ request }) => {
    const { user } = requireAuth(request)
    const input = await parseBody(request, updateProfileInput)
    const taken = Object.values(getDb().users).some(
      (u) => u.id !== user.id && u.username === input.username,
    )
    if (taken) throw problems.validation({ username: ['Este nome de usuário já está em uso.'] })
    if (input.avatarUrl && input.avatarUrl.length > MAX_AVATAR_LENGTH) {
      throw problems.validation({ avatarUrl: ['A imagem deve ter no máximo 750 KB.'] })
    }
    user.name = input.name
    user.username = input.username
    user.bio = input.bio && input.bio.length > 0 ? input.bio : null
    user.avatarUrl = input.avatarUrl
    user.version += 1
    commit()
    return json<User>(user)
  }),

  route('post', '/me/password', async ({ request }) => {
    const { user } = requireAuth(request)
    const input = await parseBody(request, passwordChangeInput)
    const db = getDb()
    if ((await hashPassword(user.id, input.currentPassword)) !== db.passwordHashes[user.id]) {
      throw problems.validation({ currentPassword: ['Senha atual incorreta.'] })
    }
    db.passwordHashes[user.id] = await hashPassword(user.id, input.newPassword)
    user.version += 1
    commit()
    return noContent()
  }),

  route('get', '/wallets', ({ request }) => {
    const { user } = requireAuth(request)
    return json<{ items: Wallet[] }>({ items: walletsOf(user.id) })
  }),

  route('post', '/wallets', async ({ request }) => {
    const { user } = requireAuth(request)
    const input = await parseBody(request, walletInput)
    if (walletsOf(user.id).some((w) => w.kind === input.kind)) throw walletLimit(input.kind)
    const createdAt = nowIso()
    const wallet: Wallet = {
      id: uid('wal'),
      userId: user.id,
      ...input,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    }
    getDb().wallets[wallet.id] = wallet
    commit()
    return json<Wallet>(wallet, 201)
  }),

  route('patch', '/wallets/:walletId', async ({ request, params }) => {
    const { user } = requireAuth(request)
    const wallet = getDb().wallets[param(params, 'walletId')]
    if (!wallet) throw problems.notFound('Carteira não encontrada.')
    if (wallet.userId !== user.id) throw problems.forbidden('Esta carteira pertence a outra conta.')
    const input = await parseBody(request, walletInput)
    const conflict = walletsOf(user.id).some((w) => w.id !== wallet.id && w.kind === input.kind)
    if (conflict) throw walletLimit(input.kind)
    Object.assign(wallet, input, { updatedAt: nowIso(), version: wallet.version + 1 })
    commit()
    return json<Wallet>(wallet)
  }),
]

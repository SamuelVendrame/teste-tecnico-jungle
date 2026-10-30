/**
 * Favoritos: privados por usuário (exigem Bearer). PUT/DELETE são idempotentes.
 */
import type { Favorites } from '@/api/contracts'

import { commit, getDb, type DbFavorites } from '../db'
import { requireAuth } from '../domain/auth'
import { requireNft } from '../domain/nfts'
import { json, param, route } from './http'

function favoritesOf(userId: string): DbFavorites {
  const db = getDb()
  return (db.favorites[userId] ??= { nftIds: [], version: 1 })
}

function render(f: DbFavorites): Favorites {
  return { nftIds: [...f.nftIds], version: f.version }
}

export const favoritesHandlers = [
  route('get', '/favorites', ({ request }) => {
    const { user } = requireAuth(request)
    return json<Favorites>(render(favoritesOf(user.id)))
  }),

  route('put', '/favorites/:nftId', ({ request, params }) => {
    const { user } = requireAuth(request)
    const nft = requireNft(param(params, 'nftId'))
    const favorites = favoritesOf(user.id)
    if (!favorites.nftIds.includes(nft.id)) {
      favorites.nftIds.push(nft.id)
      favorites.version += 1
      commit()
    }
    return json<Favorites>(render(favorites))
  }),

  route('delete', '/favorites/:nftId', ({ request, params }) => {
    const { user } = requireAuth(request)
    const nftId = param(params, 'nftId')
    const favorites = favoritesOf(user.id)
    if (favorites.nftIds.includes(nftId)) {
      favorites.nftIds = favorites.nftIds.filter((id) => id !== nftId)
      favorites.version += 1
      commit()
    }
    return json<Favorites>(render(favorites))
  }),
]

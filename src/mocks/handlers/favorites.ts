/**
 * Favoritos: privados por usuário (exigem Bearer). PUT/DELETE são idempotentes.
 */
import type { Favorites, Nft } from '@/api/contracts'

import { commit, getDb, type DbFavorites } from '../db'
import { requireAuth } from '../domain/auth'
import { findNft, requireNft } from '../domain/nfts'
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

  /** Favoritos expandidos com os dados do NFT, na ordem em que foram salvos. */
  route('get', '/favorites/nfts', ({ request }) => {
    const { user } = requireAuth(request)
    const items = favoritesOf(user.id)
      .nftIds.map((id) => findNft(id))
      .filter((n): n is Nft => Boolean(n))
    return json<{ items: Nft[] }>({ items })
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

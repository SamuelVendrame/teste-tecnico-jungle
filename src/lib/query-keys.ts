/**
 * Chaves de query centralizadas. Convenção:
 * - Dados públicos: ['nfts', ...]
 * - Dados privados levam o userId como segundo segmento para isolar cache
 *   entre usuários: ['cart', userId], ['favorites', userId], ['orders', userId, id].
 *   Visitante usa 'guest'. Logout remove tudo que não começa com 'nfts'.
 */
import type { CatalogQuery } from '@/api/contracts'

export const queryKeys = {
  nfts: {
    all: ['nfts'] as const,
    list: (q: CatalogQuery) => ['nfts', 'list', q] as const,
    featured: () => ['nfts', 'featured'] as const,
    detail: (slug: string) => ['nfts', 'detail', slug] as const,
    related: (slug: string) => ['nfts', 'related', slug] as const,
  },
  session: {
    current: () => ['session'] as const,
  },
  favorites: (userId: string) => ['favorites', userId] as const,
  favoriteNfts: (userId: string) => ['favorites', userId, 'nfts'] as const,
  cart: (ownerId: string) => ['cart', ownerId] as const,
  quote: (ownerId: string, fingerprintInput: string) =>
    ['quote', ownerId, fingerprintInput] as const,
  orders: {
    list: (userId: string) => ['orders', userId, 'list'] as const,
    detail: (userId: string, orderId: string) => ['orders', userId, 'detail', orderId] as const,
  },
  profile: (userId: string) => ['profile', userId] as const,
  wallets: (userId: string) => ['wallets', userId] as const,
}

export const PUBLIC_QUERY_ROOTS = ['nfts'] as const

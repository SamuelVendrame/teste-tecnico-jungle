/**
 * Funções de acesso à API. Uma por operação do contrato.
 * Assinatura padrão: (input, { signal }) => Promise<T>.
 * Toda resposta é validada com o schema Zod correspondente.
 */
import {
  HEADERS,
  type AddCartItemInput,
  type CatalogQuery,
  type ChangePasswordInput,
  type CreateOrderInput,
  type LoginInput,
  type QuoteInput,
  type RegisterInput,
  type UpdateProfileInput,
  type WalletConnectInput,
  type WalletInput,
  cart,
  catalogPage,
  favorites,
  featuredResponse,
  nft,
  nftReviewsResponse,
  order,
  orderList,
  quote,
  session,
  user,
  wallet,
  walletConnection,
} from './contracts'
import { request } from './client'
import { z } from 'zod'

type Opts = { signal?: AbortSignal }

// Sessão -------------------------------------------------------------------

export const authApi = {
  register: (input: RegisterInput) =>
    request({ method: 'POST', url: '/auth/register', data: input }, session.parse),
  login: (input: LoginInput) =>
    request({ method: 'POST', url: '/auth/login', data: input }, session.parse),
  session: (o: Opts = {}) =>
    request({ method: 'GET', url: '/auth/session', signal: o.signal }, session.parse),
  logout: () => request({ method: 'POST', url: '/auth/logout' }, () => undefined),
}

// Catálogo -----------------------------------------------------------------

function toSearchParams(q: CatalogQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (q.q) p.set('q', q.q)
  q.collection?.forEach((c) => p.append('collection', c))
  q.network?.forEach((n) => p.append('network', n))
  if (q.priceMin) p.set('priceMin', q.priceMin)
  if (q.priceMax) p.set('priceMax', q.priceMax)
  p.set('sort', q.sort)
  p.set('tab', q.tab)
  p.set('page', String(q.page))
  p.set('pageSize', String(q.pageSize))
  return p
}

export const nftApi = {
  list: (q: CatalogQuery, o: Opts = {}) =>
    request(
      { method: 'GET', url: '/nfts', params: toSearchParams(q), signal: o.signal },
      catalogPage.parse,
    ),
  featured: (o: Opts = {}) =>
    request({ method: 'GET', url: '/nfts/featured', signal: o.signal }, featuredResponse.parse),
  bySlug: (slug: string, o: Opts = {}) =>
    request(
      { method: 'GET', url: `/nfts/${encodeURIComponent(slug)}`, signal: o.signal },
      nft.parse,
    ),
  related: (slug: string, o: Opts = {}) =>
    request(
      { method: 'GET', url: `/nfts/${encodeURIComponent(slug)}/related`, signal: o.signal },
      z.object({ items: z.array(nft) }).parse,
    ),
  reviews: (slug: string, o: Opts = {}) =>
    request(
      { method: 'GET', url: `/nfts/${encodeURIComponent(slug)}/reviews`, signal: o.signal },
      nftReviewsResponse.parse,
    ),
}

// Favoritos ----------------------------------------------------------------

export const favoritesApi = {
  list: (o: Opts = {}) =>
    request({ method: 'GET', url: '/favorites', signal: o.signal }, favorites.parse),
  listNfts: (o: Opts = {}) =>
    request(
      { method: 'GET', url: '/favorites/nfts', signal: o.signal },
      z.object({ items: z.array(nft) }).parse,
    ),
  add: (nftId: string) =>
    request({ method: 'PUT', url: `/favorites/${encodeURIComponent(nftId)}` }, favorites.parse),
  remove: (nftId: string) =>
    request({ method: 'DELETE', url: `/favorites/${encodeURIComponent(nftId)}` }, favorites.parse),
}

// Carrinho -----------------------------------------------------------------

export const cartApi = {
  get: (o: Opts = {}) => request({ method: 'GET', url: '/cart', signal: o.signal }, cart.parse),
  addItem: (input: AddCartItemInput) =>
    request({ method: 'POST', url: '/cart/items', data: input }, cart.parse),
  updateItem: (itemId: string, quantity: number) =>
    request(
      { method: 'PATCH', url: `/cart/items/${encodeURIComponent(itemId)}`, data: { quantity } },
      cart.parse,
    ),
  removeItem: (itemId: string) =>
    request({ method: 'DELETE', url: `/cart/items/${encodeURIComponent(itemId)}` }, cart.parse),
  setCoupon: (couponCode: string | null) =>
    request({ method: 'PUT', url: '/cart/coupon', data: { couponCode } }, cart.parse),
  merge: (guestCartId: string) =>
    request({ method: 'POST', url: '/cart/merge', data: { guestCartId } }, cart.parse),
  /**
   * Remove apenas os itens/quantidades comprados; o restante permanece. A app não
   * o chama: o servidor já consome o carrinho ao confirmar o pedido. Mantido por
   * completude da API.
   */
  consume: (lines: Array<{ nftId: string; editionId: string; quantity: number }>) =>
    request({ method: 'POST', url: '/cart/consume', data: { lines } }, cart.parse),
}

// Cotação ------------------------------------------------------------------

export const quoteApi = {
  create: (input: QuoteInput, o: Opts = {}) =>
    request({ method: 'POST', url: '/checkout/quote', data: input, signal: o.signal }, quote.parse),
}

// Pedidos ------------------------------------------------------------------

export const orderApi = {
  create: (input: CreateOrderInput, idempotencyKey: string) =>
    request(
      {
        method: 'POST',
        url: '/orders',
        data: input,
        headers: { [HEADERS.idempotencyKey]: idempotencyKey },
        // Timeout curto de propósito: o cenário "timeout após criação" depende disso.
        timeout: 8_000,
      },
      order.parse,
    ),
  get: (orderId: string, o: Opts = {}) =>
    request(
      { method: 'GET', url: `/orders/${encodeURIComponent(orderId)}`, signal: o.signal },
      order.parse,
    ),
  list: (o: Opts = {}) =>
    request({ method: 'GET', url: '/orders', signal: o.signal }, orderList.parse),
}

// Perfil -------------------------------------------------------------------

export const profileApi = {
  me: (o: Opts = {}) => request({ method: 'GET', url: '/me', signal: o.signal }, user.parse),
  update: (input: UpdateProfileInput) =>
    request({ method: 'PATCH', url: '/me', data: input }, user.parse),
  changePassword: (input: Pick<ChangePasswordInput, 'currentPassword' | 'newPassword'>) =>
    request({ method: 'POST', url: '/me/password', data: input }, () => undefined),
}

// Carteiras ----------------------------------------------------------------

export const walletApi = {
  list: (o: Opts = {}) =>
    request(
      { method: 'GET', url: '/wallets', signal: o.signal },
      z.object({ items: z.array(wallet) }).parse,
    ),
  create: (input: WalletInput) =>
    request({ method: 'POST', url: '/wallets', data: input }, wallet.parse),
  update: (walletId: string, input: WalletInput) =>
    request(
      { method: 'PATCH', url: `/wallets/${encodeURIComponent(walletId)}`, data: input },
      wallet.parse,
    ),
  /** Desfaz a conexão no servidor simulado (o pedido passa a ser recusado com WALLET_NOT_CONNECTED). */
  disconnect: (walletId: string) =>
    request(
      { method: 'POST', url: `/wallets/${encodeURIComponent(walletId)}/disconnect` },
      walletConnection.parse,
    ),
  /** Pede a conexão à carteira (aprovação simulada). Recusa = 409 WALLET_REFUSED. */
  connect: (walletId: string, input: WalletConnectInput = {}) =>
    request(
      { method: 'POST', url: `/wallets/${encodeURIComponent(walletId)}/connect`, data: input },
      walletConnection.parse,
    ),
}

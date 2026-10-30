/**
 * Carrinho. Dono = usuário autenticado (`user:<id>`) ou visitante (`guest:<X-Cart-Id>`).
 * Os dois espaços de chave são disjuntos: um X-Cart-Id nunca alcança o carrinho de um usuário.
 *
 * Itens são deduplicados por NFT + edição. A quantidade respeita
 * min(disponível, limite por pedido): acima disso 409 OUT_OF_STOCK; edição esgotada
 * 409 EDITION_UNAVAILABLE. `edition.priceEth` do item é o preço no momento em que foi
 * adicionado/alterado; a cotação compara com o preço atual e emite `price-changed`.
 */
import { HEADERS, type Cart, type CartItem } from '@/api/contracts'
import { addEth, compareEth, mulEth } from '@/lib/money'

import {
  commit,
  getDb,
  guestCartKey,
  nowIso,
  userCartKey,
  type DbCart,
  type DbCartItem,
} from '../db'
import type { AuthContext } from './auth'
import { ApiProblem, problems } from './errors'
import { findCoupon } from './coupons'
import { findEdition, findNft, requireNft } from './nfts'

export interface CartOwner {
  key: string
  cartId: string
  userId: string | null
}

export function cartOwner(request: Request, auth: AuthContext | null): CartOwner {
  if (auth) {
    return { key: userCartKey(auth.user.id), cartId: `cart_${auth.user.id}`, userId: auth.user.id }
  }
  const guestId = request.headers.get(HEADERS.cartId)?.trim()
  if (!guestId || guestId.length > 120) {
    throw problems.validation({ [HEADERS.cartId]: ['Envie o header X-Cart-Id ou entre na conta.'] })
  }
  return { key: guestCartKey(guestId), cartId: guestId, userId: null }
}

/** Carrinho existente ou um vazio (não persistido até a primeira mutação). */
export function peekCart(owner: CartOwner): DbCart {
  return (
    getDb().carts[owner.key] ?? {
      id: owner.cartId,
      userId: owner.userId,
      items: [],
      couponCode: null,
      updatedAt: nowIso(),
      version: 0,
    }
  )
}

function ensureCart(owner: CartOwner): DbCart {
  const db = getDb()
  const cart = peekCart(owner)
  db.carts[owner.key] = cart
  return cart
}

function touch(cart: DbCart): void {
  cart.updatedAt = nowIso()
  cart.version += 1
  commit()
}

export function itemIdFor(nftId: string, editionId: string): string {
  return `ci_${nftId}_${editionId}`
}

export function renderCart(cart: DbCart): Cart {
  const items: CartItem[] = []
  for (const item of cart.items) {
    const nft = findNft(item.nftId)
    const edition = nft ? findEdition(nft, item.editionId) : undefined
    if (!nft || !edition) continue
    items.push({
      id: item.id,
      nftId: item.nftId,
      editionId: item.editionId,
      quantity: item.quantity,
      nft: {
        name: nft.name,
        slug: nft.slug,
        imageUrl: nft.imageUrl,
        network: nft.network,
        version: nft.version,
      },
      edition: {
        name: edition.name,
        priceEth: item.snapshotPriceEth,
        available: edition.available,
        maxPerOrder: edition.maxPerOrder,
      },
    })
  }
  return {
    id: cart.id,
    userId: cart.userId,
    items,
    couponCode: cart.couponCode,
    updatedAt: cart.updatedAt,
    version: cart.version,
  }
}

function assertQuantity(nftId: string, editionId: string, quantity: number) {
  const nft = requireNft(nftId)
  const edition = findEdition(nft, editionId)
  if (!edition) throw problems.notFound('Edição não encontrada.')
  if (edition.available === 0) {
    throw new ApiProblem(409, 'EDITION_UNAVAILABLE', `A edição ${edition.name} está esgotada.`, {
      meta: { nftId, editionId, available: 0, maxPerOrder: edition.maxPerOrder },
    })
  }
  const limit = Math.min(edition.available, edition.maxPerOrder)
  if (quantity > limit) {
    const reason =
      limit === edition.maxPerOrder && edition.maxPerOrder < edition.available
        ? `Limite de ${edition.maxPerOrder} por pedido para esta edição.`
        : `Apenas ${edition.available} disponível(is) nesta edição.`
    throw new ApiProblem(409, 'OUT_OF_STOCK', reason, {
      details: { quantity: [reason] },
      meta: {
        nftId,
        editionId,
        available: edition.available,
        maxPerOrder: edition.maxPerOrder,
        limit,
      },
    })
  }
  return { nft, edition }
}

export function addItem(
  owner: CartOwner,
  input: { nftId: string; editionId: string; quantity: number },
) {
  const cart = ensureCart(owner)
  const id = itemIdFor(input.nftId, input.editionId)
  const existing = cart.items.find((i) => i.id === id)
  const quantity = (existing?.quantity ?? 0) + input.quantity
  const { edition } = assertQuantity(input.nftId, input.editionId, quantity)
  if (existing) {
    existing.quantity = quantity
    existing.snapshotPriceEth = edition.priceEth
  } else {
    cart.items.push({
      id,
      nftId: input.nftId,
      editionId: input.editionId,
      quantity,
      snapshotPriceEth: edition.priceEth,
      addedAt: nowIso(),
    })
  }
  touch(cart)
  return cart
}

function requireItem(cart: DbCart, itemId: string): DbCartItem {
  const item = cart.items.find((i) => i.id === itemId)
  if (!item) throw problems.notFound('Item não está no carrinho.')
  return item
}

export function updateItem(owner: CartOwner, itemId: string, quantity: number) {
  const cart = peekCart(owner)
  const item = requireItem(cart, itemId)
  const { edition } = assertQuantity(item.nftId, item.editionId, quantity)
  item.quantity = quantity
  item.snapshotPriceEth = edition.priceEth
  getDb().carts[owner.key] = cart
  touch(cart)
  return cart
}

export function removeItem(owner: CartOwner, itemId: string) {
  const cart = peekCart(owner)
  requireItem(cart, itemId)
  cart.items = cart.items.filter((i) => i.id !== itemId)
  getDb().carts[owner.key] = cart
  touch(cart)
  return cart
}

export function cartSubtotal(cart: DbCart): string {
  let total = '0'
  for (const item of cart.items) {
    const nft = findNft(item.nftId)
    const edition = nft ? findEdition(nft, item.editionId) : undefined
    if (!edition) continue
    total = addEth(total, mulEth(edition.priceEth, item.quantity))
  }
  return total
}

export function setCoupon(owner: CartOwner, code: string | null) {
  const cart = ensureCart(owner)
  if (code === null || code.trim() === '') {
    cart.couponCode = null
  } else {
    const coupon = findCoupon(code, { subtotalEth: cartSubtotal(cart) })
    cart.couponCode = coupon.code
  }
  touch(cart)
  return cart
}

/** Move os itens do visitante para o carrinho do usuário, somando e respeitando limites. */
export function mergeGuestCart(owner: CartOwner, guestCartId: string) {
  const db = getDb()
  const guestKey = guestCartKey(guestCartId)
  const guest = db.carts[guestKey]
  const cart = ensureCart(owner)
  if (guest) {
    for (const g of guest.items) {
      const nft = findNft(g.nftId)
      const edition = nft ? findEdition(nft, g.editionId) : undefined
      if (!edition || edition.available === 0) continue
      const limit = Math.min(edition.available, edition.maxPerOrder)
      const existing = cart.items.find((i) => i.id === g.id)
      const quantity = Math.min(limit, (existing?.quantity ?? 0) + g.quantity)
      if (existing) {
        existing.quantity = quantity
      } else {
        cart.items.push({ ...g, quantity })
      }
    }
    if (!cart.couponCode && guest.couponCode) cart.couponCode = guest.couponCode
    delete db.carts[guestKey]
  }
  touch(cart)
  return cart
}

/** Remove apenas as quantidades compradas; o resto permanece. */
export function consumeItems(
  owner: CartOwner,
  lines: Array<{ nftId: string; editionId: string; quantity: number }>,
) {
  const cart = peekCart(owner)
  for (const line of lines) {
    const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
    if (item) item.quantity -= line.quantity
  }
  cart.items = cart.items.filter((i) => i.quantity > 0)
  getDb().carts[owner.key] = cart
  touch(cart)
  return cart
}

export function snapshotPriceFor(cart: DbCart | null, nftId: string, editionId: string) {
  return cart?.items.find((i) => i.nftId === nftId && i.editionId === editionId)?.snapshotPriceEth
}

export function priceDiffers(a: string, b: string): boolean {
  return compareEth(a, b) !== 0
}

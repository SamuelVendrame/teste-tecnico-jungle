/**
 * Carrinho: visitante (X-Cart-Id) ou usuário (Bearer). Merge e consume exigem conta.
 */
import { z } from 'zod'

import { addCartItemInput, mergeCartInput, updateCartItemInput, type Cart } from '@/api/contracts'

import { optionalAuth, requireAuth } from '../domain/auth'
import {
  addItem,
  cartOwner,
  consumeItems,
  mergeGuestCart,
  peekCart,
  removeItem,
  renderCart,
  setCoupon,
  updateItem,
} from '../domain/cart'
import { json, param, parseBody, route } from './http'

const setCouponInput = z.object({ couponCode: z.string().trim().max(40).nullable() })

const consumeInput = z.object({
  lines: z.array(addCartItemInput).min(1, 'Informe ao menos uma linha'),
})

function ownerFrom(request: Request) {
  return cartOwner(request, optionalAuth(request))
}

export const cartHandlers = [
  route('get', '/cart', ({ request }) => json<Cart>(renderCart(peekCart(ownerFrom(request))))),

  route('post', '/cart/items', async ({ request }) => {
    const owner = ownerFrom(request)
    const input = await parseBody(request, addCartItemInput)
    return json<Cart>(renderCart(addItem(owner, input)))
  }),

  route('patch', '/cart/items/:itemId', async ({ request, params }) => {
    const owner = ownerFrom(request)
    const { quantity } = await parseBody(request, updateCartItemInput)
    return json<Cart>(renderCart(updateItem(owner, param(params, 'itemId'), quantity)))
  }),

  route('delete', '/cart/items/:itemId', ({ request, params }) => {
    const owner = ownerFrom(request)
    return json<Cart>(renderCart(removeItem(owner, param(params, 'itemId'))))
  }),

  route('put', '/cart/coupon', async ({ request }) => {
    const owner = ownerFrom(request)
    const { couponCode } = await parseBody(request, setCouponInput)
    return json<Cart>(renderCart(setCoupon(owner, couponCode)))
  }),

  route('post', '/cart/merge', async ({ request }) => {
    const auth = requireAuth(request)
    const { guestCartId } = await parseBody(request, mergeCartInput)
    return json<Cart>(renderCart(mergeGuestCart(cartOwner(request, auth), guestCartId)))
  }),

  route('post', '/cart/consume', async ({ request }) => {
    const owner = ownerFrom(request)
    const { lines } = await parseBody(request, consumeInput)
    return json<Cart>(renderCart(consumeItems(owner, lines)))
  }),
]

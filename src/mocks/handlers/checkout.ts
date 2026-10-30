/**
 * Cotação e pedidos.
 * - POST /checkout/quote: pública (visitante ou usuário); compara com o snapshot do carrinho.
 * - POST /orders: exige Bearer + Idempotency-Key; 201 na criação, 200 na repetição.
 */
import { HEADERS, createOrderInput, quoteInput, type Order, type Quote } from '@/api/contracts'

import { getDb, userCartKey } from '../db'
import { optionalAuth, requireAuth } from '../domain/auth'
import { cartOwner } from '../domain/cart'
import { problems } from '../domain/errors'
import { createOrder, getOrderFor, listOrders } from '../domain/orders'
import { createQuote } from '../domain/quote'
import { getScenario } from '../scenarios'
import { sleep } from '../utils'
import { json, param, parseBody, route } from './http'

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/

export const checkoutHandlers = [
  route('post', '/checkout/quote', async ({ request }) => {
    const auth = optionalAuth(request)
    const input = await parseBody(request, quoteInput)
    const owner = auth
      ? { key: userCartKey(auth.user.id), userId: auth.user.id }
      : (() => {
          const o = cartOwner(request, null)
          return { key: o.key, userId: null }
        })()
    const cart = getDb().carts[owner.key] ?? null
    return json<Quote>(await createQuote(input, owner, cart))
  }),

  route('post', '/orders', async ({ request }) => {
    const { user } = requireAuth(request)
    const key = request.headers.get(HEADERS.idempotencyKey)?.trim() ?? ''
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw problems.validation({
        [HEADERS.idempotencyKey]: ['Envie o header Idempotency-Key (8 a 128 caracteres).'],
      })
    }
    const input = await parseBody(request, createOrderInput)
    const { order, created } = await createOrder(user, input, key)
    // Cenário order-timeout: o pedido já existe e os eventos já saíram; só a resposta atrasa.
    const responseDelay = getScenario().orderResponseDelayMs
    if (created && responseDelay > 0) await sleep(responseDelay)
    return json<Order>(getDb().orders[order.id] ?? order, created ? 201 : 200)
  }),

  route('get', '/orders', ({ request }) => {
    const { user } = requireAuth(request)
    return json<{ items: Order[] }>({ items: listOrders(user.id) })
  }),

  route('get', '/orders/:orderId', ({ request, params }) => {
    const { user } = requireAuth(request)
    return json<Order>(getOrderFor(user.id, param(params, 'orderId')))
  }),
]

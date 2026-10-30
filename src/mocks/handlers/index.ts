/**
 * Todos os handlers HTTP da API simulada (MSW).
 * Controles `/__mock/*` primeiro; o curinga `/api/*` por último devolve 404 NOT_FOUND
 * para rotas inexistentes (nunca vaza para a rede).
 */
import type { RequestHandler } from 'msw'

import { controlHandlers } from '../control'
import { ApiProblem } from '../domain/errors'
import { accountHandlers } from './account'
import { authHandlers } from './auth'
import { cartHandlers } from './cart'
import { catalogHandlers } from './catalog'
import { checkoutHandlers } from './checkout'
import { favoritesHandlers } from './favorites'
import { route } from './http'

const fallbackHandlers = (['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
  route(method, '/*', () => {
    throw new ApiProblem(404, 'NOT_FOUND', 'Rota inexistente na API simulada.')
  }),
)

export const handlers: RequestHandler[] = [
  ...controlHandlers,
  ...authHandlers,
  ...catalogHandlers,
  ...favoritesHandlers,
  ...cartHandlers,
  ...checkoutHandlers,
  ...accountHandlers,
  ...fallbackHandlers,
]

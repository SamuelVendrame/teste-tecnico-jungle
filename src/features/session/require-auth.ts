import { redirect } from '@tanstack/react-router'

import { isAuthenticated, sessionStore } from './session-store'

/**
 * Guard para `beforeLoad` de rotas privadas.
 * Guarda a rota atual em `returnTo` e redireciona para /login.
 */
export function requireAuth(location: { href: string }) {
  if (isAuthenticated()) return
  sessionStore.setReturnTo(location.href)
  throw redirect({ to: '/login', search: { returnTo: location.href } })
}

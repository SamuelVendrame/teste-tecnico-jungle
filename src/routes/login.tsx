import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { AuthLayout } from '@/features/auth/AuthLayout'
import { LoginForm } from '@/features/auth/LoginForm'
import { resolveReturnTo } from '@/features/auth/return-to'
import { isAuthenticated, sessionStore } from '@/features/session/session-store'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  beforeLoad: ({ search }) => {
    // Usuário já autenticado não precisa ver o login: segue para o destino pedido.
    if (isAuthenticated()) {
      throw redirect({ href: resolveReturnTo(search.returnTo ?? sessionStore.getState().returnTo) })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const { returnTo } = Route.useSearch()
  return (
    <AuthLayout mode="login" returnTo={returnTo}>
      <LoginForm returnTo={returnTo} />
    </AuthLayout>
  )
}

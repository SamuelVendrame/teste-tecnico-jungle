import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { AuthLayout } from '@/features/auth/AuthLayout'
import { RegisterForm } from '@/features/auth/RegisterForm'
import { resolveReturnTo } from '@/features/auth/return-to'
import { isAuthenticated, sessionStore } from '@/features/session/session-store'

export const Route = createFileRoute('/register')({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  beforeLoad: ({ search }) => {
    if (isAuthenticated()) {
      throw redirect({ href: resolveReturnTo(search.returnTo ?? sessionStore.getState().returnTo) })
    }
  },
  component: RegisterPage,
})

function RegisterPage() {
  const { returnTo } = Route.useSearch()
  return (
    <AuthLayout mode="register" returnTo={returnTo}>
      <RegisterForm returnTo={returnTo} />
    </AuthLayout>
  )
}

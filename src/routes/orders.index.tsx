import { createFileRoute, redirect } from '@tanstack/react-router'

import { requireAuth } from '@/features/session/require-auth'

/** A lista de pedidos vive no perfil (seção "Pedidos"). */
export const Route = createFileRoute('/orders/')({
  beforeLoad: ({ location }) => {
    requireAuth(location)
    throw redirect({ to: '/profile', hash: 'pedidos', replace: true })
  },
})

import { createFileRoute } from '@tanstack/react-router'

import { RouteError } from '@/components/layout/RouteStates'
import { walletsQueryOptions } from '@/features/wallets/use-wallets'
import { WalletsPage, WalletsSkeleton } from '@/features/wallets/WalletsPage'
import { requireAuth } from '@/features/session/require-auth'
import { sessionStore } from '@/features/session/session-store'

export const Route = createFileRoute('/wallets')({
  beforeLoad: ({ location }) => requireAuth(location),
  loader: async ({ context: { queryClient } }) => {
    const userId = sessionStore.getState().user?.id
    if (!userId) return
    await queryClient.ensureQueryData(walletsQueryOptions(userId))
  },
  pendingComponent: WalletsSkeleton,
  pendingMs: 200,
  errorComponent: ({ reset }) => (
    <RouteError reset={reset} title="Não foi possível carregar suas carteiras" />
  ),
  component: WalletsPage,
})

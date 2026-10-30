import { createFileRoute } from '@tanstack/react-router'

import { RouteError } from '@/components/layout/RouteStates'
import { ProfilePage, ProfileSkeleton } from '@/features/profile/ProfilePage'
import {
  favoriteNftsQueryOptions,
  ordersQueryOptions,
  profileQueryOptions,
} from '@/features/profile/use-profile'
import { requireAuth } from '@/features/session/require-auth'
import { sessionStore } from '@/features/session/session-store'

export const Route = createFileRoute('/profile')({
  beforeLoad: ({ location }) => requireAuth(location),
  loader: async ({ context: { queryClient } }) => {
    const userId = sessionStore.getState().user?.id
    if (!userId) return
    // Favoritos e pedidos carregam dentro da página, com skeleton próprio.
    void queryClient.prefetchQuery(favoriteNftsQueryOptions(userId))
    void queryClient.prefetchQuery(ordersQueryOptions(userId))
    await queryClient.ensureQueryData(profileQueryOptions(userId))
  },
  pendingComponent: ProfileSkeleton,
  pendingMs: 200,
  errorComponent: ({ reset }) => (
    <RouteError reset={reset} title="Não foi possível carregar seu perfil" />
  ),
  component: ProfilePage,
})

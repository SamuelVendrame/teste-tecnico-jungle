import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import type { ChangePasswordInput, UpdateProfileInput, User } from '@/api/contracts'
import { favoritesApi, orderApi, profileApi } from '@/api/endpoints'
import { sessionStore, useSession } from '@/features/session/session-store'
import { queryKeys } from '@/lib/query-keys'

export function profileQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => profileApi.me({ signal }),
  })
}

/** Id do usuário autenticado. Rotas privadas já foram protegidas por `requireAuth`. */
export function useCurrentUserId(): string {
  return useSession().user?.id ?? 'anonymous'
}

/** Perfil do usuário autenticado (a rota pré-carrega, então não há estado de carregamento). */
export function useProfile(): User {
  const userId = useCurrentUserId()
  return useSuspenseQuery(profileQueryOptions(userId)).data
}

/** PATCH /me. Em sucesso atualiza o cache do perfil e a sessão persistida. */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const userId = useCurrentUserId()
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => profileApi.update(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.profile(userId), updated)
      sessionStore.updateUser(updated)
    },
  })
}

/** POST /me/password. O formulário valida a confirmação; a API recebe só atual e nova. */
export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordInput) =>
      profileApi.changePassword({ currentPassword, newPassword }),
  })
}

export function favoriteNftsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.favoriteNfts(userId),
    queryFn: ({ signal }) => favoritesApi.listNfts({ signal }),
  })
}

export function ordersQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.orders.list(userId),
    queryFn: ({ signal }) => orderApi.list({ signal }),
  })
}

/** NFTs favoritados do usuário (seção "Favoritos" do perfil). */
export function useFavoriteNfts() {
  return useQuery(favoriteNftsQueryOptions(useCurrentUserId()))
}

/** Pedidos do usuário (seção "Pedidos" do perfil). */
export function useOrders() {
  return useQuery(ordersQueryOptions(useCurrentUserId()))
}

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'

import type { Wallet, WalletInput } from '@/api/contracts'
import { walletApi } from '@/api/endpoints'
import { useCurrentUserId } from '@/features/profile/use-profile'
import { queryKeys } from '@/lib/query-keys'

export function walletsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => walletApi.list({ signal }),
    select: (data) => data.items,
  })
}

/** Carteiras do usuário (para o checkout e outros consumidores; trata carregamento e erro). */
export function useWallets() {
  return useQuery(walletsQueryOptions(useCurrentUserId()))
}

/** Versão com Suspense, usada pela página de carteiras (a rota pré-carrega). */
export function useWalletsSuspense(): Wallet[] {
  return useSuspenseQuery(walletsQueryOptions(useCurrentUserId())).data
}

export interface SaveWalletInput {
  /** Presente = edição (PATCH); ausente = cadastro (POST). */
  walletId?: string
  input: WalletInput
}

/** Cadastro/edição de carteira. Em sucesso invalida a lista de carteiras. */
export function useSaveWallet() {
  const queryClient = useQueryClient()
  const userId = useCurrentUserId()
  return useMutation({
    mutationFn: ({ walletId, input }: SaveWalletInput) =>
      walletId ? walletApi.update(walletId, input) : walletApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wallets(userId) }),
    // Conflito de limite: a lista local estava desatualizada, então também recarrega.
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.wallets(userId) }),
  })
}

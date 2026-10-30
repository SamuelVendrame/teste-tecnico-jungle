/**
 * Favoritos do usuário autenticado.
 *
 * ATUALIZAÇÃO OTIMISTA (requisito do desafio, seção 4):
 * `useToggleFavorite` marca/desmarca o coração imediatamente, antes da resposta
 * da API. O ciclo segue o padrão do TanStack Query:
 *   1. onMutate: cancela consultas em andamento de ['favorites', userId] (uma
 *      resposta antiga não pode sobrescrever o estado otimista), tira um
 *      snapshot de "este NFT estava favoritado?" e grava o novo estado no cache.
 *   2. onError: rollback. Restaura o snapshot apenas do NFT afetado (não a lista
 *      inteira), para não desfazer outros toggles concorrentes que deram certo,
 *      e mostra o toast "Não foi possível salvar o favorito".
 *   3. onSettled: invalida a lista para reconciliar com o servidor, mas só
 *      quando esta é a última mutation de favoritos em voo; assim um refetch
 *      intermediário não faz "piscar" estados otimistas ainda pendentes.
 * O cache é isolado por usuário (a chave inclui o userId) e a query só roda com
 * sessão autenticada.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Favorites } from '@/api/contracts'
import { favoritesApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/query-keys'
import { useSession } from '@/features/session/session-store'

function useAuthenticatedUserId(): string | null {
  const session = useSession()
  return session.status === 'authenticated' && session.user ? session.user.id : null
}

export function useFavorites() {
  const userId = useAuthenticatedUserId()
  return useQuery({
    queryKey: queryKeys.favorites(userId ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: userId !== null,
  })
}

export function useIsFavorite(nftId: string): boolean {
  const { data } = useFavorites()
  return data?.nftIds.includes(nftId) ?? false
}

export interface ToggleFavoriteInput {
  nftId: string
  /** Estado desejado: true = favoritar, false = desfavoritar. */
  favorite: boolean
}

function withFavorite(current: Favorites | undefined, nftId: string, favorite: boolean): Favorites {
  const without = (current?.nftIds ?? []).filter((id) => id !== nftId)
  return {
    nftIds: favorite ? [...without, nftId] : without,
    version: current?.version ?? 0,
  }
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const userId = useAuthenticatedUserId()
  const key = queryKeys.favorites(userId ?? 'anonymous')
  const mutationKey = ['favorites', userId ?? 'anonymous', 'toggle']

  return useMutation({
    mutationKey,
    mutationFn: ({ nftId, favorite }: ToggleFavoriteInput) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Favorites>(key)
      const wasFavorite = previous?.nftIds.includes(nftId) ?? false
      queryClient.setQueryData<Favorites>(key, (old) => withFavorite(old, nftId, favorite))
      return { wasFavorite }
    },
    onError: (_error, { nftId }, context) => {
      if (context) {
        queryClient.setQueryData<Favorites>(key, (old) =>
          withFavorite(old, nftId, context.wasFavorite),
        )
      }
      toast.error('Não foi possível salvar o favorito', {
        description: 'Verifique sua conexão e tente novamente.',
      })
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}

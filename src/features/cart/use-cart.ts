/**
 * Carrinho (leitura e inclusão). A página do carrinho e as demais mutations
 * (alterar quantidade, remover, cupom) ficam com o módulo de carrinho.
 *
 * - O cache é isolado por dono: `['cart', userId]` para autenticado e
 *   `['cart', 'guest']` para visitante (o header X-Cart-Id identifica o
 *   carrinho do visitante no servidor).
 * - `useAddToCart` grava no cache o carrinho devolvido pela API (fonte da
 *   verdade), sem refetch adicional.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { isApiClientError } from '@/api/client'
import type { AddCartItemInput, Cart } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/query-keys'
import { useSession } from '@/features/session/session-store'

export function useCartOwnerId(): string {
  const session = useSession()
  return session.status === 'authenticated' && session.user ? session.user.id : 'guest'
}

export function useCart() {
  const ownerId = useCartOwnerId()
  return useQuery({
    queryKey: queryKeys.cart(ownerId),
    queryFn: ({ signal }) => cartApi.get({ signal }),
  })
}

/** Soma das quantidades (badge do header e da Tab Bar). */
export function cartItemCount(cart: Cart | undefined): number {
  return cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
}

export function addToCartErrorMessage(error: unknown): string {
  if (!isApiClientError(error)) return 'Não foi possível adicionar ao carrinho. Tente novamente.'
  switch (error.code) {
    case 'OUT_OF_STOCK':
      return 'Não há unidades suficientes desta edição. Ajuste a quantidade e tente de novo.'
    case 'EDITION_UNAVAILABLE':
      return 'Esta edição não está mais disponível. Escolha outra edição.'
    case 'VALIDATION_ERROR':
      return 'Quantidade inválida para esta edição.'
    default:
      return error.message || 'Não foi possível adicionar ao carrinho. Tente novamente.'
  }
}

export function useAddToCart() {
  const queryClient = useQueryClient()
  const ownerId = useCartOwnerId()
  return useMutation({
    mutationKey: ['cart', ownerId, 'add'],
    mutationFn: (input: AddCartItemInput) => cartApi.addItem(input),
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKeys.cart(ownerId), cart)
    },
    onError: (error) => {
      toast.error(addToCartErrorMessage(error))
      // A disponibilidade mudou no servidor: atualiza catálogo e detalhe visíveis.
      if (
        isApiClientError(error) &&
        (error.code === 'OUT_OF_STOCK' || error.code === 'EDITION_UNAVAILABLE')
      ) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
      }
    },
  })
}

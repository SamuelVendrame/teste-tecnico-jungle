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

// ---------------------------------------------------------------------------
// Mutations da página do carrinho
// ---------------------------------------------------------------------------

/**
 * Todas as mutations do carrinho gravam no cache o `Cart` devolvido pela API
 * (fonte da verdade). Elas compartilham um `scope` para rodar em série: duas
 * alterações rápidas nunca chegam fora de ordem ao servidor.
 */
function cartScope(ownerId: string) {
  return { id: `cart:${ownerId}` }
}

export function cartMutationErrorMessage(error: unknown, fallback: string): string {
  if (!isApiClientError(error)) return fallback
  switch (error.code) {
    case 'OUT_OF_STOCK':
    case 'EDITION_UNAVAILABLE':
      return addToCartErrorMessage(error)
    case 'NOT_FOUND':
      return 'Este item não está mais no carrinho.'
    default:
      return error.isTransient ? `${fallback} Verifique sua conexão.` : error.message || fallback
  }
}

/** Altera a quantidade com atualização otimista e rollback em caso de erro. */
export function useUpdateCartItem() {
  const queryClient = useQueryClient()
  const ownerId = useCartOwnerId()
  const key = queryKeys.cart(ownerId)
  return useMutation({
    mutationKey: ['cart', ownerId, 'update'],
    scope: cartScope(ownerId),
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      cartApi.updateItem(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Cart>(key)
      if (previous) {
        queryClient.setQueryData<Cart>(key, {
          ...previous,
          items: previous.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
        })
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error(cartMutationErrorMessage(error, 'Não foi possível alterar a quantidade.'))
      void queryClient.invalidateQueries({ queryKey: key })
    },
    onSuccess: (cart) => {
      // Outra alteração ainda na fila: a resposta dela é a que vale (evita "piscar").
      if (queryClient.isMutating({ mutationKey: ['cart', ownerId] }) > 1) return
      queryClient.setQueryData(key, cart)
    },
  })
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient()
  const ownerId = useCartOwnerId()
  return useMutation({
    mutationKey: ['cart', ownerId, 'remove'],
    scope: cartScope(ownerId),
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart(ownerId), cart),
    onError: (error) => {
      toast.error(cartMutationErrorMessage(error, 'Não foi possível remover o item.'))
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart(ownerId) })
    },
  })
}

/** Aplica (código) ou remove (null) o cupom. Erros COUPON_* ficam com o formulário. */
export function useSetCoupon() {
  const queryClient = useQueryClient()
  const ownerId = useCartOwnerId()
  return useMutation({
    mutationKey: ['cart', ownerId, 'coupon'],
    scope: cartScope(ownerId),
    mutationFn: (couponCode: string | null) => cartApi.setCoupon(couponCode),
    onSuccess: (cart) => queryClient.setQueryData(queryKeys.cart(ownerId), cart),
  })
}

export function couponErrorMessage(error: unknown): string {
  if (isApiClientError(error)) {
    if (error.code === 'COUPON_INVALID') return 'Cupom inválido'
    if (error.code === 'COUPON_EXPIRED') return 'Cupom expirado'
    if (error.isTransient) return 'Não foi possível validar o cupom. Tente novamente.'
    return error.details?.couponCode?.[0] ?? error.message
  }
  return 'Não foi possível validar o cupom. Tente novamente.'
}

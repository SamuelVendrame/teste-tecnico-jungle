/**
 * Cotação (POST /checkout/quote) como query.
 *
 * - A chave é `queryKeys.quote(ownerId, fingerprintInput)`, onde `fingerprintInput`
 *   é um JSON estável de itens + cupom + rede. Mudou a quantidade, o cupom ou a
 *   rede: chave nova, cotação nova. Mudou só o preço no servidor: a camada de
 *   tempo real invalida ['quote'] e a mesma chave é recalculada.
 * - `keepPreviousData` mantém o resumo anterior na tela enquanto a nova cotação
 *   chega (sem pular para skeleton a cada clique no +/-).
 * - O carrinho usa a rede do primeiro item (os NFTs do layout são de uma rede só
 *   e a taxa varia por rede); o checkout usa a rede escolhida pelo usuário.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { isApiClientError } from '@/api/client'
import type { Cart, NetworkId, QuoteInput } from '@/api/contracts'
import { quoteApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/query-keys'

import { useCartOwnerId } from './use-cart'

export function buildQuoteInput(cart: Cart, network: NetworkId): QuoteInput {
  return {
    items: [...cart.items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((i) => ({ nftId: i.nftId, editionId: i.editionId, quantity: i.quantity })),
    couponCode: cart.couponCode,
    network,
  }
}

/** JSON estável (itens ordenados, chaves em ordem fixa) usado na chave da query. */
export function quoteFingerprintInput(input: QuoteInput): string {
  return JSON.stringify({
    items: input.items.map((i) => [i.nftId, i.editionId, i.quantity]),
    coupon: input.couponCode,
    network: input.network,
  })
}

/** Rede usada no resumo do carrinho: a do NFT do primeiro item. */
export function cartNetwork(cart: Cart | undefined): NetworkId | null {
  return cart?.items[0]?.nft.network ?? null
}

export function isCouponError(error: unknown): boolean {
  return (
    isApiClientError(error) && (error.code === 'COUPON_INVALID' || error.code === 'COUPON_EXPIRED')
  )
}

export function useQuote(cart: Cart | undefined, network: NetworkId | null) {
  const ownerId = useCartOwnerId()
  const input = cart && network && cart.items.length > 0 ? buildQuoteInput(cart, network) : null
  const fingerprintInput = input ? quoteFingerprintInput(input) : 'empty'
  const query = useQuery({
    queryKey: queryKeys.quote(ownerId, fingerprintInput),
    queryFn: ({ signal }) => quoteApi.create(input!, { signal }),
    enabled: input !== null,
    placeholderData: keepPreviousData,
    // A cotação vale 10 min no servidor; o checkout refaz ao expirar (contagem regressiva).
    staleTime: 60_000,
  })
  return { ...query, fingerprintInput, input }
}

import { useState } from 'react'

import type { Nft } from '@/api/contracts'
import { mulEth } from '@/lib/money'

/**
 * Estado de compra do detalhe: edição selecionada e quantidade.
 * Os limites são derivados a cada render a partir do NFT em cache, então uma
 * mudança de disponibilidade (refetch ou evento em tempo real) reduz a
 * quantidade automaticamente, sem efeito colateral.
 */
export function useNftPurchase(nft: Nft) {
  const defaultEdition = nft.editions.find((e) => e.available > 0) ?? nft.editions[0]!
  const [editionId, setEditionId] = useState(defaultEdition.id)
  const [requested, setRequested] = useState(1)

  const edition = nft.editions.find((e) => e.id === editionId) ?? defaultEdition
  const maxQuantity = Math.min(edition.available, edition.maxPerOrder)
  const soldOut = edition.available === 0
  const quantity = soldOut ? 1 : Math.min(Math.max(requested, 1), maxQuantity)
  const totalEth = mulEth(edition.priceEth, quantity)

  const helperText = soldOut
    ? 'Esta edição está esgotada.'
    : edition.available < edition.maxPerOrder
      ? `Apenas ${edition.available} ${edition.available === 1 ? 'disponível' : 'disponíveis'}`
      : `Máximo de ${edition.maxPerOrder} por pedido`

  function selectEdition(id: string) {
    setEditionId(id)
    setRequested(1)
  }

  return {
    edition,
    quantity,
    maxQuantity: Math.max(maxQuantity, 1),
    soldOut,
    totalEth,
    helperText,
    setQuantity: setRequested,
    selectEdition,
  }
}

export type NftPurchase = ReturnType<typeof useNftPurchase>

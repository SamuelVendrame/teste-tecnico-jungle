import type { Nft, NftReviewsResponse } from '@/api/contracts'

import { ratingOf, seedReviews } from '../fixtures/reviews'

/** Avaliações de um NFT: só leitura, fora do banco persistido (ver fixtures/reviews.ts). */
export function nftReviews(nft: Pick<Nft, 'id'>): NftReviewsResponse {
  const items = seedReviews()[nft.id] ?? []
  return { rating: ratingOf(items), items: items.map((r) => ({ ...r })) }
}

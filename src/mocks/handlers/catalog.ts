/**
 * Catálogo público: listagem, destaques, detalhe e relacionados.
 * A ordem importa: `/nfts/featured` precisa vir antes de `/nfts/:slug`.
 */
import {
  catalogQuery,
  type CatalogPage,
  type FeaturedResponse,
  type Nft,
  type NftReviewsResponse,
} from '@/api/contracts'

import { featured, queryCatalog, relatedNfts, requireNft } from '../domain/nfts'
import { nftReviews } from '../domain/reviews'
import { getScenario } from '../scenarios'
import { json, param, route, validate } from './http'

function readCatalogQuery(url: URL) {
  const p = url.searchParams
  const raw: Record<string, unknown> = {}
  const text = (key: string) => {
    const value = p.get(key)
    if (value !== null && value.trim() !== '') raw[key] = value
  }
  const int = (key: string) => {
    const value = p.get(key)
    if (value !== null && value !== '') raw[key] = /^\d+$/.test(value) ? Number(value) : value
  }
  text('q')
  text('priceMin')
  text('priceMax')
  text('sort')
  text('tab')
  int('page')
  int('pageSize')
  const collections = p.getAll('collection').filter(Boolean)
  const networks = p.getAll('network').filter(Boolean)
  if (collections.length) raw.collection = collections
  if (networks.length) raw.network = networks
  return validate(catalogQuery, raw)
}

export const catalogHandlers = [
  route('get', '/nfts', ({ url }) => {
    const query = readCatalogQuery(url)
    return json<CatalogPage>(queryCatalog(query, { empty: getScenario().emptyCatalog }))
  }),

  route('get', '/nfts/featured', () =>
    json<FeaturedResponse>(featured({ empty: getScenario().emptyCatalog })),
  ),

  route('get', '/nfts/:slug', ({ params }) => json<Nft>(requireNft(param(params, 'slug')))),

  route('get', '/nfts/:slug/related', ({ params }) => {
    const nft = requireNft(param(params, 'slug'))
    const items = getScenario().emptyCatalog ? [] : relatedNfts(nft)
    return json<{ items: Nft[] }>({ items })
  }),

  route('get', '/nfts/:slug/reviews', ({ params }) =>
    json<NftReviewsResponse>(nftReviews(requireNft(param(params, 'slug')))),
  ),
]

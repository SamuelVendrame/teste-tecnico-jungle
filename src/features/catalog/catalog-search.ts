/**
 * Search params da rota `/` (catálogo).
 *
 * Deriva de `catalogQuery` (contrato da API), então o que está na URL é
 * exatamente o que é enviado em GET /nfts. Diferenças, só de tolerância:
 * - `.catch()` em cada campo: uma URL editada à mão com valor inválido cai no
 *   padrão em vez de derrubar a rota.
 * - `q`, `priceMin` e `priceMax` aceitam número: o parser padrão do TanStack
 *   Router faz JSON.parse de cada valor, então `?priceMin=0.5` digitado à mão
 *   chega como number. Links gerados pela aplicação sempre usam string.
 */
import { z } from 'zod'

import {
  catalogQuery,
  catalogSort,
  catalogTab,
  collectionId,
  ethAmount,
  networkId,
  type CatalogQuery,
} from '@/api/contracts'

const looseEth = z
  .union([ethAmount, z.number().nonnegative().transform(String).pipe(ethAmount)])
  .optional()
  .catch(undefined)

export const catalogSearchSchema = catalogQuery.extend({
  q: z
    .union([z.string(), z.number().transform(String)])
    .transform((value) => value.trim() || undefined)
    .optional()
    .catch(undefined),
  collection: z.array(collectionId).optional().catch(undefined),
  network: z.array(networkId).optional().catch(undefined),
  priceMin: looseEth,
  priceMax: looseEth,
  sort: catalogSort.default('recent').catch('recent'),
  tab: catalogTab.default('all').catch('all'),
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().min(1).max(48).default(9).catch(9),
})

export type CatalogSearch = z.output<typeof catalogSearchSchema>
export type CatalogSearchInput = z.input<typeof catalogSearchSchema>

// Garante em tempo de compilação que a URL produz um CatalogQuery válido.
const _assertCompatible = (s: CatalogSearch): CatalogQuery => s
void _assertCompatible

/** Valores padrão: removidos da URL por `stripSearchParams`. */
export const CATALOG_DEFAULTS = {
  sort: 'recent',
  tab: 'all',
  page: 1,
  pageSize: 9,
} as const satisfies Partial<CatalogSearch>

export const SORT_LABELS: Record<CatalogSearch['sort'], string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais populares',
}

export const TAB_LABELS: Record<CatalogSearch['tab'], string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

export function hasActiveFilters(search: CatalogSearch): boolean {
  return Boolean(
    search.q ||
    search.collection?.length ||
    search.network?.length ||
    search.priceMin ||
    search.priceMax,
  )
}

/**
 * Catálogo: consulta (busca, filtros, ordenação, abas, facetas, paginação) e
 * mutações de NFT. Toda mutação de preço/disponibilidade incrementa `version` e
 * publica `nft.updated` no barramento (repassado pelo Socket.IO simulado).
 */
import {
  COLLECTION_LABELS,
  collectionId,
  networkId,
  type CatalogPage,
  type CatalogQuery,
  type Nft,
  type NftEdition,
} from '@/api/contracts'
import { compareEth } from '@/lib/money'

import { commit, getDb, nowIso } from '../db'
import { mockEvents } from '../events'
import { referencePrice } from '../fixtures/nfts'
import { problems } from './errors'

const DAY_MS = 86_400_000
const NEW_WINDOW_MS = 30 * DAY_MS

export function allNfts(): Nft[] {
  return Object.values(getDb().nfts)
}

export function findNft(idOrSlug: string): Nft | undefined {
  const nfts = getDb().nfts
  return nfts[idOrSlug] ?? Object.values(nfts).find((n) => n.slug === idOrSlug)
}

export function requireNft(idOrSlug: string): Nft {
  const nft = findNft(idOrSlug)
  if (!nft) throw problems.notFound('NFT não encontrado.')
  return nft
}

export function findEdition(nft: Nft, editionId: string): NftEdition | undefined {
  return nft.editions.find((e) => e.id === editionId)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  const lo = sorted[mid - 1] ?? hi
  return sorted.length % 2 === 0 ? (lo + hi) / 2 : hi
}

type Facet = 'collection' | 'network'

function matches(nft: Nft, q: CatalogQuery, ctx: { likesMedian: number }, skip?: Facet): boolean {
  if (q.q) {
    const term = q.q.toLowerCase()
    const haystack = [
      nft.name,
      nft.creator.name,
      nft.creator.handle,
      COLLECTION_LABELS[nft.collection],
    ]
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(term)) return false
  }
  // OR dentro da faceta, AND entre facetas.
  if (skip !== 'collection' && q.collection?.length && !q.collection.includes(nft.collection)) {
    return false
  }
  if (skip !== 'network' && q.network?.length && !q.network.includes(nft.network)) return false
  if (q.priceMin && compareEth(nft.priceEth, q.priceMin) < 0) return false
  if (q.priceMax && compareEth(nft.priceEth, q.priceMax) > 0) return false
  if (q.tab === 'new') {
    const seedClock = Date.parse(getDb().meta.seedClock)
    if (Date.parse(nft.createdAt) < seedClock - NEW_WINDOW_MS) return false
  }
  if (q.tab === 'trending' && nft.badge !== 'em-alta' && nft.likes <= ctx.likesMedian) return false
  return true
}

function sortNfts(items: Nft[], sort: CatalogQuery['sort']): Nft[] {
  const byId = (a: Nft, b: Nft) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return [...items].sort((a, b) => {
    let diff = 0
    if (sort === 'recent') diff = Date.parse(b.createdAt) - Date.parse(a.createdAt)
    else if (sort === 'price-asc') diff = compareEth(a.priceEth, b.priceEth)
    else if (sort === 'price-desc') diff = compareEth(b.priceEth, a.priceEth)
    else diff = b.likes - a.likes
    return diff !== 0 ? diff : byId(a, b)
  })
}

export function queryCatalog(q: CatalogQuery, opts: { empty: boolean }): CatalogPage {
  const source = opts.empty ? [] : allNfts()
  const everything = allNfts()
  const ctx = { likesMedian: median(everything.map((n) => n.likes)) }

  const filtered = sortNfts(
    source.filter((n) => matches(n, q, ctx)),
    q.sort,
  )
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / q.pageSize))
  const start = (q.page - 1) * q.pageSize

  // Facetas: cada uma aplica todos os filtros exceto o próprio (permite combinar com OR).
  const countBy = (facet: Facet, key: string) =>
    source.filter(
      (n) =>
        matches(n, q, ctx, facet) && (facet === 'collection' ? n.collection : n.network) === key,
    ).length

  let min: string | null = null
  let max: string | null = null
  for (const n of everything) {
    if (min === null || compareEth(n.priceEth, min) < 0) min = n.priceEth
    if (max === null || compareEth(n.priceEth, max) > 0) max = n.priceEth
  }

  return {
    items: filtered.slice(start, start + q.pageSize),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages,
    facets: {
      collections: collectionId.options.map((key) => ({ key, count: countBy('collection', key) })),
      networks: networkId.options.map((key) => ({ key, count: countBy('network', key) })),
      priceRange: { min: min ?? '0', max: max ?? '0' },
    },
  }
}

/**
 * Relacionados: primeiro a mesma coleção; como cada coleção tem 5 NFTs (4 além deste),
 * completa com a mesma rede para preencher a fileira de 5 cards do Figma.
 */
export function relatedNfts(nft: Nft, limit = 5): Nft[] {
  const others = allNfts().filter((n) => n.id !== nft.id)
  const sameCollection = others.filter((n) => n.collection === nft.collection)
  const sameNetwork = others.filter(
    (n) => n.collection !== nft.collection && n.network === nft.network,
  )
  return [...sameCollection, ...sameNetwork].slice(0, limit)
}

export function featured(opts: { empty: boolean }): { hero: Nft[]; spotlight: Nft | null } {
  if (opts.empty) return { hero: [], spotlight: null }
  const db = getDb()
  const spotlightId = db.meta.spotlightNftId
  return {
    hero: allNfts().filter((n) => n.featured),
    spotlight: spotlightId ? (db.nfts[spotlightId] ?? null) : null,
  }
}

// Mutações -------------------------------------------------------------------

export interface EditionPatch {
  id: string
  priceEth?: string
  available?: number
}

/**
 * Aplica mudanças de preço/disponibilidade, recalcula o preço de referência,
 * incrementa a versão, persiste e emite `nft.updated`.
 */
export function updateNft(
  nftId: string,
  patch: { priceEth?: string; editions?: EditionPatch[] },
): Nft {
  const nft = requireNft(nftId)
  for (const change of patch.editions ?? []) {
    const edition = findEdition(nft, change.id)
    if (!edition) throw problems.validation({ editions: [`Edição ${change.id} não existe.`] })
    if (change.priceEth !== undefined) edition.priceEth = change.priceEth
    if (change.available !== undefined) edition.available = Math.max(0, change.available)
  }
  // `priceEth` direto no NFT ajusta a edição mais barata (atalho do painel/testes).
  if (patch.priceEth !== undefined) {
    const cheapest = nft.editions.find((e) => e.priceEth === referencePrice(nft.editions))
    if (cheapest) cheapest.priceEth = patch.priceEth
  }
  touchNft(nft)
  return nft
}

/** Ajusta a disponibilidade de uma edição em `delta` (negativo = venda). */
export function adjustAvailability(nftId: string, editionId: string, delta: number): void {
  const nft = requireNft(nftId)
  const edition = findEdition(nft, editionId)
  if (!edition) return
  edition.available = Math.max(0, edition.available + delta)
  touchNft(nft)
}

function touchNft(nft: Nft): void {
  nft.priceEth = referencePrice(nft.editions)
  if (nft.compareAtPriceEth && compareEth(nft.compareAtPriceEth, nft.priceEth) <= 0) {
    nft.compareAtPriceEth = null
  }
  nft.version += 1
  commit()
  emitNftUpdated(nft)
}

export function emitNftUpdated(nft: Nft): void {
  mockEvents.emit({
    type: 'nft.updated',
    eventId: crypto.randomUUID(),
    emittedAt: nowIso(),
    resource: { kind: 'nft', id: nft.id },
    version: nft.version,
    payload: {
      priceEth: nft.priceEth,
      compareAtPriceEth: nft.compareAtPriceEth,
      editions: nft.editions.map((e) => ({
        id: e.id,
        priceEth: e.priceEth,
        available: e.available,
      })),
    },
  })
}

/**
 * Catálogo determinístico: 45 NFTs = 9 coleções x 5, distribuídos nas 3 redes.
 * Gerado com PRNG de semente fixa: o mesmo seed produz sempre o mesmo catálogo.
 *
 * Garantias usadas pelos testes:
 * - toda combinação coleção x rede tem ao menos um NFT;
 * - 45 itens = 5 páginas com pageSize 9;
 * - 2 NFTs com todas as edições esgotadas (SOLD_OUT_INDEXES);
 * - hero (featured) e destaque (spotlight) sempre disponíveis;
 * - preços entre 0.02 e 12.30 ETH (strings decimais, nunca number).
 */
import {
  COLLECTION_LABELS,
  NETWORK_LABELS,
  collectionId,
  networkId,
  type Nft,
  type NftEdition,
} from '@/api/contracts'
import { compareEth } from '@/lib/money'

import { createPrng, type Prng } from '../utils'
import { ratingOf, seedReviews } from './reviews'

/** Relógio do seed. A aba "Novos" considera os 30 dias anteriores a esta data. */
export const SEED_CLOCK = '2026-10-15T12:00:00.000Z'
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

const COLLECTIONS = collectionId.options
const NETWORKS = networkId.options

/** Os 8 primeiros reproduzem os nomes do Figma; o restante segue o mesmo estilo. */
const NAMES = [
  'Emerald Ape #042',
  'Sage Nomad #009',
  'Neon Vessel #552',
  'Cosmic Bloom #118',
  'Violet Nomad #314',
  'Ivory Baron #088',
  'Golden Beat #207',
  'Golden Signal #160',
]
const EXTRA_PREFIXES = [
  'Emerald Ape',
  'Sage Nomad',
  'Neon Vessel',
  'Cosmic Bloom',
  'Violet Nomad',
  'Ivory Baron',
  'Golden Beat',
  'Golden Signal',
  'Crimson Echo',
  'Azure Drift',
  'Velvet Oracle',
  'Lunar Tide',
  'Amber Relic',
  'Quartz Pilot',
  'Obsidian Muse',
]

const IMAGES = ['nft-emerald-ape', 'nft-sage-nomad', 'nft-neon-vessel', 'nft-golden-beat'] as const
type ImageName = (typeof IMAGES)[number]

function imageFor(name: string, index: number): ImageName {
  if (name.startsWith('Emerald')) return 'nft-emerald-ape'
  if (name.startsWith('Sage')) return 'nft-sage-nomad'
  if (name.startsWith('Neon')) return 'nft-neon-vessel'
  if (name.startsWith('Golden')) return 'nft-golden-beat'
  return IMAGES[index % IMAGES.length] ?? 'nft-emerald-ape'
}

function avatar(initial: string, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="32" fill="${color}"/>` +
    `<text x="32" y="41" font-family="monospace" font-size="26" font-weight="700" ` +
    `text-anchor="middle" fill="#0b0b0f">${initial}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const CREATORS: Nft['creator'][] = [
  { name: 'Marina Costa', handle: '@marinacosta', color: '#4ade80' },
  { name: 'Theo Andrade', handle: '@theo.andrade', color: '#a3e635' },
  { name: 'Lia Moreau', handle: '@liamoreau', color: '#facc15' },
  { name: 'Kenji Watanabe', handle: '@kenjiw', color: '#38bdf8' },
  { name: 'Rafa Nunes', handle: '@rafanunes', color: '#c084fc' },
  { name: 'Iara Lopes', handle: '@iaralopes', color: '#fb923c' },
  { name: 'Diego Prado', handle: '@diegoprado', color: '#f472b6' },
  { name: 'Nina Okafor', handle: '@ninaokafor', color: '#2dd4bf' },
].map((c) => ({ name: c.name, handle: c.handle, avatarUrl: avatar(c.name.charAt(0), c.color) }))

const EDITION_NAMES = ['Padrão', 'Limitada', 'Colecionador']
const BACKGROUNDS = ['Esmeralda', 'Grafite', 'Neon', 'Areia', 'Violeta', 'Dourado']
const RARITY = ['Comum', 'Rara', 'Lendária']

/** Índices com todas as edições esgotadas (Ivory Baron e afins: ver README). */
const SOLD_OUT_INDEXES = new Set([11, 29])
/** Hero da home. */
const FEATURED_INDEXES = new Set([0, 1, 2])
/** "NFT em destaque". */
const SPOTLIGHT_INDEX = 6
/** Preços fixos (centavos de ETH) para garantir os extremos da faixa e valores do layout. */
const PINNED_CENTS: Record<number, number> = { 0: 119, 1: 245, 2: 87, 6: 320, 17: 2, 33: 1230 }

const MAX_CENTS = 1230
const MIN_CENTS = 2

/** Converte centavos de ETH (inteiro) em string decimal, sem ponto flutuante. */
function centsToEth(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildNames(prng: Prng, total: number): string[] {
  const names = [...NAMES]
  const used = new Set(names)
  let i = 0
  while (names.length < total) {
    const prefix = EXTRA_PREFIXES[i % EXTRA_PREFIXES.length] ?? 'Emerald Ape'
    const name = `${prefix} #${String(prng.int(1, 999)).padStart(3, '0')}`
    if (!used.has(name)) {
      used.add(name)
      names.push(name)
    }
    i += 1
  }
  return names
}

export const NFT_COUNT = 45

/**
 * Preço de referência do NFT: menor preço entre as edições disponíveis
 * (ou entre todas, se todas estiverem esgotadas).
 */
export function referencePrice(
  editions: ReadonlyArray<Pick<NftEdition, 'priceEth' | 'available'>>,
): string {
  const pool = editions.some((e) => e.available > 0)
    ? editions.filter((e) => e.available > 0)
    : editions
  let best: string | null = null
  for (const e of pool) {
    if (best === null || compareEth(e.priceEth, best) < 0) best = e.priceEth
  }
  return best ?? '0'
}

export function createNfts(): { nfts: Nft[]; spotlightId: string } {
  const prng = createPrng(20261015)
  const names = buildNames(prng, NFT_COUNT)
  const seedClock = Date.parse(SEED_CLOCK)

  const nfts = names.map((name, index): Nft => {
    const id = `nft_${String(index + 1).padStart(3, '0')}`
    const collection = COLLECTIONS[index % COLLECTIONS.length] ?? 'arte-digital'
    const network = NETWORKS[Math.floor(index / COLLECTIONS.length) % NETWORKS.length] ?? 'ethereum'
    const image = imageFor(name, index)
    const others = IMAGES.filter((img) => img !== image)
    const galleryCount = prng.int(2, 3)
    const gallery = [
      `/images/${image}.webp`,
      ...others.slice(0, galleryCount - 1).map((o) => `/images/${o}.webp`),
    ]

    const r = prng.next()
    const baseCents =
      PINNED_CENTS[index] ??
      Math.max(MIN_CENTS, Math.round(MIN_CENTS + (MAX_CENTS - MIN_CENTS) * r * r))
    const soldOut = SOLD_OUT_INDEXES.has(index)
    const protectedStock = FEATURED_INDEXES.has(index) || index === SPOTLIGHT_INDEX
    const editionCount = soldOut ? 2 : prng.int(1, 3)
    const editions = Array.from({ length: editionCount }, (_, e): NftEdition => {
      const cents = Math.min(MAX_CENTS, baseCents * (e + 1))
      let available = prng.next() < 0.12 ? 0 : prng.int(1, 25)
      if (soldOut) available = 0
      if (protectedStock && available === 0) available = 8
      return {
        id: `${id}-ed${e + 1}`,
        name: EDITION_NAMES[e] ?? `Edição ${e + 1}`,
        priceEth: centsToEth(cents),
        available,
        maxPerOrder: prng.int(1, 5),
      }
    })
    // O hero aceita várias unidades por pedido (demonstração do seletor de quantidade).
    const firstEdition = editions[0]
    if (protectedStock && firstEdition) {
      firstEdition.maxPerOrder = 5
      firstEdition.available = Math.max(firstEdition.available, 10)
    }

    const hasCompare = prng.next() < 0.25
    const badgeRoll = prng.next()
    const badge =
      badgeRoll < 0.2 ? 'raro' : badgeRoll < 0.4 ? 'novo' : badgeRoll < 0.6 ? 'em-alta' : null
    const createdAt = new Date(seedClock - index * 2 * DAY_MS - prng.int(0, 20) * HOUR_MS)
    const creator = CREATORS[index % CREATORS.length] ?? CREATORS[0]
    if (!creator) throw new Error('criador ausente no seed')
    const priceEth = referencePrice(editions)
    const compareAt = centsToEth(Math.round((baseCents * 5) / 4))

    return {
      id,
      slug: slugify(name),
      name,
      description:
        `${name} é uma peça da coleção ${COLLECTION_LABELS[collection]}, cunhada na rede ` +
        `${NETWORK_LABELS[network]} por ${creator.name}. Cada edição dá acesso ao arquivo em ` +
        `alta resolução e ao certificado de autenticidade on-chain.`,
      collection,
      network,
      imageUrl: `/images/${image}.webp`,
      gallery,
      creator,
      priceEth,
      compareAtPriceEth: hasCompare && compareEth(compareAt, priceEth) > 0 ? compareAt : null,
      badge,
      editions,
      attributes: [
        { trait: 'Fundo', value: prng.pick(BACKGROUNDS) },
        { trait: 'Raridade', value: prng.pick(RARITY) },
        { trait: 'Edições', value: String(editionCount) },
      ],
      likes: prng.int(3, 480),
      rating: ratingOf(seedReviews()[id] ?? []),
      featured: FEATURED_INDEXES.has(index),
      createdAt: createdAt.toISOString(),
      version: 1,
    }
  })

  const spotlight = nfts[SPOTLIGHT_INDEX]
  if (!spotlight) throw new Error('spotlight ausente no seed')
  return { nfts, spotlightId: spotlight.id }
}

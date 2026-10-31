/**
 * Avaliações de colecionadores por NFT, determinísticas (PRNG de semente fixa).
 * Só leitura: não entram no banco simulado nem na persistência; o domínio lê daqui.
 *
 * Garantias usadas pelos testes e pelo layout:
 * - nft_001 (Emerald Ape #042) tem 19 avaliações com média 4.8, como no Figma;
 * - nft_003 (Neon Vessel #552) não tem avaliações (estado vazio);
 * - as demais variam de 0 a 24, com notas concentradas em 4 e 5.
 */
import type { NftRating, NftReview } from '@/api/contracts'

import { createPrng } from '../utils'

/** Mesmo relógio do seed do catálogo (`SEED_CLOCK` em ./nfts). */
const SEED_CLOCK_MS = Date.parse('2026-10-15T12:00:00.000Z')
const DAY_MS = 86_400_000
const NFT_COUNT = 45

const AUTHORS = [
  ['Beatriz Sales', '@bia.sales'],
  ['Caio Mendes', '@caiomendes'],
  ['Duda Ferraz', '@dudaferraz'],
  ['Enzo Takahashi', '@enzotk'],
  ['Flávia Rocha', '@flaviarocha'],
  ['Gael Monteiro', '@gaelm'],
  ['Helena Duarte', '@helenaduarte'],
  ['Ícaro Benitez', '@icarob'],
  ['Júlia Castro', '@juliacastro'],
  ['Lucas Faria', '@lucasfaria'],
  ['Maya Oliveira', '@mayaoliveira'],
  ['Otto Lindgren', '@ottol'],
] as const

const TITLES = [
  'Arte impecável',
  'Chegou na carteira em minutos',
  'Detalhes que só aparecem no zoom',
  'Peça central da minha coleção',
  'Boa procedência, boa cunhagem',
  'Cores ainda melhores no original',
  'Vale cada fração de ETH',
  'Edição rara, muito bem cuidada',
] as const

const BODIES = [
  'Comprei na edição padrão e a transferência apareceu na carteira antes de eu fechar a aba. O arquivo em alta resolução é enorme.',
  'A arte tem camadas que o preview não mostra: textura do fundo, reflexos nos óculos, detalhes do colar. Recomendo.',
  'Já tenho três peças desta coleção e esta é a que mais recebe perguntas. O certificado on-chain fechou a decisão.',
  'Preço justo para a raridade. A única ressalva é que a edição limitada esgotou rápido demais.',
  'Metadados completos e verificados. Gosto de saber de onde a peça veio antes de comprar.',
  'Ficou linda na moldura digital da sala. As cores em tela grande são mais vivas que na miniatura.',
  'Atendimento do criador no servidor da comunidade também conta: respondeu minhas dúvidas sobre direitos de uso.',
  'Levei para um evento de colecionadores e virou assunto. A composição funciona em qualquer tamanho.',
  'Demorei para decidir entre duas edições e não me arrependi da escolha. Peça com personalidade.',
  'Boa para quem está começando: preço acessível e coleção com histórico sólido.',
] as const

/** Notas concentradas em 4 e 5: coleção bem avaliada, com alguma variação. */
const RATING_POOL = [5, 5, 5, 4, 4, 4, 5, 3, 4, 2] as const

function nftIdAt(index: number): string {
  return `nft_${String(index + 1).padStart(3, '0')}`
}

export function ratingOf(reviews: readonly NftReview[]): NftRating {
  if (reviews.length === 0) return { average: 0, count: 0 }
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length }
}

function createReviews(): Record<string, NftReview[]> {
  const prng = createPrng(20261031)
  const byNft: Record<string, NftReview[]> = {}

  for (let index = 0; index < NFT_COUNT; index += 1) {
    const id = nftIdAt(index)
    let ratings: number[]
    if (index === 0) {
      // 15 notas 5 e 4 notas 4 = média 4.79, exibida como 4.8 (Figma: "4.8 (19)").
      ratings = [...Array<number>(15).fill(5), ...Array<number>(4).fill(4)]
    } else if (index === 2) {
      ratings = []
    } else {
      const count = prng.next() < 0.15 ? 0 : prng.int(2, 24)
      ratings = Array.from({ length: count }, () => prng.pick(RATING_POOL))
    }

    // Autores em ordem embaralhada por NFT: sem o mesmo nome em avaliações seguidas.
    const authors = [...AUTHORS]
    for (let i = authors.length - 1; i > 0; i -= 1) {
      const j = prng.int(0, i)
      const a = authors[i]
      const b = authors[j]
      if (a && b) {
        authors[i] = b
        authors[j] = a
      }
    }
    const reviews = ratings.map((rating, n): NftReview => {
      const [name, handle] = authors[n % authors.length] ?? AUTHORS[0]
      return {
        id: `rev_${id}_${n + 1}`,
        author: { name, handle },
        rating,
        title: prng.pick(TITLES),
        body: prng.pick(BODIES),
        createdAt: new Date(SEED_CLOCK_MS - prng.int(1, 300) * DAY_MS).toISOString(),
      }
    })
    reviews.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    byNft[id] = reviews
  }
  return byNft
}

let cache: Record<string, NftReview[]> | null = null

/** Avaliações por nftId. Calculadas uma vez; o resultado é sempre o mesmo. */
export function seedReviews(): Record<string, NftReview[]> {
  cache ??= createReviews()
  return cache
}

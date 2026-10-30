import type { Nft } from '@/api/contracts'

export const BADGE_LABELS: Record<NonNullable<Nft['badge']>, string> = {
  raro: 'RARO',
  novo: 'NOVO',
  'em-alta': 'EM ALTA',
}

/** "@handle", aceitando handles que já venham com "@" da API. */
export function formatHandle(handle: string): string {
  return `@${handle.replace(/^@/, '')}`
}

/** Texto alternativo padrão das artes: nome do NFT + criador. */
export function nftAlt(nft: Pick<Nft, 'name' | 'creator'>): string {
  return `${nft.name}, por ${nft.creator.name}`
}

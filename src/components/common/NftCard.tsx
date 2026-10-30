import { Link } from '@tanstack/react-router'

import type { Nft } from '@/api/contracts'
import { cn } from '@/lib/utils'

import { FavoriteButton } from './FavoriteButton'
import { BADGE_LABELS, nftAlt } from './nft-display'
import { NftImage } from './NftImage'
import { PriceTag } from './PriceTag'

interface NftCardProps {
  nft: Pick<
    Nft,
    'id' | 'slug' | 'name' | 'imageUrl' | 'creator' | 'priceEth' | 'compareAtPriceEth' | 'badge'
  >
  className?: string
  sizes?: string
  /** Primeiros cards acima da dobra: carregam a imagem com prioridade (LCP). */
  priority?: boolean
}

/**
 * Card do catálogo. O link cobre imagem, nome e preço; o coração é irmão do
 * link (nunca um botão dentro de um <a>).
 */
export function NftCard({ nft, className, sizes, priority = false }: NftCardProps) {
  return (
    <article className={cn('group relative', className)}>
      <Link
        to="/nft/$slug"
        params={{ slug: nft.slug }}
        className="block rounded-[20px] md:rounded-[4px]"
      >
        <div className="flex aspect-[175/200] items-center justify-center overflow-hidden rounded-[20px] bg-card md:aspect-[258/300] md:rounded-[4px]">
          <NftImage
            src={nft.imageUrl}
            alt={nftAlt(nft)}
            width={250}
            height={250}
            priority={priority}
            sizes={sizes ?? '(max-width: 767px) 45vw, (max-width: 1023px) 30vw, 250px'}
            className="aspect-square w-[calc(100%-7px)] rounded-[16px] object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.02] md:w-[calc(100%-8px)]"
          />
        </div>
        <div className="px-2 pt-2 md:px-0 md:pt-3">
          <h3 className="truncate text-sm leading-5 text-text-primary min-[400px]:text-[15px] md:text-base">
            {nft.name}
          </h3>
          <PriceTag
            price={nft.priceEth}
            compareAt={nft.compareAtPriceEth}
            className="mt-0 text-[15px] leading-5 md:mt-2 md:text-base"
          />
        </div>
      </Link>
      {nft.badge && (
        <span className="pointer-events-none absolute top-4 left-0 flex h-8 min-w-[68px] items-center bg-brand px-2 text-sm font-bold tracking-wide text-ink">
          {BADGE_LABELS[nft.badge]}
        </span>
      )}
      <FavoriteButton nftId={nft.id} nftName={nft.name} className="absolute top-3 right-3" />
    </article>
  )
}

export function NftCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col', className)}>
      <div className="skeleton aspect-[175/200] rounded-[20px] md:aspect-[258/300] md:rounded-[4px]" />
      <div className="px-2 pt-2 md:px-0 md:pt-3">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton mt-1 h-5 w-1/3 md:mt-2" />
      </div>
    </div>
  )
}

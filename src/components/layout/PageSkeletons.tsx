import { NftCardSkeleton } from '@/components/common/NftCard'
import { cn } from '@/lib/utils'

import { Container } from './Container'

/** Grade de skeletons com as mesmas dimensões dos cards (sem layout shift). */
export function CatalogGridSkeleton({
  count = 9,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div role="status" aria-label="Carregando NFTs" className={className}>
      <span className="sr-only">Carregando NFTs…</span>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:gap-x-[34px] md:gap-y-[72px]">
        {Array.from({ length: count }, (_, i) => (
          <NftCardSkeleton key={i} className={cn(i % 2 === 1 && 'max-sm:translate-y-8')} />
        ))}
      </div>
    </div>
  )
}

export function FiltersSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex justify-between px-3">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-4 w-8" />
        </div>
      ))}
    </div>
  )
}

/** Skeleton do detalhe do NFT, no mesmo grid da página real. */
export function NftDetailSkeleton() {
  return (
    <div role="status" aria-label="Carregando NFT">
      <span className="sr-only">Carregando NFT…</span>
      {/* Mobile */}
      <div className="md:hidden">
        <div className="bg-card px-7 pt-[66px] pb-[84px]">
          <div className="skeleton aspect-[361/356] w-full rounded-[24px]" />
        </div>
        <div className="-mt-[30px] space-y-4 rounded-t-[32px] bg-background px-6 pt-8">
          <div className="skeleton h-6 w-2/3" />
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-7 w-1/2" />
          <div className="skeleton h-20 w-3/4" />
        </div>
      </div>
      {/* Desktop/tablet */}
      <Container className="hidden pt-8 md:block">
        <div className="skeleton h-4 w-36" />
        <div className="mt-3 grid gap-8 lg:grid-cols-[573px_1fr]">
          <div className="flex gap-7">
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton size-[100px] rounded-[4px]" />
              ))}
            </div>
            <div className="skeleton aspect-square flex-1 rounded-[4px]" />
          </div>
          <div className="space-y-5">
            <div className="skeleton h-9 w-2/3" />
            <div className="skeleton h-6 w-1/3" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-8 w-1/2" />
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-24 w-2/3" />
          </div>
        </div>
        {/* Abas de descrição e "Relacionados": mantêm a altura da página real (evita o footer pular). */}
        <div className="mt-12 space-y-4">
          <div className="skeleton h-8 w-72" />
          <div className="skeleton h-40 w-full" />
        </div>
        <div className="mt-12">
          <div className="skeleton h-8 w-64" />
          <CatalogGridSkeleton count={3} className="mt-6 grid-cols-3" />
        </div>
      </Container>
    </div>
  )
}

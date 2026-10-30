import { useCallback, useEffect, useRef, useState } from 'react'

import type { Nft } from '@/api/contracts'
import { cn } from '@/lib/utils'

import { NftCard, NftCardSkeleton } from './NftCard'

interface NftRailProps {
  items: Nft[] | undefined
  loading?: boolean
  /** Nome acessível da fileira (normalmente o título da seção). */
  label: string
  className?: string
}

const SKELETON_COUNT = 5

/**
 * Fileira de cards dos blocos "Mais desta coleção" / "Colecionadores também viram".
 * Rola na horizontal com snap (2 cards no mobile, 3 no tablet, 5 em >= lg, preenchendo
 * os 1200px do Figma). Os pontos abaixo indicam a página visível e levam até ela; só
 * aparecem quando há mais de uma página, para não exibir controles que não fazem nada.
 */
export function NftRail({ items, loading = false, label, className }: NftRailProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  const measure = useCallback(() => {
    const list = listRef.current
    if (!list || list.clientWidth === 0) return
    const total = Math.max(1, Math.round(list.scrollWidth / list.clientWidth))
    setPages(total)
    const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2
    setPage(atEnd ? total - 1 : Math.round(list.scrollLeft / list.clientWidth))
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [measure, items?.length, loading])

  function goTo(index: number) {
    const list = listRef.current
    if (!list) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({ left: index * list.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  const itemClass =
    'w-[calc((100%-16px)/2)] shrink-0 snap-start sm:w-[calc((100%-32px)/3)] lg:w-[calc((100%-96px)/5)]'

  return (
    <div className={className}>
      <ul
        ref={listRef}
        aria-label={label}
        onScroll={measure}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] lg:gap-6 [&::-webkit-scrollbar]:hidden"
      >
        {loading
          ? Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <li key={i} className={itemClass}>
                <NftCardSkeleton />
              </li>
            ))
          : items?.map((nft) => (
              <li key={nft.id} className={itemClass}>
                <NftCard
                  nft={nft}
                  sizes="(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 220px"
                />
              </li>
            ))}
      </ul>

      {!loading && pages > 1 && (
        <div role="group" aria-label={`Páginas de ${label}`} className="mt-6 flex justify-center">
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Página ${index + 1} de ${pages}`}
              aria-current={index === page ? 'true' : undefined}
              className="flex size-6 items-center justify-center"
            >
              <span
                className={cn(
                  'block size-[11px] rounded-full border border-brand transition-colors',
                  index === page ? 'bg-brand' : 'bg-transparent',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

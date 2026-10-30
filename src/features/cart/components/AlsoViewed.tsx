import { useQuery } from '@tanstack/react-query'

import { catalogQuery, type Nft } from '@/api/contracts'
import { NftRail } from '@/components/common/NftRail'
import { catalogListOptions } from '@/features/catalog/queries'
import { relatedNftsOptions } from '@/features/nft/queries'
import { cn } from '@/lib/utils'

const LIMIT = 5
const FALLBACK_QUERY = catalogQuery.parse({ pageSize: LIMIT })

interface AlsoViewedProps {
  /** Slug do primeiro item do carrinho; sem ele (carrinho vazio) usa o catálogo. */
  slug: string | undefined
  className?: string
}

/**
 * "Colecionadores também viram" do Figma do carrinho: relacionados ao primeiro item
 * (GET /nfts/:slug/related) ou, com o carrinho vazio, a primeira página do catálogo.
 * Some quando não há nada para sugerir ou a consulta falha (bloco opcional).
 */
export function AlsoViewed({ slug, className }: AlsoViewedProps) {
  const related = useQuery({ ...relatedNftsOptions(slug ?? ''), enabled: !!slug })
  const fallback = useQuery({ ...catalogListOptions(FALLBACK_QUERY), enabled: !slug })
  const query = slug ? related : fallback

  const items: Nft[] | undefined = query.data?.items.slice(0, LIMIT)

  if (query.isError || (!query.isPending && !items?.length)) return null

  return (
    <section aria-labelledby="also-viewed-title" className={cn('mt-14 md:mt-20', className)}>
      <h2
        id="also-viewed-title"
        className="border-b border-border pb-3 text-base font-bold text-text-accent"
      >
        Colecionadores também viram
      </h2>
      <NftRail
        items={items}
        loading={query.isPending}
        label="Colecionadores também viram"
        className="mt-8"
      />
    </section>
  )
}

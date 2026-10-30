import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Loader2Icon, SlidersHorizontalIcon, XIcon } from 'lucide-react'

import type { CatalogPage, CatalogTab, Nft } from '@/api/contracts'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { NftCard } from '@/components/common/NftCard'
import { nftAlt } from '@/components/common/nft-display'
import { NftImage } from '@/components/common/NftImage'
import { Pagination } from '@/components/common/Pagination'
import { CatalogGridSkeleton } from '@/components/layout/PageSkeletons'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import { TAB_LABELS, hasActiveFilters } from '../catalog-search'
import { CATALOG_HEADING_ID, CATALOG_SECTION_ID, scrollToCatalog } from '../scroll-to-catalog'
import type { useCatalogSearch } from '../use-catalog-search'
import { CatalogFilters } from './CatalogFilters'
import { FiltersSheet } from './FiltersSheet'
import { SortSelect } from './SortSelect'

type CatalogSearchApi = ReturnType<typeof useCatalogSearch>

interface CatalogSectionProps extends CatalogSearchApi {
  query: UseQueryResult<CatalogPage>
  spotlight: Nft | null | undefined
  spotlightLoading: boolean
}

const TABS = Object.keys(TAB_LABELS) as CatalogTab[]

export function CatalogSection({
  query,
  spotlight,
  spotlightLoading,
  search,
  update,
  setPage,
  clearFilters,
}: CatalogSectionProps) {
  const { data, isLoading, isFetching, isPlaceholderData } = query
  const refreshing = isFetching && !isLoading

  return (
    <section
      id={CATALOG_SECTION_ID}
      aria-labelledby={CATALOG_HEADING_ID}
      className="mt-6 scroll-mt-6 md:mt-24 lg:grid lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start lg:gap-12"
    >
      <h2 id={CATALOG_HEADING_ID} tabIndex={-1} className="sr-only">
        Catálogo de NFTs
      </h2>

      <aside aria-label="Filtros do catálogo" className="hidden lg:block">
        <div className="rounded-[4px] bg-card px-2 py-5">
          <div className="px-3">
            <CatalogFilters
              search={search}
              facets={data?.facets}
              unavailable={query.isError && !data}
              update={update}
              onClear={clearFilters}
            />
          </div>
        </div>
        <SpotlightCard nft={spotlight} loading={spotlightLoading} />
      </aside>

      <Tabs
        value={search.tab}
        onValueChange={(tab) => update({ tab: tab as CatalogTab })}
        className="min-w-0 gap-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <TabsList
            variant="line"
            aria-label="Listas do catálogo"
            className="h-auto max-w-full justify-start gap-4 overflow-x-auto p-0 pb-1 md:gap-5"
          >
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-auto flex-none rounded-none border-0 px-0 py-1 text-sm font-bold text-text-primary after:bottom-[-3px] after:h-[2px] after:rounded-full after:bg-brand hover:text-text-accent data-[state=active]:bg-transparent data-[state=active]:text-text-accent md:text-sm"
              >
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-4">
            {refreshing && (
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Loader2Icon aria-hidden className="size-3.5 motion-safe:animate-spin" />
                Atualizando…
              </span>
            )}
            <div className="hidden md:block">
              <SortSelect value={search.sort} onChange={(sort) => update({ sort })} />
            </div>
            <div className="hidden md:block lg:hidden">
              <FiltersSheet
                search={search}
                facets={data?.facets}
                total={data?.total}
                update={update}
                onClear={clearFilters}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-[4px] border-border-soft bg-transparent"
                  >
                    <SlidersHorizontalIcon aria-hidden />
                    Filtros
                  </Button>
                }
              />
            </div>
          </div>
        </div>

        {search.q && (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            Resultados para
            <span className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-card py-0.5 pr-1 pl-3 text-text-primary">
              “{search.q}”
              <button
                type="button"
                onClick={() => update({ q: undefined })}
                aria-label={`Remover busca por ${search.q}`}
                className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface-dark"
              >
                <XIcon aria-hidden className="size-3.5" />
              </button>
            </span>
          </p>
        )}

        {TABS.map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6 md:mt-8">
            <Results
              query={query}
              stale={isPlaceholderData}
              onClear={clearFilters}
              canClear={hasActiveFilters(search)}
            />
          </TabsContent>
        ))}

        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={(page) => {
              void setPage(page)
              requestAnimationFrame(scrollToCatalog)
            }}
            className="mt-14 flex justify-center md:mt-[88px] md:justify-end"
          />
        )}
      </Tabs>
    </section>
  )
}

function Results({
  query,
  stale,
  onClear,
  canClear,
}: {
  query: UseQueryResult<CatalogPage>
  stale: boolean
  onClear: () => void
  canClear: boolean
}) {
  const { data, isLoading, isError, refetch, isRefetching } = query

  if (isLoading) return <CatalogGridSkeleton />

  if (isError && !data) {
    return (
      <ErrorState
        title="Não foi possível carregar o catálogo"
        description="Tivemos um problema ao buscar os NFTs. Verifique sua conexão e tente novamente."
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    )
  }

  if (!data) return <CatalogGridSkeleton />

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="Nenhum NFT encontrado"
        description="Nenhum resultado corresponde à combinação de busca e filtros. Ajuste os filtros ou limpe tudo para ver o catálogo completo."
        action={
          canClear ? (
            <Button type="button" onClick={onClear} className="rounded-[4px] font-bold">
              Limpar filtros
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <ul
      aria-busy={stale}
      aria-label={`${data.total} NFTs, página ${data.page} de ${data.totalPages}`}
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-6 pb-8 transition-opacity sm:grid-cols-3 sm:pb-0 md:gap-x-[34px] md:gap-y-[72px]',
        stale && 'opacity-60',
      )}
    >
      {data.items.map((nft, index) => (
        <li key={nft.id} className={cn(index % 2 === 1 && 'max-sm:translate-y-8')}>
          <NftCard nft={nft} />
        </li>
      ))}
    </ul>
  )
}

/** "NFT em destaque / OFERTA LIMITADA" da sidebar (featured.spotlight). */
function SpotlightCard({ nft, loading }: { nft: Nft | null | undefined; loading: boolean }) {
  if (!loading && !nft) return null
  return (
    <section aria-labelledby="spotlight-title" className="mt-6 pt-6">
      <h3
        id="spotlight-title"
        className="px-5 text-2xl leading-8 font-bold tracking-[0.02em] text-text-accent"
      >
        NFT EM DESTAQUE
      </h3>
      <p className="mt-4 text-center text-base font-bold tracking-[0.04em] text-text-primary">
        OFERTA LIMITADA
      </p>
      {loading || !nft ? (
        <div aria-hidden className="skeleton mt-4 h-[368px] rounded-[16px]" />
      ) : (
        <Link
          to="/nft/$slug"
          params={{ slug: nft.slug }}
          className="group relative mt-4 block overflow-hidden rounded-[16px]"
        >
          <NftImage
            src={nft.imageUrl}
            alt={nftAlt(nft)}
            width={310}
            height={368}
            sizes="310px"
            className="h-[368px] w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
          />
          <span className="absolute inset-x-3 bottom-3 rounded-[8px] bg-background/80 px-3 py-2 text-sm backdrop-blur-sm">
            <span className="block truncate font-bold text-text-primary">{nft.name}</span>
            <span className="text-text-accent">Ver oferta →</span>
          </span>
        </Link>
      )}
    </section>
  )
}

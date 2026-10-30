import { CheckIcon } from 'lucide-react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { useId, useState, type ReactNode } from 'react'

import {
  COLLECTION_LABELS,
  NETWORK_LABELS,
  type CatalogPage,
  type CollectionId,
  type NetworkId,
} from '@/api/contracts'
import { FiltersSkeleton } from '@/components/layout/PageSkeletons'
import { cn } from '@/lib/utils'

import { hasActiveFilters, type CatalogSearch } from '../catalog-search'
import type { useCatalogSearch } from '../use-catalog-search'

type Update = ReturnType<typeof useCatalogSearch>['update']

interface CatalogFiltersProps {
  search: CatalogSearch
  facets: CatalogPage['facets'] | undefined
  update: Update
  onClear: () => void
  /** A consulta falhou sem dados: mostra aviso em vez de skeletons infinitos. */
  unavailable?: boolean
  className?: string
}

const COLLECTIONS = Object.keys(COLLECTION_LABELS) as CollectionId[]
const NETWORKS = Object.keys(NETWORK_LABELS) as NetworkId[]

function toggle<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? []
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}

/**
 * Filtros combináveis (coleção, faixa de preço, rede). Os contadores vêm das
 * facets da resposta de GET /nfts. Toda mudança volta para a página 1.
 */
export function CatalogFilters({
  search,
  facets,
  update,
  onClear,
  unavailable = false,
  className,
}: CatalogFiltersProps) {
  if (!facets && unavailable) {
    return (
      <p className={cn('px-3 text-sm text-text-secondary', className)}>
        Os filtros ficam disponíveis assim que o catálogo carregar.
      </p>
    )
  }
  const collectionCounts = new Map(facets?.collections.map((f) => [f.key, f.count]))
  const networkCounts = new Map(facets?.networks.map((f) => [f.key, f.count]))

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <FilterGroup title="Coleções">
        {facets ? (
          <ul>
            {COLLECTIONS.map((id) => (
              <li key={id}>
                <FilterOption
                  label={COLLECTION_LABELS[id]}
                  count={collectionCounts.get(id) ?? 0}
                  active={search.collection?.includes(id) ?? false}
                  boldCount
                  onClick={() => update({ collection: toggle(search.collection, id) })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <FiltersSkeleton />
        )}
      </FilterGroup>

      <FilterGroup title="Faixa de preço">
        {facets ? (
          <PriceFilter
            key={`${facets.priceRange.min}-${facets.priceRange.max}-${search.priceMin}-${search.priceMax}`}
            range={facets.priceRange}
            priceMin={search.priceMin}
            priceMax={search.priceMax}
            onApply={(priceMin, priceMax) => update({ priceMin, priceMax })}
          />
        ) : (
          <div aria-hidden className="skeleton mx-3 h-16" />
        )}
      </FilterGroup>

      <FilterGroup title="Rede">
        {facets ? (
          <ul>
            {NETWORKS.map((id) => (
              <li key={id}>
                <FilterOption
                  label={NETWORK_LABELS[id]}
                  count={networkCounts.get(id) ?? 0}
                  active={search.network?.includes(id) ?? false}
                  onClick={() => update({ network: toggle(search.network, id) })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div aria-hidden className="skeleton mx-3 h-24" />
        )}
      </FilterGroup>

      {hasActiveFilters(search) && (
        <button
          type="button"
          onClick={onClear}
          className="self-start px-3 text-sm font-medium text-text-accent underline underline-offset-4 hover:text-brand"
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-3 text-base font-bold tracking-[0.02em] text-text-primary">
        {title}
      </h3>
      {children}
    </section>
  )
}

function FilterOption({
  label,
  count,
  active,
  boldCount = false,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  boldCount?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-[4px] px-3 text-left text-sm transition-colors hover:bg-surface-dark/60',
        active ? 'font-medium text-text-accent' : 'text-text-secondary hover:text-text-primary',
      )}
    >
      <span className="flex items-center gap-2">
        {active && <CheckIcon aria-hidden className="size-3.5" strokeWidth={3} />}
        {label}
      </span>
      <span className={cn('tabular-nums', boldCount && 'font-bold')}>
        <span className="sr-only">, </span>({count})
      </span>
    </button>
  )
}

const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function PriceFilter({
  range,
  priceMin,
  priceMax,
  onApply,
}: {
  range: { min: string; max: string }
  priceMin: string | undefined
  priceMax: string | undefined
  onApply: (priceMin: string | undefined, priceMax: string | undefined) => void
}) {
  const labelId = useId()
  // Limites em centésimos (passo do slider = 0,01 ETH). O valor aplicado na
  // URL sempre cabe no slider, mesmo que as facets tenham mudado.
  const appliedMin = priceMin ? Number(priceMin) : undefined
  const appliedMax = priceMax ? Number(priceMax) : undefined
  const lo = Math.floor(Math.min(Number(range.min), appliedMin ?? Infinity) * 100) / 100
  const hi = Math.ceil(Math.max(Number(range.max), appliedMax ?? -Infinity) * 100) / 100
  const [values, setValues] = useState<[number, number]>([appliedMin ?? lo, appliedMax ?? hi])
  const disabled = !(hi > lo)

  function apply() {
    const [min, max] = values
    onApply(min > lo ? min.toFixed(2) : undefined, max < hi ? max.toFixed(2) : undefined)
  }

  return (
    <div className="px-3">
      <span id={labelId} className="sr-only">
        Faixa de preço em ETH
      </span>
      <SliderPrimitive.Root
        min={lo}
        max={hi}
        step={0.01}
        minStepsBetweenThumbs={0}
        value={values}
        onValueChange={(next) => setValues([next[0] ?? lo, next[1] ?? hi])}
        disabled={disabled}
        aria-labelledby={labelId}
        className="relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50"
      >
        <SliderPrimitive.Track className="relative h-[3px] grow rounded-full bg-brand/35">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-brand" />
        </SliderPrimitive.Track>
        {(['Preço mínimo', 'Preço máximo'] as const).map((label, i) => (
          <SliderPrimitive.Thumb
            key={label}
            aria-label={label}
            aria-valuetext={`${brl.format(values[i]!)} ETH`}
            className="block size-[14px] rounded-full border-2 border-ink bg-brand shadow outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          />
        ))}
      </SliderPrimitive.Root>
      <p className="mt-3 text-sm text-text-primary">
        Preço: {brl.format(values[0])} - {brl.format(values[1])} ETH
      </p>
      <button
        type="button"
        onClick={apply}
        disabled={disabled}
        className="mt-3 h-8 rounded-[4px] bg-brand px-3 text-sm font-bold text-ink transition-colors hover:bg-brand/90 disabled:opacity-50"
      >
        Aplicar
      </button>
    </div>
  )
}

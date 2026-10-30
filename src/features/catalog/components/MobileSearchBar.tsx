import { SearchIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import type { CatalogPage } from '@/api/contracts'

import type { useCatalogSearch } from '../use-catalog-search'
import { FiltersSheet } from './FiltersSheet'

type CatalogSearchApi = ReturnType<typeof useCatalogSearch>

interface MobileSearchBarProps extends CatalogSearchApi {
  facets: CatalogPage['facets'] | undefined
  total: number | undefined
}

const DEBOUNCE_MS = 350

/**
 * Busca do Figma mobile. Digitar atualiza `?q=` com debounce (replace no
 * histórico, para não empilhar uma entrada por tecla). O botão ao lado abre
 * o drawer de filtros.
 */
export function MobileSearchBar({
  search,
  update,
  clearFilters,
  facets,
  total,
}: MobileSearchBarProps) {
  const inputId = useId()
  const [value, setValue] = useState(search.q ?? '')
  const lastPushed = useRef(search.q ?? '')

  // URL mudou por fora (voltar/avançar, limpar filtros): reflete no campo.
  useEffect(() => {
    const q = search.q ?? ''
    if (q !== lastPushed.current) {
      lastPushed.current = q
      setValue(q)
    }
  }, [search.q])

  useEffect(() => {
    const next = value.trim()
    if (next === lastPushed.current) return
    const timer = window.setTimeout(() => {
      lastPushed.current = next
      void update({ q: next || undefined }, { replace: true })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [value, update])

  return (
    <div className="flex h-[45px] items-center gap-2 md:hidden">
      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-card px-3"
      >
        <SearchIcon aria-hidden className="size-[22px] shrink-0 text-text-secondary" />
        <label htmlFor={inputId} className="sr-only">
          Explorar coleções
        </label>
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Explorar coleções"
          autoComplete="off"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-text-primary placeholder:text-text-secondary focus-visible:outline-none"
        />
      </form>
      <FiltersSheet
        search={search}
        facets={facets}
        total={total}
        update={update}
        onClear={clearFilters}
        trigger={
          <button
            type="button"
            aria-label="Abrir filtros"
            className="flex size-[45px] shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-b from-[#e0a46a] to-brand text-ink"
          >
            <SlidersHorizontalIcon aria-hidden className="size-[22px]" />
          </button>
        }
      />
    </div>
  )
}

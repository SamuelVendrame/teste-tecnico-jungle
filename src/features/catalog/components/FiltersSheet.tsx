import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import type { CatalogPage } from '@/api/contracts'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import type { CatalogSearch } from '../catalog-search'
import type { useCatalogSearch } from '../use-catalog-search'
import { CatalogFilters } from './CatalogFilters'
import { SortSelect } from './SortSelect'

interface FiltersSheetProps {
  trigger: ReactNode
  search: CatalogSearch
  facets: CatalogPage['facets'] | undefined
  total: number | undefined
  update: ReturnType<typeof useCatalogSearch>['update']
  onClear: () => void
}

/** Filtros em drawer (< 1024px). Radix Dialog cuida do foco e do Esc. */
export function FiltersSheet({
  trigger,
  search,
  facets,
  total,
  update,
  onClear,
}: FiltersSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(100%,360px)] gap-0 border-border-soft bg-card p-0 sm:max-w-[360px]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <SheetTitle className="text-lg font-bold">Filtros</SheetTitle>
          <SheetClose
            aria-label="Fechar filtros"
            className="inline-flex size-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
          >
            <XIcon aria-hidden className="size-5" />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          Refine o catálogo por coleção, faixa de preço e rede.
        </SheetDescription>
        <div className="flex-1 overflow-y-auto px-2 py-5">
          <div className="mb-8 px-3">
            <SortSelect value={search.sort} onChange={(sort) => update({ sort })} block />
          </div>
          <CatalogFilters search={search} facets={facets} update={update} onClear={onClear} />
        </div>
        <div className="border-t border-border p-4">
          <SheetClose className="h-11 w-full rounded-[4px] bg-brand font-bold text-ink hover:bg-brand/90">
            {total === undefined
              ? 'Ver resultados'
              : `Ver ${total} ${total === 1 ? 'resultado' : 'resultados'}`}
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  )
}

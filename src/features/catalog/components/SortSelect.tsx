import { useId } from 'react'

import type { CatalogSort } from '@/api/contracts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { SORT_LABELS } from '../catalog-search'

interface SortSelectProps {
  value: CatalogSort
  onChange: (value: CatalogSort) => void
  /** Versão em bloco (drawer de filtros) em vez de texto inline (toolbar). */
  block?: boolean
}

export function SortSelect({ value, onChange, block = false }: SortSelectProps) {
  const labelId = useId()
  return (
    <div className={cn('flex items-center gap-1', block && 'flex-col items-stretch gap-2')}>
      <span
        id={labelId}
        className={cn('text-sm text-text-primary', block && 'text-base font-bold')}
      >
        Ordenar por:
      </span>
      <Select value={value} onValueChange={(next) => onChange(next as CatalogSort)}>
        <SelectTrigger
          aria-labelledby={labelId}
          className={cn(
            'text-sm text-text-primary [&_svg:not([class*=text-])]:text-text-primary',
            block
              ? 'h-10 w-full border-border-soft bg-surface-dark/50'
              : 'h-auto border-0 bg-transparent px-0 py-0 shadow-none hover:text-text-accent',
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end" className="border-border-soft bg-card">
          {(Object.keys(SORT_LABELS) as CatalogSort[]).map((sort) => (
            <SelectItem key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

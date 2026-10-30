import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

/** Páginas visíveis: primeira, última e uma janela ao redor da atual. */
function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= totalPages - 2)
    [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out: Array<number | 'gap'> = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('gap')
    out.push(p)
  })
  return out
}

const item =
  'inline-flex size-[35px] items-center justify-center rounded-[4px] border text-sm tabular-nums transition-colors'

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação do catálogo" className={className}>
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              aria-label="Página anterior"
              className={cn(item, 'border-border-soft text-text-primary hover:border-brand')}
            >
              <ChevronLeftIcon aria-hidden className="size-[18px]" />
            </button>
          </li>
        )}
        {pageWindow(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-text-secondary">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-label={`Página ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  item,
                  p === page
                    ? 'border-brand bg-brand font-bold text-ink'
                    : 'border-border-soft text-text-primary hover:border-brand',
                )}
              >
                {p}
              </button>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              aria-label="Próxima página"
              className={cn(item, 'border-border-soft text-text-primary hover:border-brand')}
            >
              <ChevronRightIcon aria-hidden className="size-[18px]" />
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}

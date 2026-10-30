import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ScreenHeaderProps {
  title: string
  /** Destino quando não há histórico para voltar (acesso direto). */
  fallbackTo: '/' | '/cart'
  className?: string
}

/** Cabeçalho mobile do Figma ("Screen Header"): voltar + título. Some a partir de 768px. */
export function ScreenHeader({ title, fallbackTo, className }: ScreenHeaderProps) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const backClass =
    'inline-flex size-[35px] shrink-0 items-center justify-center rounded-full bg-surface-dark text-text-secondary hover:text-text-primary'
  return (
    <div className={cn('flex h-11 items-center gap-4 md:hidden', className)}>
      {canGoBack ? (
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Voltar"
          className={backClass}
        >
          <ChevronLeftIcon aria-hidden className="size-5" />
        </button>
      ) : (
        <Link to={fallbackTo} aria-label="Voltar" className={backClass}>
          <ChevronLeftIcon aria-hidden className="size-5" />
        </Link>
      )}
      <h1 className="flex-1 truncate text-center text-lg font-bold text-text-primary">{title}</h1>
    </div>
  )
}

interface BreadcrumbProps {
  current: string
  className?: string
}

/** Trilha "Início / Mercado / <página>" do Figma desktop. */
export function PurchaseBreadcrumb({ current, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Trilha de navegação" className={cn('hidden md:block', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-text-primary">
        <li>
          <Link to="/" className="hover:text-text-accent">
            Início
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li>
          <Link to="/" hash="catalogo" className="hover:text-text-accent">
            Mercado
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  )
}

import { useMatchRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { scrollToCatalog } from '@/features/catalog/scroll-to-catalog'

/**
 * Ícone de busca do header desktop. Abre um campo de busca ancorado no ícone;
 * ao enviar, leva ao catálogo com `?q=` (no início, mantém os demais filtros e
 * volta para a página 1). Esc fecha e devolve o foco ao ícone.
 */
export function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const inputId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const onHome = Boolean(matchRoute({ to: '/' }))
  const currentQ = useRouterState({
    select: (state) => {
      const q = (state.location.search as { q?: unknown }).q
      return typeof q === 'string' ? q : ''
    },
  })
  const [value, setValue] = useState(currentQ)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function toggle() {
    if (!open) setValue(onHome ? currentQ : '')
    setOpen(!open)
  }

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const q = value.trim() || undefined
    if (onHome) {
      await navigate({
        to: '/',
        search: (prev) => ({ ...prev, q, page: undefined }),
        resetScroll: false,
      })
    } else {
      await navigate({ to: '/', search: { q } })
    }
    setOpen(false)
    requestAnimationFrame(scrollToCatalog)
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(event) => {
        if (open && !wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          close(true)
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? 'Fechar busca' : 'Buscar NFTs'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="inline-flex size-9 items-center justify-center rounded-full text-text-primary transition-colors hover:text-text-accent"
      >
        {open ? (
          <XIcon aria-hidden className="size-5" />
        ) : (
          <SearchIcon aria-hidden className="size-5" />
        )}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-[calc(100%+10px)] right-0 z-50 w-[min(340px,calc(100vw-32px))] rounded-lg border border-border-soft bg-card p-2 shadow-xl shadow-black/40"
      >
        <form role="search" onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            Buscar NFTs por nome, criador ou coleção
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Buscar NFTs…"
            autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded-[4px] border border-border-soft bg-surface-dark/60 px-3 text-sm text-text-primary placeholder:text-text-secondary/70"
          />
          <button
            type="submit"
            className="h-9 rounded-[4px] bg-brand px-3 text-sm font-bold text-ink hover:bg-brand/90"
          >
            Buscar
          </button>
        </form>
      </div>
    </div>
  )
}

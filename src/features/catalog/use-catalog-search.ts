import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'

import type { CatalogSearch, CatalogSearchInput } from './catalog-search'

type Patch = Omit<CatalogSearchInput, 'page' | 'pageSize'>

/**
 * Lê e escreve o estado do catálogo na URL (fonte única da verdade).
 * Qualquer mudança de busca, filtro, ordenação ou aba volta para a página 1;
 * só `setPage` muda a página. Arrays vazios viram `undefined` (fora da URL) e
 * são ordenados para que a mesma seleção gere a mesma chave de cache.
 */
export function useCatalogSearch() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })

  const update = useCallback(
    (patch: Patch, opts: { replace?: boolean } = {}) =>
      navigate({
        search: (prev) => normalize({ ...prev, ...patch, page: undefined }),
        replace: opts.replace,
        resetScroll: false,
      }),
    [navigate],
  )

  const setPage = useCallback(
    (page: number) => navigate({ search: (prev) => ({ ...prev, page }), resetScroll: false }),
    [navigate],
  )

  const clearFilters = useCallback(
    () =>
      navigate({
        search: (prev) => ({ sort: prev.sort, tab: prev.tab }),
        resetScroll: false,
      }),
    [navigate],
  )

  return { search, update, setPage, clearFilters }
}

function normalize<T extends CatalogSearchInput>(search: T): T {
  const out = { ...search }
  if (out.collection)
    out.collection = out.collection.length ? [...out.collection].sort() : undefined
  if (out.network) out.network = out.network.length ? [...out.network].sort() : undefined
  if (typeof out.q === 'string' && !out.q.trim()) out.q = undefined
  return out
}

export type { CatalogSearch }

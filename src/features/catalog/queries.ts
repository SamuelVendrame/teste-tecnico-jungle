import { queryOptions } from '@tanstack/react-query'

import type { CatalogQuery } from '@/api/contracts'
import { nftApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/query-keys'

/**
 * A chave inclui todos os parâmetros da consulta: cada combinação de filtros
 * tem seu próprio cache. O `signal` é repassado ao Axios, então a requisição de
 * uma combinação abandonada é cancelada e uma resposta atrasada nunca
 * sobrescreve a tela atual (respostas fora de ordem).
 */
export const catalogListOptions = (query: CatalogQuery) =>
  queryOptions({
    queryKey: queryKeys.nfts.list(query),
    queryFn: ({ signal }) => nftApi.list(query, { signal }),
  })

export const featuredOptions = () =>
  queryOptions({
    queryKey: queryKeys.nfts.featured(),
    queryFn: ({ signal }) => nftApi.featured({ signal }),
    staleTime: 5 * 60_000,
  })

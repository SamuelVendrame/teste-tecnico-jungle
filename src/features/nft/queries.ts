import { queryOptions } from '@tanstack/react-query'

import { nftApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/query-keys'

export const nftDetailOptions = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.detail(slug),
    queryFn: ({ signal }) => nftApi.bySlug(slug, { signal }),
  })

export const relatedNftsOptions = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.nfts.related(slug),
    queryFn: ({ signal }) => nftApi.related(slug, { signal }),
    staleTime: 5 * 60_000,
  })

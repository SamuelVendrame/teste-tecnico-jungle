import { createFileRoute, notFound } from '@tanstack/react-router'

import { isApiClientError } from '@/api/client'
import { NftDetailSkeleton } from '@/components/layout/PageSkeletons'
import { RouteError } from '@/components/layout/RouteStates'
import { NftNotFound } from '@/features/nft/components/NftNotFound'
import { NftDetailPage } from '@/features/nft/NftDetailPage'
import { nftDetailOptions, relatedNftsOptions } from '@/features/nft/queries'

export const Route = createFileRoute('/nft/$slug')({
  loader: async ({ context: { queryClient }, params: { slug } }) => {
    void queryClient.prefetchQuery(relatedNftsOptions(slug))
    try {
      await queryClient.ensureQueryData(nftDetailOptions(slug))
    } catch (error) {
      // NFT inexistente: estado "não encontrado" dentro da própria página.
      if (isApiClientError(error) && (error.code === 'NOT_FOUND' || error.status === 404)) {
        throw notFound()
      }
      throw error
    }
  },
  pendingComponent: NftDetailSkeleton,
  pendingMs: 200,
  notFoundComponent: NftNotFound,
  errorComponent: ({ reset }) => (
    <RouteError reset={reset} title="Não foi possível carregar este NFT" />
  ),
  component: function NftDetailRoute() {
    const { slug } = Route.useParams()
    return <NftDetailPage slug={slug} />
  },
})

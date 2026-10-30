import { useQuery } from '@tanstack/react-query'

import { NftCard, NftCardSkeleton } from '@/components/common/NftCard'
import { Button } from '@/components/ui/button'

import { relatedNftsOptions } from '../queries'

/** "Mais desta coleção" (GET /nfts/:slug/related). Some quando não há itens. */
export function RelatedNfts({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useQuery(relatedNftsOptions(slug))
  const items = data?.items.filter((nft) => nft.slug !== slug).slice(0, 5)

  if (!isLoading && !isError && !items?.length) return null

  return (
    <section aria-labelledby="related-title" className="mt-16 md:mt-24">
      <h2
        id="related-title"
        className="border-b border-border pb-3 text-base font-bold text-text-accent"
      >
        Mais desta coleção
      </h2>
      {isError ? (
        <div className="mt-6 flex items-center gap-3 text-sm text-text-secondary" role="alert">
          Não foi possível carregar NFTs relacionados.
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            className="rounded-[4px] border-border-soft bg-transparent"
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-6">
          {isLoading
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i}>
                  <NftCardSkeleton />
                </li>
              ))
            : items!.map((nft) => (
                <li key={nft.id}>
                  <NftCard nft={nft} sizes="(max-width: 767px) 45vw, 220px" />
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}

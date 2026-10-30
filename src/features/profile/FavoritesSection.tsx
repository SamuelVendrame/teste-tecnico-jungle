import { Link } from '@tanstack/react-router'
import { HeartIcon } from 'lucide-react'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { NftCard, NftCardSkeleton } from '@/components/common/NftCard'
import { Button } from '@/components/ui/button'
import { useFavorites } from '@/features/favorites/use-favorites'

import { useFavoriteNfts } from './use-profile'

/** Favoritos do usuário. O coração do card remove o favorito (otimista) e o card sai da grade. */
export function FavoritesSection() {
  const nfts = useFavoriteNfts()
  const favorites = useFavorites()

  // Segue o estado otimista: desfavoritar tira o card antes do refetch terminar.
  const favoriteIds = favorites.data ? new Set(favorites.data.nftIds) : null
  const items = (nfts.data?.items ?? []).filter((nft) => !favoriteIds || favoriteIds.has(nft.id))

  return (
    <section id="favoritos" aria-labelledby="favoritos-title" className="scroll-mt-24 space-y-5">
      <h2 id="favoritos-title" className="text-base font-bold text-text-primary">
        Favoritos
      </h2>
      {nfts.isPending ? (
        <div role="status" aria-label="Carregando favoritos">
          <span className="sr-only">Carregando favoritos…</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-7 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <NftCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : nfts.isError ? (
        <ErrorState
          title="Não foi possível carregar seus favoritos"
          onRetry={() => void nfts.refetch()}
          retrying={nfts.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Você ainda não favoritou nenhum NFT"
          description="Toque no coração de um NFT para guardá-lo aqui."
          icon={<HeartIcon />}
          action={
            <Button asChild className="rounded-sm font-bold">
              <Link to="/">Explorar NFTs</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-7 xl:grid-cols-4">
          {items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} sizes="(max-width: 767px) 45vw, (max-width: 1279px) 25vw, 200px" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

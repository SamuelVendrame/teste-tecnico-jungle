import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { Nft, NftReview } from '@/api/contracts'
import { formatRating, ratingLabel, StarRating } from '@/components/common/StarRating'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { nftReviewsOptions } from '../queries'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })
/** Avaliações mostradas por vez; o restante entra por "Mostrar mais". */
const PAGE = 6

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function ReviewItem({ review }: { review: NftReview }) {
  return (
    <article
      aria-label={`Avaliação de ${review.author.name}`}
      className="grid gap-3 border-b border-border-soft py-5 last:border-b-0 sm:grid-cols-[auto_1fr]"
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-surface-dark"
      >
        {initials(review.author.name)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-bold text-text-primary">{review.author.name}</span>
          <span className="text-xs text-text-secondary">{review.author.handle}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <StarRating value={review.rating} />
            <span className="sr-only">{review.rating} de 5</span>
          </span>
          <time dateTime={review.createdAt}>{dateFormat.format(new Date(review.createdAt))}</time>
        </div>
        <p className="mt-2 text-sm font-bold text-text-primary">{review.title}</p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{review.body}</p>
      </div>
    </article>
  )
}

function ReviewsSkeleton() {
  return (
    <div role="status" aria-label="Carregando avaliações" className="grid gap-5">
      <span className="sr-only">Carregando avaliações…</span>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-16" />
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Aba "Avaliações de colecionadores" (GET /nfts/:slug/reviews, carregada ao abrir a aba). */
export function NftReviews({ nft }: { nft: Nft }) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery(nftReviewsOptions(nft.slug))
  const [visible, setVisible] = useState(PAGE)

  if (isLoading) return <ReviewsSkeleton />

  // Falha sem dados: alerta com nova tentativa. Falha num refetch em segundo plano mantém a lista.
  if (!data) {
    return (
      <div
        className="flex flex-wrap items-center gap-3 text-sm text-text-secondary"
        role="alert"
        aria-busy={isFetching}
      >
        {isError ? 'Não foi possível carregar as avaliações.' : 'Avaliações indisponíveis.'}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-[4px] border-border-soft bg-transparent"
        >
          {isFetching ? 'Tentando novamente…' : 'Tentar novamente'}
        </Button>
      </div>
    )
  }

  const { rating, items } = data
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Este NFT ainda não tem avaliações de colecionadores.
      </p>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[32px] leading-none font-bold text-text-accent">
          {formatRating(rating.average)}
        </span>
        <StarRating value={rating.average} starClassName="size-5" />
        <span className="text-sm text-text-secondary">
          <span className="sr-only">{ratingLabel(rating.average, rating.count)}. </span>
          <span aria-hidden>
            {rating.count} {rating.count === 1 ? 'avaliação' : 'avaliações'} de colecionadores
          </span>
        </span>
      </div>
      <div className="mt-2">
        {items.slice(0, visible).map((review) => (
          <ReviewItem key={review.id} review={review} />
        ))}
      </div>
      {items.length > visible && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-4 rounded-[4px] border-border-soft bg-transparent"
        >
          Mostrar mais avaliações ({items.length - visible}{' '}
          {items.length - visible === 1 ? 'restante' : 'restantes'})
        </Button>
      )}
    </div>
  )
}

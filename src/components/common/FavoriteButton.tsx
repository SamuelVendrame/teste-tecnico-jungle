import { useNavigate, useRouterState } from '@tanstack/react-router'
import { HeartIcon } from 'lucide-react'

import { useSession } from '@/features/session/session-store'
import { useIsFavorite, useToggleFavorite } from '@/features/favorites/use-favorites'
import { cn } from '@/lib/utils'

import { announce } from './announce'

interface FavoriteButtonProps {
  nftId: string
  nftName: string
  /** `icon`: círculo com coração (cards e mobile). `labeled`: botão "Favoritar" do detalhe. */
  variant?: 'icon' | 'labeled'
  className?: string
}

/**
 * Coração de favorito com atualização otimista (ver use-favorites.ts).
 * Visitante: leva ao login com `returnTo` apontando para a página atual.
 */
export function FavoriteButton({
  nftId,
  nftName,
  variant = 'icon',
  className,
}: FavoriteButtonProps) {
  const session = useSession()
  const navigate = useNavigate()
  const href = useRouterState({ select: (state) => state.location.href })
  const isFavorite = useIsFavorite(nftId)
  const toggle = useToggleFavorite()
  const authenticated = session.status === 'authenticated'

  function handleClick() {
    if (!authenticated) {
      void navigate({ to: '/login', search: { returnTo: href } })
      return
    }
    const favorite = !isFavorite
    toggle.mutate(
      { nftId, favorite },
      {
        onSuccess: () =>
          announce(
            favorite ? `${nftName} adicionado aos favoritos` : `${nftName} removido dos favoritos`,
          ),
      },
    )
  }

  const label = isFavorite
    ? `Remover ${nftName} dos favoritos`
    : `Adicionar ${nftName} aos favoritos`

  if (variant === 'labeled') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={authenticated ? isFavorite : undefined}
        aria-label={label}
        className={cn(
          'inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-brand px-2 text-[15px] text-text-primary transition-colors hover:bg-brand/10',
          className,
        )}
      >
        <HeartIcon
          aria-hidden
          className={cn('size-5 shrink-0', isFavorite ? 'fill-brand text-brand' : 'text-brand')}
        />
        {isFavorite ? 'Favoritado' : 'Favoritar'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={authenticated ? isFavorite : undefined}
      aria-label={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-full border border-border-soft bg-background/80 text-brand backdrop-blur-sm transition-colors hover:bg-background',
        className,
      )}
    >
      <HeartIcon aria-hidden className={cn('size-4', isFavorite && 'fill-brand')} />
    </button>
  )
}

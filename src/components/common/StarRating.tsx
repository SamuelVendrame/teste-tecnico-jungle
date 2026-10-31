import { StarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Média formatada como no Figma ("4.8"), com ponto, igual aos valores em ETH. */
export function formatRating(average: number): string {
  return average.toFixed(1)
}

/** Texto para leitores de tela: "4.8 de 5, 19 avaliações". */
export function ratingLabel(average: number, count: number): string {
  if (count === 0) return 'Sem avaliações'
  return `${formatRating(average)} de 5, ${count} ${count === 1 ? 'avaliação' : 'avaliações'}`
}

/**
 * Cinco estrelas preenchidas proporcionalmente à média (0 a 5). Decorativas: quem usa
 * passa o texto acessível ao lado (ver `ratingLabel`).
 */
export function StarRating({
  value,
  className,
  starClassName = 'size-3.5',
}: {
  value: number
  className?: string
  starClassName?: string
}) {
  const clamped = Math.max(0, Math.min(5, value))
  const stars = Array.from({ length: 5 }, (_, i) => i)
  return (
    <span aria-hidden className={cn('relative inline-flex shrink-0', className)}>
      <span className="flex gap-0.5">
        {stars.map((i) => (
          <StarIcon key={i} className={cn(starClassName, 'text-brand')} strokeWidth={1.5} />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
      >
        {stars.map((i) => (
          <StarIcon
            key={i}
            className={cn(starClassName, 'shrink-0 fill-brand text-brand')}
            strokeWidth={1.5}
          />
        ))}
      </span>
    </span>
  )
}

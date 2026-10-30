import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

export function ErrorState({
  title = 'Algo deu errado',
  description = 'Não foi possível carregar as informações. Verifique sua conexão e tente novamente.',
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-border-soft bg-card px-6 py-16 text-center',
        className,
      )}
    >
      <TriangleAlertIcon aria-hidden className="size-10 text-text-accent" />
      <h3 className="text-lg font-bold text-text-primary">{title}</h3>
      <p className="max-w-md text-sm text-text-secondary">{description}</p>
      {onRetry && (
        <Button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-2 rounded-[4px] font-bold"
        >
          <RotateCwIcon aria-hidden className={cn(retrying && 'motion-safe:animate-spin')} />
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

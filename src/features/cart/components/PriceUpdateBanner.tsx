import { RefreshCwIcon, XIcon } from 'lucide-react'

import type { RealtimeNotice } from '@/realtime/use-realtime'
import { cn } from '@/lib/utils'

interface PriceUpdateBannerProps {
  notices: RealtimeNotice[]
  onDismiss: () => void
  className?: string
}

/** Banner "Preços atualizados" com as mudanças recebidas em tempo real. */
export function PriceUpdateBanner({ notices, onDismiss, className }: PriceUpdateBannerProps) {
  if (notices.length === 0) return null
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-brand/60 bg-surface-dark px-4 py-3 text-sm',
        className,
      )}
    >
      <RefreshCwIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-text-primary">Preços atualizados</p>
        <ul className="mt-1 flex flex-col gap-0.5 text-text-secondary">
          {notices.map((n) => (
            <li key={n.id}>{n.message}</li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-text-secondary">O resumo abaixo já usa os valores novos.</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso de preços atualizados"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:text-text-primary"
      >
        <XIcon aria-hidden className="size-4" />
      </button>
    </div>
  )
}

import { CoinsIcon, QrCodeIcon, WalletIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { PROVIDER_LABELS, type WalletProvider } from './wallet-meta'

const ICONS: Record<WalletProvider, typeof WalletIcon> = {
  metamask: WalletIcon,
  walletconnect: QrCodeIcon,
  coinbase: CoinsIcon,
}

/** Ícone decorativo do provedor + nome (o nome sempre aparece como texto). */
export function ProviderMark({
  provider,
  className,
}: {
  provider: WalletProvider
  className?: string
}) {
  const Icon = ICONS[provider]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded-sm bg-surface-dark text-text-accent"
      >
        <Icon className="size-3.5" />
      </span>
      {PROVIDER_LABELS[provider]}
    </span>
  )
}

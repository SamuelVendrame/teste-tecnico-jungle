import {
  CheckIcon,
  CircleCheckIcon,
  CircleOffIcon,
  CircleXIcon,
  CopyIcon,
  Loader2Icon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { NETWORK_LABELS, type Wallet } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { ProviderMark } from './ProviderMark'
import {
  toggleSimulatedConnection,
  useWalletConnection,
  type WalletConnectionState,
} from './wallet-connection-store'
import { KIND_LABELS, truncateAddress, type WalletKind } from './wallet-meta'

const CONNECTION: Record<WalletConnectionState, { label: string; icon: ReactNode }> = {
  connected: { label: 'Conectada', icon: <CircleCheckIcon /> },
  disconnected: { label: 'Desconectada', icon: <CircleOffIcon /> },
  connecting: { label: 'Conectando…', icon: <Loader2Icon className="motion-safe:animate-spin" /> },
  refused: { label: 'Conexão recusada', icon: <CircleXIcon /> },
}

/** Selo de conexão dentro de uma região `role="status"` (a mudança é anunciada). */
export function ConnectionBadge({ walletId }: { walletId: string }) {
  const state = useWalletConnection(walletId)
  const { label, icon } = CONNECTION[state]
  return (
    <p role="status" aria-live="polite" className="m-0">
      <Badge
        variant="outline"
        data-state={state}
        className={
          state === 'connected'
            ? 'gap-1.5 border-brand px-2.5 text-text-accent'
            : state === 'refused'
              ? 'gap-1.5 border-destructive px-2.5 text-destructive'
              : 'gap-1.5 border-border-soft px-2.5 text-text-secondary'
        }
      >
        <span aria-hidden className="contents">
          {icon}
        </span>
        <span className="sr-only">Estado da conexão: </span>
        {label}
      </Badge>
    </p>
  )
}

function CopyAddressButton({ wallet }: { wallet: Wallet }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(wallet.address)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
      toast.success('Endereço copiado')
    } catch {
      toast.error('Não foi possível copiar o endereço')
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => void copy()}
      aria-label={`Copiar endereço da carteira ${wallet.label}`}
      className="text-text-accent hover:text-text-primary"
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
    </Button>
  )
}

/**
 * Linha de estado de uma carteira cadastrada: apelido, provedor, rede, endereço,
 * conexão simulada. O Figma só desenha o formulário; a simulação de conexão é
 * exigida pelo enunciado e fica aqui, compacta, acima dele.
 */
export function WalletStatus({ kind, wallet }: { kind: WalletKind; wallet: Wallet }) {
  const state = useWalletConnection(wallet.id)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-border-soft bg-card px-4 py-3 text-sm">
      <span className="font-bold text-text-primary">{wallet.label}</span>
      <ProviderMark provider={wallet.provider} className="text-text-secondary" />
      <Badge variant="outline" className="border-border-soft px-2.5 text-text-accent">
        {NETWORK_LABELS[wallet.network]}
      </Badge>
      <span className="inline-flex items-center gap-1">
        <code className="rounded-sm bg-background/60 px-2 py-1 text-xs text-text-primary">
          <span aria-hidden>{truncateAddress(wallet.address)}</span>
          <span className="sr-only">Endereço {wallet.address}</span>
        </code>
        <CopyAddressButton wallet={wallet} />
      </span>
      <ConnectionBadge walletId={wallet.id} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={state === 'connected'}
        disabled={state === 'connecting'}
        onClick={() => toggleSimulatedConnection(wallet.id)}
        className="ml-auto h-8 rounded-sm border-border-soft text-text-primary"
      >
        Simular conexão
        <span className="sr-only"> da {KIND_LABELS[kind].toLowerCase()}</span>
      </Button>
    </div>
  )
}

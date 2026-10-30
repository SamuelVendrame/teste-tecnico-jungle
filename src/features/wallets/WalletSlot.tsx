import {
  CheckIcon,
  CircleCheckIcon,
  CircleOffIcon,
  CircleXIcon,
  CopyIcon,
  Loader2Icon,
  WalletIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import type { Wallet } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NETWORK_LABELS } from '@/api/contracts'

import { ProviderMark } from './ProviderMark'
import {
  toggleSimulatedConnection,
  useWalletConnection,
  type WalletConnectionState,
} from './wallet-connection-store'
import {
  KIND_ARTICLE,
  KIND_LABELS,
  truncateAddress,
  walletActionId,
  type WalletKind,
} from './wallet-meta'

const CONNECTION: Record<WalletConnectionState, { label: string; icon: ReactNode }> = {
  connected: { label: 'Conectada', icon: <CircleCheckIcon /> },
  disconnected: { label: 'Desconectada', icon: <CircleOffIcon /> },
  connecting: { label: 'Conectando…', icon: <Loader2Icon className="motion-safe:animate-spin" /> },
  refused: { label: 'Conexão recusada', icon: <CircleXIcon /> },
}

/** Selo de conexão dentro de uma região `role="status"` (a mudança é anunciada). */
function ConnectionBadge({ walletId }: { walletId: string }) {
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

interface WalletSlotProps {
  kind: WalletKind
  wallet: Wallet | undefined
  onOpen: (kind: WalletKind) => void
}

export function WalletSlot({ kind, wallet, onOpen }: WalletSlotProps) {
  const titleId = `wallet-slot-${kind}-title`
  const state = useWalletConnection(wallet?.id)

  return (
    <article
      aria-labelledby={titleId}
      data-testid={`wallet-slot-${kind}`}
      className="flex min-h-[220px] flex-col rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id={titleId} className="text-base font-bold text-text-primary">
        {KIND_LABELS[kind]}
      </h2>

      {wallet ? (
        <div className="mt-4 flex flex-1 flex-col gap-4">
          <div className="space-y-2">
            <p className="text-lg font-bold break-words text-text-primary">{wallet.label}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-secondary">
              <ProviderMark provider={wallet.provider} />
              <Badge variant="outline" className="border-border-soft px-2.5 text-text-accent">
                {NETWORK_LABELS[wallet.network]}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <code className="rounded-sm bg-background/60 px-3 py-1.5 text-sm text-text-primary">
              <span aria-hidden>{truncateAddress(wallet.address)}</span>
              <span className="sr-only">Endereço {wallet.address}</span>
            </code>
            <CopyAddressButton wallet={wallet} />
          </div>

          <ConnectionBadge walletId={wallet.id} />

          <div className="mt-auto flex flex-wrap gap-3 pt-2">
            <Button
              id={walletActionId(kind)}
              type="button"
              onClick={() => onOpen(kind)}
              className="h-9 rounded-sm font-bold"
            >
              Editar
              <span className="sr-only"> {KIND_LABELS[kind].toLowerCase()}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={state === 'connected'}
              disabled={state === 'connecting'}
              onClick={() => toggleSimulatedConnection(wallet.id)}
              className="h-9 rounded-sm border-border-soft text-text-primary"
            >
              Simular conexão
              <span className="sr-only"> da {KIND_LABELS[kind].toLowerCase()}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col items-start justify-between gap-6">
          <div className="space-y-2">
            <WalletIcon aria-hidden className="size-8 text-text-accent" />
            <p className="text-sm text-text-primary">
              Você ainda não cadastrou uma carteira {KIND_ARTICLE[kind]}.
            </p>
            <p className="text-xs text-text-secondary">
              {kind === 'primary'
                ? 'Ela fica disponível no pagamento e recebe os NFTs comprados.'
                : 'Opcional: uma segunda opção de carteira para o pagamento.'}
            </p>
          </div>
          <Button
            id={walletActionId(kind)}
            type="button"
            onClick={() => onOpen(kind)}
            className="h-9 rounded-sm font-bold"
          >
            Cadastrar
            <span className="sr-only"> {KIND_LABELS[kind].toLowerCase()}</span>
          </Button>
        </div>
      )}
    </article>
  )
}

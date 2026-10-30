import { Link } from '@tanstack/react-router'
import {
  CircleCheckIcon,
  LoaderCircleIcon,
  PlugIcon,
  TriangleAlertIcon,
  UnplugIcon,
  WalletIcon,
} from 'lucide-react'
import { useEffect } from 'react'

import { NETWORK_LABELS, type Wallet } from '@/api/contracts'
import { announce } from '@/components/common/announce'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  connectWallet,
  getWalletConnection,
  setWalletConnection,
  useWalletConnection,
} from '@/features/wallets/wallet-connection-store'
import { KIND_LABELS, PROVIDER_LABELS, truncateAddress } from '@/features/wallets/wallet-meta'
import { cn } from '@/lib/utils'

interface WalletSectionProps {
  wallets: Wallet[] | undefined
  loading: boolean
  failed: boolean
  onRetry: () => void
  selectedId: string | null
  onSelect: (walletId: string) => void
  disabled?: boolean
  className?: string
}

/** Passo 2: carteira cadastrada + simulação de conexão, recusa e desconexão. */
export function WalletSection({
  wallets,
  loading,
  failed,
  onRetry,
  selectedId,
  onSelect,
  disabled = false,
  className,
}: WalletSectionProps) {
  return (
    <section aria-labelledby="wallet-title" className={className}>
      <h2 id="wallet-title" className="text-base font-bold text-text-primary md:text-center">
        Carteira e rede
      </h2>

      {loading ? (
        <div role="status" aria-label="Carregando carteiras" className="mt-4 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-[72px] rounded-[10px] md:rounded-[2px]" />
          ))}
        </div>
      ) : failed ? (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 text-sm">
          <p className="text-text-secondary">Não foi possível carregar suas carteiras.</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : !wallets || wallets.length === 0 ? (
        <div className="mt-4 rounded-[10px] border border-dashed border-border-soft p-4 text-sm md:rounded-[2px]">
          <p className="flex items-center gap-2 text-text-primary">
            <WalletIcon aria-hidden className="size-4 text-text-accent" />
            Você ainda não tem carteiras cadastradas.
          </p>
          <Link
            to="/wallets"
            className="mt-2 inline-block font-bold text-text-accent underline-offset-4 hover:underline"
          >
            Cadastre uma carteira
          </Link>
        </div>
      ) : (
        <>
          <RadioGroup
            aria-labelledby="wallet-title"
            value={selectedId ?? ''}
            onValueChange={onSelect}
            disabled={disabled}
            className="mt-4 gap-3"
          >
            {wallets.map((wallet) => (
              <WalletOption key={wallet.id} wallet={wallet} selected={wallet.id === selectedId} />
            ))}
          </RadioGroup>
          {selectedId && <ConnectionControls walletId={selectedId} disabled={disabled} />}
        </>
      )}
    </section>
  )
}

function WalletOption({ wallet, selected }: { wallet: Wallet; selected: boolean }) {
  const id = `wallet-${wallet.id}`
  const state = useWalletConnection(wallet.id)
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center gap-4 rounded-[10px] border bg-card px-5 py-4 transition-colors md:rounded-[2px] md:bg-transparent',
        selected ? 'border-text-primary' : 'border-border-soft hover:border-brand/70',
      )}
    >
      <RadioGroupItem
        id={id}
        value={wallet.id}
        className="size-4 border-brand text-brand [&_svg]:fill-brand"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 text-[15px] font-bold text-text-primary">
          {wallet.label}
          <span className="text-xs font-normal text-text-secondary">
            {KIND_LABELS[wallet.kind]}
          </span>
        </span>
        <span className="text-[13px] text-text-secondary">
          {PROVIDER_LABELS[wallet.provider]} ·{' '}
          <span className="font-mono">{truncateAddress(wallet.address)}</span>
        </span>
        <span className="text-[13px] text-text-secondary">
          Rede {NETWORK_LABELS[wallet.network]}
        </span>
      </span>
      {state === 'connected' && (
        <span className="flex items-center gap-1 text-xs text-text-accent">
          <CircleCheckIcon aria-hidden className="size-4" />
          Conectada
        </span>
      )}
    </label>
  )
}

function ConnectionControls({ walletId, disabled }: { walletId: string; disabled: boolean }) {
  const state = useWalletConnection(walletId)

  useEffect(
    () => () => {
      // Saiu do checkout no meio da conexão: não deixa a carteira "conectando" para
      // sempre (a resposta que chegar depois é descartada pelo store).
      if (getWalletConnection(walletId) === 'connecting')
        setWalletConnection(walletId, 'disconnected')
    },
    [walletId],
  )

  async function requestConnection(simulateRefusal: boolean) {
    announce('Conectando carteira…')
    const result = await connectWallet(walletId, { simulateRefusal })
    if (result === 'connected') announce('Carteira conectada.')
    else if (result === 'disconnected')
      announce('Não foi possível conectar a carteira. Tente novamente.')
  }

  function disconnect() {
    setWalletConnection(walletId, 'disconnected')
    announce('Carteira desconectada.')
  }

  const buttonBase = 'h-10 rounded-[4px] font-bold'

  return (
    <div className="mt-4 flex flex-col gap-3" aria-live="polite">
      {state === 'refused' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[4px] border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-text-primary"
        >
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />A
          conexão foi recusada na carteira. Aprove a solicitação e tente conectar de novo.
        </div>
      )}
      {state === 'connected' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-text-primary">
            <CircleCheckIcon aria-hidden className="size-4 text-text-accent" />
            Carteira conectada
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={disconnect}
            disabled={disabled}
            className="text-text-secondary hover:text-text-accent"
          >
            <UnplugIcon aria-hidden />
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void requestConnection(false)}
            disabled={disabled || state === 'connecting'}
            aria-busy={state === 'connecting'}
            className={cn(
              buttonBase,
              'flex-1 border-brand bg-transparent text-text-accent dark:bg-transparent',
            )}
          >
            {state === 'connecting' ? (
              <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />
            ) : (
              <PlugIcon aria-hidden />
            )}
            {state === 'connecting' ? 'Conectando…' : 'Conectar carteira'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void requestConnection(true)}
            disabled={disabled || state === 'refused'}
            className="h-10 text-xs text-text-secondary hover:text-text-primary"
          >
            Simular recusa
          </Button>
        </div>
      )}
    </div>
  )
}

import { useState, type ReactNode } from 'react'

import type { Wallet, WalletInput } from '@/api/contracts'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import { AccountSidebar } from '@/features/profile/AccountSidebar'
import { cn } from '@/lib/utils'

import { useWalletsSuspense } from './use-wallets'
import { WalletForm } from './WalletForm'
import { WalletStatus } from './WalletStatus'
import { KIND_LABELS, walletActionId, type WalletKind } from './wallet-meta'

const linkButtonClass =
  'h-auto p-0 text-sm font-bold text-text-accent hover:text-text-primary hover:no-underline'

/** Campos do perfil copiados da principal quando "Igual à carteira principal" está marcado. */
function profileOf(wallet: Wallet): Partial<WalletInput> {
  const { displayName, profileName, secondaryRef, referralCode, email, ensSuffix, ensName } = wallet
  return {
    displayName,
    profileName,
    secondaryRef,
    referralCode,
    email,
    ensSuffix,
    ensName,
    network: wallet.network,
    provider: wallet.provider,
  }
}

function SectionHeader({
  kind,
  description,
  action,
}: {
  kind: WalletKind
  description: string
  action?: ReactNode
}) {
  const titleId = `wallet-${kind}-title`
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 space-y-1">
        <h2 id={titleId} className="text-lg font-bold text-text-primary">
          {KIND_LABELS[kind]}
        </h2>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
      {action}
    </div>
  )
}

/** Carteira principal: sempre com o formulário (cadastro ou edição), como no Figma. */
function PrimarySection({ wallet }: { wallet: Wallet | undefined }) {
  return (
    <section aria-labelledby="wallet-primary-title" className="space-y-5">
      <SectionHeader
        kind="primary"
        description="Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados."
        action={
          <span id={walletActionId('primary')} className="text-sm font-bold text-text-accent">
            {wallet ? 'Editar' : 'Adicionar'}
          </span>
        }
      />
      {wallet && <WalletStatus kind="primary" wallet={wallet} />}
      <WalletForm key={wallet?.id ?? 'new'} kind="primary" wallet={wallet} />
    </section>
  )
}

/**
 * Carteira secundária: o formulário só aparece ao clicar em "Adicionar" (ou ao marcar
 * "Igual à carteira principal", que já o preenche com os dados da principal).
 */
function SecondarySection({
  wallet,
  primary,
}: {
  wallet: Wallet | undefined
  primary: Wallet | undefined
}) {
  const [adding, setAdding] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const showForm = wallet !== undefined || adding

  return (
    <section aria-labelledby="wallet-secondary-title" className="space-y-5">
      <SectionHeader
        kind="secondary"
        description={
          wallet
            ? 'Uma segunda opção de carteira para o pagamento.'
            : 'Você ainda não adicionou uma carteira secundária.'
        }
        action={
          wallet ? (
            <span id={walletActionId('secondary')} className="text-sm font-bold text-text-accent">
              Editar
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 text-text-primary',
                  !primary && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  role="switch"
                  checked={sameAsPrimary}
                  disabled={!primary}
                  onChange={(event) => {
                    setSameAsPrimary(event.target.checked)
                    if (event.target.checked) setAdding(true)
                  }}
                  className="size-4 appearance-none rounded-full border border-brand checked:border-[5px] checked:border-brand"
                />
                Igual à carteira principal
              </label>
              <Button
                id={walletActionId('secondary')}
                type="button"
                variant="link"
                onClick={() => setAdding(true)}
                className={linkButtonClass}
              >
                Adicionar
                <span className="sr-only"> carteira secundária</span>
              </Button>
            </div>
          )
        }
      />
      {wallet && <WalletStatus kind="secondary" wallet={wallet} />}
      {showForm && (
        <WalletForm
          key={`${wallet?.id ?? 'new'}-${sameAsPrimary ? 'same' : 'blank'}`}
          kind="secondary"
          wallet={wallet}
          seed={sameAsPrimary && primary ? profileOf(primary) : undefined}
          onCancel={wallet ? undefined : () => setAdding(false)}
        />
      )}
    </section>
  )
}

/** Carteiras: principal e secundária com o formulário inline do Figma. */
export function WalletsPage() {
  const wallets = useWalletsSuspense()
  const byKind = (kind: WalletKind) => wallets.find((w) => w.kind === kind)
  const primary = byKind('primary')

  return (
    <Container className="py-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-7">
        <AccountSidebar current="wallets" />
        <div className="min-w-0 space-y-10">
          <h1 className="sr-only">Carteiras</h1>
          <PrimarySection wallet={primary} />
          <SecondarySection wallet={byKind('secondary')} primary={primary} />
        </div>
      </div>
    </Container>
  )
}

export function WalletsSkeleton() {
  return (
    <Container className="py-6 lg:py-8">
      <div role="status" aria-label="Carregando carteiras">
        <span className="sr-only">Carregando carteiras…</span>
        <div aria-hidden className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-7">
          <div className="skeleton h-[45px] w-full rounded-lg lg:h-[407px]" />
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="skeleton h-7 w-48" />
              <div className="skeleton h-4 w-3/4" />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-10 w-full rounded-sm" />
                </div>
              ))}
            </div>
            <div className="skeleton h-10 w-36 rounded-sm" />
          </div>
        </div>
      </div>
    </Container>
  )
}

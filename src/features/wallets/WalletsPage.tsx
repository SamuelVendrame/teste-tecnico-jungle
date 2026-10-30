import { useState } from 'react'

import { Container } from '@/components/layout/Container'
import { AccountSidebar } from '@/features/profile/AccountSidebar'

import { useWalletsSuspense } from './use-wallets'
import { WalletDialog } from './WalletDialog'
import { WalletSlot } from './WalletSlot'
import { type WalletKind } from './wallet-meta'

const KINDS: WalletKind[] = ['primary', 'secondary']

/** Carteiras: dois slots (principal e secundária) com cadastro/edição em diálogo. */
export function WalletsPage() {
  const wallets = useWalletsSuspense()
  const [target, setTarget] = useState<WalletKind>('primary')
  const [open, setOpen] = useState(false)

  const byKind = (kind: WalletKind) => wallets.find((w) => w.kind === kind)

  return (
    <Container className="py-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-7">
        <AccountSidebar current="wallets" />
        <div className="min-w-0 space-y-6">
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-text-primary">Carteiras</h1>
            <p className="text-sm text-text-secondary">
              Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 md:gap-7">
            {KINDS.map((kind) => (
              <WalletSlot
                key={kind}
                kind={kind}
                wallet={byKind(kind)}
                onOpen={(next) => {
                  setTarget(next)
                  setOpen(true)
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <WalletDialog open={open} onOpenChange={setOpen} kind={target} wallet={byKind(target)} />
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
              <div className="skeleton h-7 w-40" />
              <div className="skeleton h-4 w-3/4" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 md:gap-7">
              <div className="skeleton h-[272px] w-full rounded-lg" />
              <div className="skeleton h-[272px] w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

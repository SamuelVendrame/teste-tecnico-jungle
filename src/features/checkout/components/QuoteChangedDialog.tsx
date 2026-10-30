import { RefreshCwIcon } from 'lucide-react'

import type { Quote } from '@/api/contracts'
import { EthAmount } from '@/components/common/EthAmount'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { diffQuotes } from '../quote-diff'

interface QuoteChangedDialogProps {
  /** Cotação que o usuário revisou; null = diálogo fechado. */
  previous: Quote | null
  next: Quote | null
  blocking: boolean
  onAccept: () => void
}

/**
 * "A cotação mudou": nunca reenviamos o pedido automaticamente. O usuário vê o
 * que mudou e precisa clicar em "Revisar e confirmar" (que só libera o botão de
 * confirmar com o fingerprint novo; o pedido em si ainda exige outro clique).
 * Fechar o diálogo (Esc/overlay) equivale a revisar: os valores novos ficam na tela.
 */
export function QuoteChangedDialog({
  previous,
  next,
  blocking,
  onAccept,
}: QuoteChangedDialogProps) {
  const open = previous !== null && next !== null
  const changes = open ? diffQuotes(previous, next) : []
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onAccept()}>
      <DialogContent
        showCloseButton={false}
        className="border-border-soft bg-surface-card sm:max-w-[480px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-primary">
            <RefreshCwIcon aria-hidden className="size-5 text-text-accent" />A cotação mudou
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Preço, disponibilidade, cupom ou taxa mudaram desde que você revisou o pedido. Nada foi
            cobrado. Confira antes de confirmar.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-primary">
          {changes.map((c) => (
            <li key={c.id}>{c.message}</li>
          ))}
        </ul>
        {next && (
          <p className="flex items-baseline justify-between border-t border-border-soft pt-3 text-sm font-bold">
            <span>Novo total</span>
            <EthAmount value={next.totalEth} className="text-text-accent" />
          </p>
        )}
        {blocking && (
          <p className="text-sm text-destructive">
            Há itens sem disponibilidade suficiente: ajuste o carrinho para continuar.
          </p>
        )}
        <DialogFooter>
          <Button type="button" onClick={onAccept} className="rounded-[4px] font-bold">
            Revisar e confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { TriangleAlertIcon } from 'lucide-react'

import type { Cart, CartItem, QuoteIssue } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

function findCartItem(cart: Cart | undefined, issue: Pick<QuoteIssue, 'nftId' | 'editionId'>) {
  return cart?.items.find((i) => i.nftId === issue.nftId && i.editionId === issue.editionId)
}

/** Texto curto e consistente para cada problema da cotação. */
function issueMessage(issue: QuoteIssue, item: CartItem | undefined): string {
  const label = item ? `${item.nft.name} (${item.edition.name})` : null
  if (!label) return issue.message
  switch (issue.type) {
    case 'price-changed':
      return issue.previousPriceEth && issue.currentPriceEth
        ? `O preço de ${label} mudou de ${formatEth(issue.previousPriceEth)} para ${formatEth(issue.currentPriceEth)}.`
        : issue.message
    case 'sold-out':
      return `${label} esgotou.`
    case 'insufficient-stock':
      return `Só restam ${issue.available ?? 0} de ${label}.`
  }
}

export type IssueAction =
  | { kind: 'accept-price'; item: CartItem }
  | { kind: 'remove'; item: CartItem }
  | { kind: 'set-quantity'; item: CartItem; quantity: number }

function actionFor(issue: QuoteIssue, item: CartItem | undefined): IssueAction | null {
  if (!item) return null
  if (issue.type === 'price-changed') return { kind: 'accept-price', item }
  if (issue.type === 'sold-out' || !issue.available) return { kind: 'remove', item }
  return { kind: 'set-quantity', item, quantity: issue.available }
}

const ACTION_LABEL: Record<IssueAction['kind'], (a: IssueAction) => string> = {
  'accept-price': () => 'Aceitar novo preço',
  remove: () => 'Remover do carrinho',
  'set-quantity': (a) => `Ajustar para ${a.kind === 'set-quantity' ? a.quantity : ''}`,
}

interface QuoteIssuesProps {
  issues: QuoteIssue[]
  cart: Cart | undefined
  /** Sem `onAction` (checkout) a lista só informa e aponta para o carrinho. */
  onAction?: (action: IssueAction) => void
  busy?: boolean
  className?: string
}

/** Alerta com os problemas da cotação (preço mudou, esgotado, estoque insuficiente). */
export function QuoteIssues({ issues, cart, onAction, busy = false, className }: QuoteIssuesProps) {
  if (issues.length === 0) return null
  const blocking = issues.some((i) => i.type !== 'price-changed')
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border px-4 py-3 text-sm',
        blocking ? 'border-destructive/60 bg-destructive/10' : 'border-brand/60 bg-surface-dark',
        className,
      )}
    >
      <p className="flex items-center gap-2 font-bold text-text-primary">
        <TriangleAlertIcon aria-hidden className="size-4 shrink-0 text-text-accent" />
        {blocking
          ? 'Alguns itens precisam de ajuste'
          : 'Preços atualizados desde que você adicionou'}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {issues.map((issue) => {
          const item = findCartItem(cart, issue)
          const action = onAction ? actionFor(issue, item) : null
          return (
            <li
              key={`${issue.type}:${issue.nftId}:${issue.editionId}`}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
            >
              <span className="text-text-secondary">{issueMessage(issue, item)}</span>
              {action && onAction && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onAction(action)}
                  className="h-7 rounded-[4px] border-brand/70 bg-transparent text-xs text-text-accent hover:bg-brand/10 dark:bg-transparent"
                >
                  {ACTION_LABEL[action.kind](action)}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

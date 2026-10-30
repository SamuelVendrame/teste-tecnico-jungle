/**
 * Diferenças entre a cotação que o usuário revisou e a nova (vinda de
 * QUOTE_STALE ou de um recálculo disparado por `nft.updated`). Alimenta o
 * diálogo "A cotação mudou".
 */
import type { Quote, QuoteIssue } from '@/api/contracts'
import { compareEth, formatEth } from '@/lib/money'

export interface QuoteChange {
  id: string
  message: string
}

function lineKey(l: { nftId: string; editionId: string }) {
  return `${l.nftId}:${l.editionId}`
}

function issueText(issue: QuoteIssue, name: string): string | null {
  if (issue.type === 'sold-out') return `${name} esgotou.`
  if (issue.type === 'insufficient-stock') return `Só restam ${issue.available ?? 0} de ${name}.`
  return null
}

export function diffQuotes(previous: Quote, next: Quote): QuoteChange[] {
  const changes: QuoteChange[] = []
  const before = new Map(previous.lines.map((l) => [lineKey(l), l]))
  const after = new Map(next.lines.map((l) => [lineKey(l), l]))

  for (const line of next.lines) {
    const name = `${line.name} (${line.editionName})`
    const old = before.get(lineKey(line))
    if (!old) {
      changes.push({ id: `add:${lineKey(line)}`, message: `${name} entrou no pedido.` })
      continue
    }
    if (compareEth(old.unitPriceEth, line.unitPriceEth) !== 0) {
      changes.push({
        id: `price:${lineKey(line)}`,
        message: `O preço de ${name} mudou de ${formatEth(old.unitPriceEth)} para ${formatEth(line.unitPriceEth)}.`,
      })
    }
    if (old.quantity !== line.quantity) {
      changes.push({
        id: `qty:${lineKey(line)}`,
        message: `A quantidade de ${name} mudou de ${old.quantity} para ${line.quantity}.`,
      })
    }
  }
  for (const line of previous.lines) {
    if (!after.has(lineKey(line))) {
      changes.push({
        id: `rm:${lineKey(line)}`,
        message: `${line.name} (${line.editionName}) saiu do pedido.`,
      })
    }
  }

  const known = new Set(previous.issues.map((i) => `${i.type}:${lineKey(i)}:${i.available ?? ''}`))
  for (const issue of next.issues) {
    if (known.has(`${issue.type}:${lineKey(issue)}:${issue.available ?? ''}`)) continue
    const line = after.get(lineKey(issue))
    const text = issueText(issue, line ? `${line.name} (${line.editionName})` : 'Um item')
    if (text) changes.push({ id: `issue:${issue.type}:${lineKey(issue)}`, message: text })
  }

  if ((previous.coupon?.code ?? null) !== (next.coupon?.code ?? null)) {
    changes.push({
      id: 'coupon',
      message: next.coupon
        ? `Cupom ${next.coupon.code} aplicado.`
        : `O cupom ${previous.coupon?.code ?? ''} deixou de valer.`,
    })
  } else if (compareEth(previous.discountEth, next.discountEth) !== 0) {
    changes.push({
      id: 'discount',
      message: `O desconto mudou de ${formatEth(previous.discountEth)} para ${formatEth(next.discountEth)}.`,
    })
  }
  if (compareEth(previous.networkFeeEth, next.networkFeeEth) !== 0) {
    changes.push({
      id: 'fee',
      message: `A taxa de rede mudou de ${formatEth(previous.networkFeeEth)} para ${formatEth(next.networkFeeEth)}.`,
    })
  }
  if (compareEth(previous.totalEth, next.totalEth) !== 0) {
    changes.push({
      id: 'total',
      message: `Total: de ${formatEth(previous.totalEth)} para ${formatEth(next.totalEth)}.`,
    })
  }
  if (changes.length === 0) {
    changes.push({
      id: 'renewed',
      message: 'A cotação foi renovada. Confira os valores antes de confirmar.',
    })
  }
  return changes
}

export function hasBlockingIssues(quote: Pick<Quote, 'issues'>): boolean {
  return quote.issues.some((i) => i.type !== 'price-changed')
}

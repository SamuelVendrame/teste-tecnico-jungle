import type { EthAmount as EthAmountValue } from '@/api/contracts'
import { compareEth } from '@/lib/money'
import { cn } from '@/lib/utils'

import { EthAmount } from './EthAmount'

interface PriceTagProps {
  price: EthAmountValue
  compareAt?: EthAmountValue | null
  className?: string
  /** Classe do preço principal (tamanho/peso variam entre card e detalhe). */
  priceClassName?: string
}

/** Preço atual em destaque e, quando em promoção, o preço anterior riscado. */
export function PriceTag({ price, compareAt, className, priceClassName }: PriceTagProps) {
  const onSale = compareAt != null && compareEth(compareAt, price) > 0
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-3', className)}>
      <span className="sr-only">{onSale ? 'Preço promocional: ' : 'Preço: '}</span>
      <EthAmount value={price} className={cn('font-bold text-text-accent', priceClassName)} />
      {onSale && (
        <s className="text-text-secondary/80">
          <span className="sr-only">Preço original: </span>
          <EthAmount value={compareAt} />
        </s>
      )}
    </p>
  )
}

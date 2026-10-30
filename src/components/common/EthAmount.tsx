import type { EthAmount as EthAmountValue } from '@/api/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

interface EthAmountProps {
  value: EthAmountValue
  className?: string
}

/** Valor em ETH formatado; o valor exato (string decimal) fica em `data-value`. */
export function EthAmount({ value, className }: EthAmountProps) {
  return (
    <data value={value} className={cn('tabular-nums', className)}>
      {formatEth(value)}
    </data>
  )
}

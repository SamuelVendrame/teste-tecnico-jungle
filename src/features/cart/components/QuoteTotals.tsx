import type { ReactNode } from 'react'

import type { EthAmount as EthAmountValue } from '@/api/contracts'
import { EthAmount } from '@/components/common/EthAmount'
import { formatEth, isZeroEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export interface TotalsValues {
  subtotalEth: EthAmountValue
  discountEth: EthAmountValue
  networkFeeEth: EthAmountValue
  totalEth: EthAmountValue
  couponCode?: string | null
}

interface QuoteTotalsProps {
  /** null = carregando (skeleton com as mesmas dimensões). */
  values: TotalsValues | null
  /** Valores anteriores exibidos enquanto a nova cotação chega. */
  refreshing?: boolean
  className?: string
}

/**
 * Subtotal, desconto, taxa de rede e total. Usado no carrinho, no checkout e no
 * recibo (este último sempre a partir do snapshot do pedido).
 */
export function QuoteTotals({ values, refreshing = false, className }: QuoteTotalsProps) {
  return (
    <dl
      aria-busy={values === null || refreshing}
      className={cn(
        'flex flex-col gap-3 text-[15px] transition-opacity',
        refreshing && 'opacity-60',
        className,
      )}
    >
      {refreshing && <span className="sr-only">Atualizando valores…</span>}
      <Row label="Subtotal">
        {values ? <EthAmount value={values.subtotalEth} /> : <ValueSkeleton />}
      </Row>
      <Row label={values?.couponCode ? `Desconto (${values.couponCode})` : 'Desconto'}>
        {values ? (
          <span
            className={cn('tabular-nums', !isZeroEth(values.discountEth) && 'text-text-accent')}
          >
            <span aria-hidden>(-) </span>
            <span className="sr-only">menos </span>
            <data value={values.discountEth}>{formatEth(values.discountEth)}</data>
          </span>
        ) : (
          <ValueSkeleton />
        )}
      </Row>
      <div>
        <Row label="Taxa de rede">
          {values ? <EthAmount value={values.networkFeeEth} /> : <ValueSkeleton />}
        </Row>
        <p className="mt-1 text-right text-xs text-text-accent">Taxa estimada</p>
      </div>
      <Row label="Total" className="mt-2 text-base font-bold">
        {values ? (
          <EthAmount value={values.totalEth} className="text-text-accent" />
        ) : (
          <ValueSkeleton wide />
        )}
      </Row>
    </dl>
  )
}

function Row({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <dt className="text-text-primary">{label}</dt>
      <dd className="text-right text-text-primary">{children}</dd>
    </div>
  )
}

function ValueSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('skeleton inline-block h-4 align-middle', wide ? 'w-28' : 'w-20')}
    />
  )
}

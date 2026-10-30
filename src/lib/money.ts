import Decimal from 'decimal.js'

import type { EthAmount } from '@/api/contracts'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN })

/** ETH tem 18 casas; nunca arredondamos abaixo disso em cálculos. */
const ETH_SCALE = 18

export function eth(value: EthAmount | number | Decimal): Decimal {
  return new Decimal(value)
}

export function toEthString(value: Decimal | EthAmount | number): EthAmount {
  return new Decimal(value).toDecimalPlaces(ETH_SCALE).toFixed()
}

export function addEth(...values: Array<EthAmount | Decimal>): EthAmount {
  return toEthString(values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0)))
}

export function subEth(a: EthAmount | Decimal, b: EthAmount | Decimal): EthAmount {
  return toEthString(new Decimal(a).minus(b))
}

export function mulEth(
  amount: EthAmount | Decimal,
  factor: number | EthAmount | Decimal,
): EthAmount {
  return toEthString(new Decimal(amount).times(factor))
}

export function percentOf(amount: EthAmount | Decimal, percent: number): EthAmount {
  return toEthString(new Decimal(amount).times(percent).div(100))
}

export function compareEth(a: EthAmount, b: EthAmount): -1 | 0 | 1 {
  return new Decimal(a).comparedTo(b) as -1 | 0 | 1
}

export function isZeroEth(a: EthAmount): boolean {
  return new Decimal(a).isZero()
}

/**
 * Formata para exibição: "1.19 ETH". Mantém até 4 casas significativas sem
 * zeros à direita, como no layout do Figma.
 */
export function formatEth(value: EthAmount | Decimal, opts: { suffix?: boolean } = {}): string {
  const d = new Decimal(value)
  const fixed = d.toDecimalPlaces(4).toFixed()
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
  const withMin = trimmed.includes('.') ? trimmed : `${trimmed}.00`
  return opts.suffix === false ? withMin : `${withMin} ETH`
}

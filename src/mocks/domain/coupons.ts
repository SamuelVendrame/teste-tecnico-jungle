/**
 * Validação de cupons. Código é case-insensitive.
 * - desconhecido ou abaixo do subtotal mínimo: 422 COUPON_INVALID
 * - expirado (ou cenário `coupon-expired`): 422 COUPON_EXPIRED
 */
import { compareEth, percentOf } from '@/lib/money'

import { getDb, now, type DbCoupon } from '../db'
import { getScenario } from '../scenarios'
import { ApiProblem } from './errors'

export function findCoupon(rawCode: string, ctx: { subtotalEth: string }): DbCoupon {
  const code = rawCode.trim().toUpperCase()
  const coupon = getDb().coupons[code]
  if (!coupon) {
    throw new ApiProblem(422, 'COUPON_INVALID', 'Cupom inválido.', {
      details: { couponCode: ['Cupom inválido.'] },
    })
  }
  const expired = coupon.expiresAt !== null && Date.parse(coupon.expiresAt) <= now().getTime()
  if (expired || getScenario().couponsExpired) {
    throw new ApiProblem(422, 'COUPON_EXPIRED', 'Este cupom expirou.', {
      details: { couponCode: ['Este cupom expirou.'] },
    })
  }
  if (coupon.minSubtotalEth && compareEth(ctx.subtotalEth, coupon.minSubtotalEth) < 0) {
    const message = `Cupom válido para pedidos a partir de ${coupon.minSubtotalEth} ETH.`
    throw new ApiProblem(422, 'COUPON_INVALID', message, { details: { couponCode: [message] } })
  }
  return coupon
}

/** Desconto do cupom sobre o subtotal, nunca maior que o próprio subtotal. */
export function couponDiscount(coupon: DbCoupon, subtotalEth: string): string {
  const raw =
    coupon.percentOff !== null
      ? percentOf(subtotalEth, coupon.percentOff)
      : (coupon.amountOffEth ?? '0')
  return compareEth(raw, subtotalEth) > 0 ? subtotalEth : raw
}

/**
 * Cupons e taxas de rede do seed. Valores em ETH como strings decimais.
 */
import type { NetworkId } from '@/api/contracts'

import type { DbCoupon } from '../db'

export const SEED_COUPONS: DbCoupon[] = [
  {
    code: 'KURIO10',
    description: '10% de desconto no subtotal',
    percentOff: 10,
    amountOffEth: null,
    minSubtotalEth: null,
    expiresAt: null,
  },
  {
    code: 'GENESIS',
    description: 'Cupom de lançamento (encerrado)',
    percentOff: 20,
    amountOffEth: null,
    minSubtotalEth: null,
    expiresAt: '2026-01-01T00:00:00.000Z',
  },
  {
    code: 'FIXED05',
    description: '0.05 ETH de desconto em pedidos a partir de 0.5 ETH',
    percentOff: null,
    amountOffEth: '0.05',
    minSubtotalEth: '0.5',
    expiresAt: null,
  },
]

/** Taxa fixa por pedido, cobrada conforme a rede escolhida no checkout. */
export const SEED_NETWORK_FEES: Record<NetworkId, string> = {
  ethereum: '0.0021',
  polygon: '0.0003',
  solana: '0.0001',
}

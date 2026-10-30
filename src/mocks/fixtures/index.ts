/**
 * Monta o seed completo do banco. Função pura: cada chamada devolve objetos novos
 * e idênticos (sem Date.now, sem Math.random), então o reset é determinístico.
 */
import type { Order } from '@/api/contracts'
import { addEth, mulEth } from '@/lib/money'

import type { MockDb } from '../db'
import { DB_SCHEMA_VERSION } from '../persistence'
import { SEED_CLOCK, createNfts } from './nfts'
import { SEED_COUPONS, SEED_NETWORK_FEES } from './pricing'
import {
  SEED_FAVORITES,
  SEED_ORDER_ID,
  SEED_ORDER_TX,
  SEED_PASSWORD_HASHES,
  SEED_USERS,
  SEED_WALLETS,
} from './users'

export { SEED_CLOCK } from './nfts'

function seedOrder(nfts: MockDb['nfts']): Order | null {
  const nft = nfts['nft_004']
  const edition = nft?.editions[0]
  const wallet = SEED_WALLETS[0]
  if (!nft || !edition || !wallet) return null
  const lineTotal = mulEth(edition.priceEth, 1)
  const fee = SEED_NETWORK_FEES.ethereum
  return {
    id: SEED_ORDER_ID,
    userId: 'usr_ana',
    status: 'confirmed',
    snapshot: {
      lines: [
        {
          nftId: nft.id,
          editionId: edition.id,
          name: nft.name,
          editionName: edition.name,
          imageUrl: nft.imageUrl,
          quantity: 1,
          unitPriceEth: edition.priceEth,
          lineTotalEth: lineTotal,
          nftVersion: 1,
        },
      ],
      subtotalEth: lineTotal,
      discountEth: '0',
      networkFeeEth: fee,
      totalEth: addEth(lineTotal, fee),
      couponCode: null,
      network: 'ethereum',
      wallet: { label: wallet.label, address: wallet.address, provider: wallet.provider },
      collector: { name: 'Ana Ribeiro', email: 'ana@kurio.dev', document: '12345678909' },
    },
    txHash: SEED_ORDER_TX,
    explorerUrl: `https://etherscan.io/tx/${SEED_ORDER_TX}`,
    declineReason: null,
    idempotencyKey: 'seed-ana-001',
    createdAt: '2026-10-10T18:30:00.000Z',
    updatedAt: '2026-10-10T18:30:03.000Z',
    version: 2,
  }
}

export function createSeed(): MockDb {
  const { nfts: nftList, spotlightId } = createNfts()
  const nfts = Object.fromEntries(nftList.map((n) => [n.id, n]))
  const order = seedOrder(nfts)

  return {
    meta: {
      schemaVersion: DB_SCHEMA_VERSION,
      seedClock: SEED_CLOCK,
      clockOffsetMs: 0,
      spotlightNftId: spotlightId,
    },
    users: Object.fromEntries(SEED_USERS.map((u) => [u.id, structuredClone(u)])),
    passwordHashes: { ...SEED_PASSWORD_HASHES },
    sessions: {},
    nfts,
    favorites: Object.fromEntries(
      Object.entries(SEED_FAVORITES).map(([userId, ids]) => [
        userId,
        { nftIds: [...ids], version: 1 },
      ]),
    ),
    carts: {},
    coupons: Object.fromEntries(SEED_COUPONS.map((c) => [c.code, { ...c }])),
    quotes: {},
    orders: order ? { [order.id]: order } : {},
    orderJobs: {},
    idempotency: {},
    wallets: Object.fromEntries(SEED_WALLETS.map((w) => [w.id, structuredClone(w)])),
    networkFees: { ...SEED_NETWORK_FEES },
  }
}

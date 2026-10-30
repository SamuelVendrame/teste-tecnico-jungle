/**
 * Cotação: recalcula linhas a partir do estado ATUAL do catálogo, aplica cupom e
 * taxa da rede, e aponta problemas (`issues`).
 *
 * Fingerprint = SHA-256 de (linhas normalizadas + totais + cupom + rede + problemas
 * de estoque). Qualquer mudança de preço, disponibilidade, cupom ou rede muda o hash;
 * o pedido só é aceito se o fingerprint revisado pelo usuário bater com um recálculo.
 */
import type { NetworkId, Quote, QuoteInput, QuoteIssue, QuoteLine } from '@/api/contracts'
import { addEth, eth, mulEth, subEth } from '@/lib/money'

import { commit, getDb, now, onDbReset, type DbCart, type DbQuote } from '../db'
import {
  disarmPriceChange,
  disarmSoldOut,
  getScenario,
  isPriceChangeArmed,
  isSoldOutArmed,
} from '../scenarios'
import { sha256Hex, stableStringify, uid } from '../utils'
import { priceDiffers, snapshotPriceFor } from './cart'
import { couponDiscount, findCoupon } from './coupons'
import { problems } from './errors'
import { findEdition, findNft, updateNft } from './nfts'

export const QUOTE_TTL_MS = 10 * 60 * 1000
/** Cotações mais antigas que isso são descartadas do banco. */
const QUOTE_RETENTION_MS = 60 * 60 * 1000

type QuoteBody = Omit<Quote, 'id' | 'createdAt' | 'expiresAt'>

/** Junta itens repetidos (mesmo NFT + edição) somando quantidades. */
function normalizeItems(items: QuoteInput['items']): QuoteInput['items'] {
  const merged = new Map<string, QuoteInput['items'][number]>()
  for (const item of items) {
    const key = `${item.nftId}:${item.editionId}`
    const prev = merged.get(key)
    merged.set(key, prev ? { ...prev, quantity: prev.quantity + item.quantity } : { ...item })
  }
  return [...merged.values()]
}

export async function computeQuote(
  input: { items: QuoteInput['items']; couponCode: string | null; network: NetworkId },
  cart: DbCart | null,
): Promise<QuoteBody> {
  const lines: QuoteLine[] = []
  const issues: QuoteIssue[] = []

  for (const item of normalizeItems(input.items)) {
    const nft = findNft(item.nftId)
    const edition = nft ? findEdition(nft, item.editionId) : undefined
    if (!nft || !edition) {
      throw problems.validation({ items: [`Item ${item.nftId}/${item.editionId} não existe.`] })
    }
    lines.push({
      nftId: nft.id,
      editionId: edition.id,
      name: nft.name,
      editionName: edition.name,
      imageUrl: nft.imageUrl,
      quantity: item.quantity,
      unitPriceEth: edition.priceEth,
      lineTotalEth: mulEth(edition.priceEth, item.quantity),
      nftVersion: nft.version,
    })

    const snapshot = snapshotPriceFor(cart, nft.id, edition.id)
    if (snapshot && priceDiffers(snapshot, edition.priceEth)) {
      issues.push({
        type: 'price-changed',
        nftId: nft.id,
        editionId: edition.id,
        message: `O preço de ${nft.name} (${edition.name}) mudou de ${snapshot} para ${edition.priceEth} ETH.`,
        previousPriceEth: snapshot,
        currentPriceEth: edition.priceEth,
      })
    }
    if (edition.available === 0) {
      issues.push({
        type: 'sold-out',
        nftId: nft.id,
        editionId: edition.id,
        message: `${nft.name} (${edition.name}) esgotou.`,
        requested: item.quantity,
        available: 0,
      })
    } else if (item.quantity > Math.min(edition.available, edition.maxPerOrder)) {
      const available = Math.min(edition.available, edition.maxPerOrder)
      issues.push({
        type: 'insufficient-stock',
        nftId: nft.id,
        editionId: edition.id,
        message: `Restam apenas ${available} unidade(s) de ${nft.name} (${edition.name}) para este pedido.`,
        requested: item.quantity,
        available,
      })
    }
  }

  const subtotalEth = addEth(...lines.map((l) => l.lineTotalEth))
  const coupon = input.couponCode ? findCoupon(input.couponCode, { subtotalEth }) : null
  const discountEth = coupon ? couponDiscount(coupon, subtotalEth) : '0'
  const networkFeeEth = getDb().networkFees[input.network]
  const totalEth = addEth(subEth(subtotalEth, discountEth), networkFeeEth)

  const blocking = issues
    .filter((i) => i.type !== 'price-changed')
    .map((i) => [i.type, i.nftId, i.editionId, i.available ?? null])
  const fingerprint = await sha256Hex(
    stableStringify({
      network: input.network,
      coupon: coupon?.code ?? null,
      lines: lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPriceEth, l.lineTotalEth]),
      subtotalEth,
      discountEth,
      networkFeeEth,
      totalEth,
      blocking,
    }),
  )

  return {
    fingerprint,
    network: input.network,
    lines,
    subtotalEth,
    discountEth,
    networkFeeEth,
    totalEth,
    coupon: coupon
      ? {
          code: coupon.code,
          description: coupon.description,
          percentOff: coupon.percentOff,
          amountOffEth: coupon.amountOffEth,
        }
      : null,
    issues,
  }
}

export function hasBlockingIssues(quote: Pick<Quote, 'issues'>): boolean {
  return quote.issues.some((i) => i.type !== 'price-changed')
}

export async function createQuote(
  input: QuoteInput,
  owner: { key: string; userId: string | null },
  cart: DbCart | null,
): Promise<Quote> {
  const body = await computeQuote(input, cart)
  const createdAt = now()
  const quote: Quote = {
    ...body,
    id: uid('qt'),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + QUOTE_TTL_MS).toISOString(),
  }
  const db = getDb()
  pruneQuotes(createdAt.getTime())
  const record: DbQuote = {
    id: quote.id,
    ownerKey: owner.key,
    userId: owner.userId,
    input: { ...input, items: normalizeItems(input.items) },
    fingerprint: quote.fingerprint,
    createdAt: quote.createdAt,
    expiresAt: quote.expiresAt,
  }
  db.quotes[quote.id] = record
  commit()
  scheduleScenarioEffects(quote)
  return quote
}

function pruneQuotes(nowMs: number) {
  const db = getDb()
  for (const [id, q] of Object.entries(db.quotes)) {
    if (Date.parse(q.createdAt) < nowMs - QUOTE_RETENTION_MS) delete db.quotes[id]
  }
}

// Efeitos dos cenários `price-change` e `sold-out` ------------------------------

const timers = new Set<ReturnType<typeof setTimeout>>()
let priceChangeScheduled = false
let soldOutScheduled = false

onDbReset(() => {
  for (const t of timers) clearTimeout(t)
  timers.clear()
  priceChangeScheduled = false
  soldOutScheduled = false
})

function later(ms: number, fn: () => void) {
  const t = setTimeout(() => {
    timers.delete(t)
    fn()
  }, ms)
  timers.add(t)
}

function scheduleScenarioEffects(quote: Quote) {
  const first = quote.lines[0]
  if (!first) return
  const scenario = getScenario()

  if (scenario.priceChangeAfterQuote && isPriceChangeArmed() && !priceChangeScheduled) {
    const { afterMs, percent } = scenario.priceChangeAfterQuote
    priceChangeScheduled = true
    later(afterMs, () => {
      priceChangeScheduled = false
      if (!isPriceChangeArmed()) return
      const nft = findNft(first.nftId)
      const edition = nft ? findEdition(nft, first.editionId) : undefined
      if (!nft || !edition) return
      const raised = eth(edition.priceEth)
        .times(100 + percent)
        .div(100)
        .toDecimalPlaces(6)
        .toFixed()
      disarmPriceChange()
      updateNft(nft.id, { editions: [{ id: edition.id, priceEth: raised }] })
    })
  }

  if (scenario.soldOutAfterQuote && isSoldOutArmed() && !soldOutScheduled) {
    soldOutScheduled = true
    later(scenario.soldOutAfterQuote.afterMs, () => {
      soldOutScheduled = false
      if (!isSoldOutArmed()) return
      disarmSoldOut()
      updateNft(first.nftId, { editions: [{ id: first.editionId, available: 0 }] })
    })
  }
}

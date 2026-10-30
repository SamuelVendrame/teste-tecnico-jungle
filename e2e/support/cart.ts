/**
 * Helpers do carrinho compartilhados entre os specs de compra.
 *
 * Fixtures usados (seed determinístico, ver src/mocks/README.md), ambos na rede
 * Ethereum (taxa 0.0021) e com edição única "Padrão":
 * - emerald-ape-042 (nft_001): 1.19 ETH, 16 disponíveis, máximo 5 por pedido;
 * - sage-nomad-009 (nft_002): 2.45 ETH, 10 disponíveis, máximo 5 por pedido.
 */
import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures'

export interface SeedNft {
  slug: string
  id: string
  editionId: string
  name: string
  edition: string
  priceEth: string
}

export const EMERALD: SeedNft = {
  slug: 'emerald-ape-042',
  id: 'nft_001',
  editionId: 'nft_001-ed1',
  name: 'Emerald Ape #042',
  edition: 'Padrão',
  priceEth: '1.19',
}

export const SAGE: SeedNft = {
  slug: 'sage-nomad-009',
  id: 'nft_002',
  editionId: 'nft_002-ed1',
  name: 'Sage Nomad #009',
  edition: 'Padrão',
  priceEth: '2.45',
}

/** Linha do carrinho (o `<li>` tem aria-label "Nome (Edição)"). */
export function cartLine(page: Page, nft: SeedNft): Locator {
  return page.locator(`li[aria-label="${nft.name} (${nft.edition})"]`)
}

/** Total da linha visível no viewport atual (desktop e mobile mostram em lugares diferentes). */
export function lineTotal(line: Locator): Locator {
  return line.locator('p', { hasText: 'Total do item' }).locator('visible=true').locator('data')
}

/** Resumo do carrinho ("Resumo da carteira"). */
export function cartSummary(page: Page): Locator {
  return page.getByRole('region', { name: 'Resumo da carteira' })
}

/**
 * Valor (`<dd>`) de uma linha dos totais (Subtotal, Desconto, Taxa de rede, Total).
 * `label` exato ou regex: "Total" sozinho também casaria com "Subtotal".
 */
export function totalsValue(scope: Locator, label: string | RegExp): Locator {
  const text =
    typeof label === 'string'
      ? new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
      : label
  return scope.locator('dt').filter({ hasText: text }).locator('xpath=following-sibling::dd')
}

/** Abre o detalhe e adiciona a edição padrão (quantidade 1) pelo botão do carrinho. */
export async function addFromDetail(page: Page, nft: SeedNft) {
  await page.goto(`/nft/${nft.slug}`)
  await expect(page.getByRole('heading', { level: 1, name: nft.name })).toBeVisible()
  const added = page.waitForResponse(
    (res) => res.url().endsWith('/api/cart/items') && res.request().method() === 'POST',
  )
  // Desktop e mobile têm botões próprios; só o do viewport atual está no accessibility tree.
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
  expect((await added).ok()).toBe(true)
}

/**
 * Semeia o carrinho direto pela API (rápido): usa o Bearer da sessão ou, para
 * visitante, o `X-Cart-Id` que a app também usará. Recarregue/navegue depois
 * para a app buscar o carrinho.
 */
export async function seedCart(page: Page, items: { nft: SeedNft; quantity?: number }[]) {
  await page.evaluate(
    async (lines) => {
      const raw = localStorage.getItem('kurio:session')
      const token = raw ? (JSON.parse(raw) as { token?: string }).token : undefined
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      } else {
        let cartId = localStorage.getItem('kurio:guest-cart')
        if (!cartId) {
          cartId = `guest_${crypto.randomUUID()}`
          localStorage.setItem('kurio:guest-cart', cartId)
        }
        headers['X-Cart-Id'] = cartId
      }
      for (const line of lines) {
        const res = await fetch('/api/cart/items', {
          method: 'POST',
          headers,
          body: JSON.stringify(line),
        })
        if (!res.ok) throw new Error(`seedCart falhou: ${res.status}`)
      }
    },
    items.map(({ nft, quantity }) => ({
      nftId: nft.id,
      editionId: nft.editionId,
      quantity: quantity ?? 1,
    })),
  )
}

/** Espera o resumo terminar de recalcular (sem skeleton nem "Atualizando valores…"). */
export async function settledTotals(scope: Locator) {
  const totals = scope.locator('dl').first()
  await expect(totals).toHaveAttribute('aria-busy', 'false')
}

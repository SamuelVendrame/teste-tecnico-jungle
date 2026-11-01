/**
 * Helpers do checkout e dos pedidos.
 *
 * Seed: a Ana tem a carteira principal "MetaMask principal" (Ethereum) e a
 * secundária "WalletConnect Polygon"; já existe 1 pedido confirmado dela
 * (`ord_seed_ana_001`), então o banco começa com 1 pedido.
 */
import type { Locator, Page, Request } from '@playwright/test'

import { expect, mockControl } from '../fixtures'

export function reviewSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Seus NFTs' })
}

export function confirmButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Confirmar compra' })
}

/**
 * "Perfil do colecionador": os campos vêm preenchidos pela carteira principal da conta
 * (Ana tem todos). Confere o preenchimento e deixa uma observação opcional.
 */
export async function fillCollector(page: Page) {
  await expect(page.getByLabel('Nome de exibição')).toHaveValue(/\S/)
  await expect(page.getByLabel('Código de indicação')).toHaveValue(/\S/)
  await expect(page.getByLabel('Nome ENS')).toHaveValue(/\S/)
  await page.getByLabel('Observação do colecionador').fill('Entrega para a galeria.')
}

/** Seleciona a carteira pelo apelido e conecta (POST /wallets/:id/connect no mock). */
export async function selectAndConnectWallet(page: Page, label = 'MetaMask principal') {
  const radio = page.getByRole('radio', { name: new RegExp(label) })
  await radio.click()
  await expect(radio).toBeChecked()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Carteira conectada', { exact: true })).toBeVisible()
}

/** Espera a cotação do checkout estar pronta e devolve o total exibido (string decimal). */
export async function settledQuoteTotal(page: Page): Promise<string> {
  const review = reviewSection(page)
  const totals = review.locator('dl')
  await expect(totals).toHaveAttribute('aria-busy', 'false')
  const total = totals.locator('dt', { hasText: /^Total$/ }).locator('xpath=following-sibling::dd')
  return (await total.locator('data').getAttribute('value')) ?? ''
}

export interface LineSnapshot {
  name: string
  quantity: string
  totalEth: string | null
}

/** Linhas exibidas numa lista de itens (revisão do checkout ou recibo do pedido). */
export async function readLines(list: Locator): Promise<LineSnapshot[]> {
  return list.evaluate((ul) =>
    Array.from(ul.querySelectorAll(':scope > li')).map((li) => ({
      name: li.querySelector('p')?.textContent?.trim() ?? '',
      quantity: /(\d+) unidade/.exec(li.textContent ?? '')?.[1] ?? '',
      totalEth: li.querySelector('data')?.getAttribute('value') ?? null,
    })),
  )
}

/** Totais (`<dl>` do QuoteTotals) como { Subtotal, Desconto, Taxa de rede, Total }. */
export async function readTotals(dl: Locator): Promise<Record<string, string | null>> {
  return dl.evaluate((el) =>
    Object.fromEntries(
      Array.from(el.querySelectorAll('dt')).map((dt) => [
        (dt.textContent ?? '').trim().replace(/\s*\(.*\)$/, ''),
        dt.nextElementSibling?.querySelector('data')?.getAttribute('value') ?? null,
      ]),
    ),
  )
}

/** Registra todo POST /api/orders feito pela página (cliques repetidos, reenvios). */
export function trackOrderPosts(page: Page): Request[] {
  const posts: Request[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') {
      posts.push(request)
    }
  })
  return posts
}

interface MockState {
  counts: { orders: number; pendingOrders: number }
}

export async function orderCounts(page: Page) {
  return (await mockControl<MockState>(page, 'state')).counts
}

export function orderIdFromUrl(page: Page): string {
  const match = /\/orders\/([^/?#]+)/.exec(page.url())
  if (!match) throw new Error(`URL não é de pedido: ${page.url()}`)
  return match[1]!
}

/**
 * Mantém pendentes os pedidos criados nesta página (por padrão o mock resolve em
 * 2,5 s), para os testes que precisam observar o estado pendente sem corrida.
 *
 * Usa só a própria simulação: a cada 25 ms procura `orderJobs` novos no banco
 * persistido, adia o `resolveAt` em 10 min, entrega o banco ao mock pelo evento
 * `storage` (o mesmo caminho da sincronização entre abas) e chama
 * `/__mock/clock/advance { ms: 0 }`, que reagenda os pedidos pendentes. O
 * horário fica persistido, então o adiamento sobrevive a um reload.
 * Para resolver depois: `/__mock/orders/:id/resolve` ou `releaseHeldOrders`.
 */
export async function holdOrdersPending(page: Page) {
  await page.evaluate(() => {
    const KEY = 'kurio:mockdb'
    const held = new Set<string>()
    let busy = false
    window.setInterval(() => {
      if (busy) return
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      const db = JSON.parse(raw) as {
        data: { orderJobs: Record<string, { resolveAt: string }> }
      }
      const fresh = Object.keys(db.data.orderJobs).filter((id) => !held.has(id))
      if (fresh.length === 0) return
      for (const id of fresh) {
        held.add(id)
        const job = db.data.orderJobs[id]!
        job.resolveAt = new Date(Date.parse(job.resolveAt) + 10 * 60_000).toISOString()
      }
      const newValue = JSON.stringify(db)
      localStorage.setItem(KEY, newValue)
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue }))
      busy = true
      void fetch('/__mock/clock/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ms: 0 }),
      }).finally(() => {
        busy = false
      })
    }, 25)
  })
}

/** Confirma que o adiamento de `holdOrdersPending` já está gravado para o pedido. */
export async function expectOrderHeld(page: Page, orderId: string) {
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const raw = localStorage.getItem('kurio:mockdb')
          const db = raw
            ? (JSON.parse(raw) as {
                data: {
                  orderJobs: Record<string, { resolveAt: string }>
                  meta: { clockOffsetMs: number }
                }
              })
            : null
          const job = db?.data.orderJobs[id]
          if (!job || !db) return 0
          return Date.parse(job.resolveAt) - (Date.now() + db.data.meta.clockOffsetMs)
        }, orderId),
      { message: `resolução do pedido ${orderId} adiada` },
    )
    .toBeGreaterThan(60_000)
}

/** Avança o relógio da API além do adiamento de `holdOrdersPending`: o mock resolve sozinho. */
export async function releaseHeldOrders(page: Page) {
  await mockControl(page, 'clock/advance', { ms: 10 * 60_000 + 1_000 })
}

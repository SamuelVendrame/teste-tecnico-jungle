import type { Page } from '@playwright/test'

import {
  expect,
  loginViaApi,
  mockControl,
  resetMocks,
  test,
  waitForSocket,
  type ScenarioName,
} from './fixtures'
import { EMERALD, SAGE, addFromDetail, cartLine, cartSummary, seedCart } from './support/cart'
import {
  confirmButton,
  fillCollector,
  orderCounts,
  orderIdFromUrl,
  readLines,
  readTotals,
  reviewSection,
  selectAndConnectWallet,
  settledQuoteTotal,
  trackOrderPosts,
} from './support/checkout'

/**
 * Pagamento e confirmação. O seed começa com 1 pedido (confirmado, da Ana); o
 * mock resolve pedidos pendentes em 2,5 s conforme o cenário.
 */

/** Ana logada, Emerald Ape #042 no carrinho e checkout pronto para confirmar. */
async function readyCheckout(page: Page, scenario: ScenarioName = 'default') {
  await resetMocks(page, scenario)
  await loginViaApi(page, 'ana')
  await seedCart(page, [{ nft: EMERALD }])
  await page.goto('/checkout')
  await fillCollector(page)
  await selectAndConnectWallet(page)
  await settledQuoteTotal(page)
  await expect(confirmButton(page)).toBeEnabled()
}

test.describe('Checkout', () => {
  test('compra completa: do detalhe ao recibo confirmado', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await addFromDetail(page, EMERALD)

    await page.goto('/cart')
    await expect(cartLine(page, EMERALD)).toBeVisible()
    await cartSummary(page).getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/checkout$/)

    await fillCollector(page)
    await selectAndConnectWallet(page, 'MetaMask principal')
    expect(await settledQuoteTotal(page)).toBe('1.1921')

    const review = reviewSection(page)
    const reviewedLines = await readLines(review.locator('ul').first())
    const reviewedTotals = await readTotals(review.locator('dl[aria-busy]'))
    expect(reviewedLines).toEqual([{ name: EMERALD.name, quantity: '1', totalEth: '1.19' }])

    await confirmButton(page).click()

    await expect(page).toHaveURL(/\/orders\/ord_[^/]+$/)
    const orderId = orderIdFromUrl(page)
    await expect(
      page.getByRole('heading', { name: 'Aguardando confirmação da rede…' }),
    ).toBeVisible()

    // Outro item entra no carrinho enquanto o pedido está pendente: não pode ser consumido.
    await seedCart(page, [{ nft: SAGE }])
    // Na confirmação o servidor tira do carrinho só as linhas compradas; o
    // `order.updated` invalida ['cart', userId] e a app rebusca o carrinho sem reload.
    const cartRefreshed = page.waitForResponse(async (res) => {
      if (!res.url().endsWith('/api/cart') || res.request().method() !== 'GET') return false
      const body = (await res.json()) as { items: { nftId: string }[] }
      return body.items.every((item) => item.nftId !== EMERALD.id)
    })

    await expect
      .poll(async () => page.getByRole('heading', { name: 'Pedido confirmado' }).isVisible(), {
        timeout: 10_000,
      })
      .toBe(true)

    const receipt = page.getByRole('article')
    const txHash = receipt
      .locator('dt', { hasText: 'ID da transação' })
      .locator('xpath=following-sibling::dd')
    await expect(txHash.locator('[title]')).toHaveAttribute('title', /^0x[0-9a-f]{64}$/)
    const explorer = receipt.getByRole('link', { name: /Ver no Etherscan/ })
    await expect(explorer).toHaveAttribute('href', /^https:\/\/etherscan\.io\/tx\/0x[0-9a-f]{64}$/)
    await expect(explorer).toHaveAttribute('target', '_blank')

    // O recibo reproduz o snapshot: mesmas linhas e totais da revisão.
    expect(await readLines(receipt.locator('ul').first())).toEqual(reviewedLines)
    expect(await readTotals(receipt.locator('dl[aria-busy]'))).toEqual(reviewedTotals)

    // Só o item comprado sai do carrinho (a app nunca chama POST /cart/consume).
    const refreshed = await cartRefreshed
    const items = ((await refreshed.json()) as { items: { nftId: string }[] }).items
    expect(items.map((item) => item.nftId)).toEqual([SAGE.id])
    await page.goto('/cart')
    await expect(cartLine(page, SAGE)).toBeVisible()
    await expect(cartLine(page, EMERALD)).toHaveCount(0)

    expect((await orderCounts(page)).orders).toBe(2)
    await page.goto('/profile#pedidos')
    await expect(page.getByRole('link', { name: `Ver pedido ${orderId}` })).toBeVisible()
  })

  test('pagamento recusado mostra o motivo e preserva o carrinho', async ({ page }) => {
    await readyCheckout(page, 'order-declined')

    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByText('Motivo: Pagamento recusado pela carteira')).toBeVisible()
    await expect(
      page.getByText('Nada foi cobrado e seus itens continuam no carrinho.'),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(cartLine(page, EMERALD)).toBeVisible()
  })

  test('clique duplo em confirmar envia um único POST /orders', async ({ page }) => {
    await readyCheckout(page)
    const posts = trackOrderPosts(page)

    await confirmButton(page).dblclick()

    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(
      page.getByRole('heading', { name: /Aguardando confirmação|Pedido confirmado/ }),
    ).toBeVisible()
    // Margem curta para um eventual segundo envio aparecer.
    await page.waitForTimeout(500)
    expect(posts).toHaveLength(1)
    expect((await orderCounts(page)).orders).toBe(2)
  })

  test('timeout na criação: "Tentar novamente" recupera o mesmo pedido', async ({ page }) => {
    await readyCheckout(page, 'order-timeout')
    const posts = trackOrderPosts(page)

    await confirmButton(page).click()

    // O servidor criou o pedido, mas só responderia em 12 s; o cliente desiste em 8 s.
    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'Não conseguimos confirmar se o pedido foi criado' })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    expect(posts).toHaveLength(1)
    expect((await orderCounts(page)).orders).toBe(2)

    await alert.getByRole('button', { name: 'Tentar novamente' }).click()

    await expect(page).toHaveURL(/\/orders\/ord_/)
    const orderId = orderIdFromUrl(page)
    expect(posts).toHaveLength(2)
    const [firstKey, secondKey] = posts.map((p) => p.headers()['idempotency-key'])
    expect(firstKey).toBeTruthy()
    expect(secondKey).toBe(firstKey)

    // A chave recuperou o pedido criado pela primeira tentativa: nada foi duplicado.
    const order = await page.evaluate(async (id) => {
      const raw = localStorage.getItem('kurio:session')
      const token = raw ? (JSON.parse(raw) as { token: string }).token : ''
      const res = await fetch(`/api/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return (await res.json()) as { idempotencyKey: string }
    }, orderId)
    expect(order.idempotencyKey).toBe(firstKey)
    expect((await orderCounts(page)).orders).toBe(2)

    await page.goto('/profile#pedidos')
    const orders = page.getByRole('region', { name: 'Pedidos' })
    await expect(orders.getByRole('link', { name: /^Ver pedido / })).toHaveCount(2)
    await expect(orders.getByRole('link', { name: `Ver pedido ${orderId}` })).toBeVisible()
  })

  test('edição esgotada antes de confirmar bloqueia o pedido', async ({ page }) => {
    await readyCheckout(page)
    await waitForSocket(page)
    const posts = trackOrderPosts(page)

    await mockControl(page, `nfts/${EMERALD.id}/update`, {
      editions: [{ id: EMERALD.editionId, available: 0 }],
    })

    const dialog = page.getByRole('dialog', { name: 'A cotação mudou' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Há itens sem disponibilidade suficiente')).toBeVisible()
    await dialog.getByRole('button', { name: 'Revisar e confirmar' }).click()
    await expect(dialog).toBeHidden()

    const review = reviewSection(page)
    await expect(review.getByRole('alert')).toContainText(
      `${EMERALD.name} (${EMERALD.edition}) esgotou.`,
    )
    await expect(confirmButton(page)).toBeDisabled()
    await expect(page.getByText('Ajuste os itens indisponíveis no carrinho.')).toBeVisible()

    await confirmButton(page).click({ force: true })
    await page.waitForTimeout(300)
    expect(posts).toHaveLength(0)
    expect((await orderCounts(page)).orders).toBe(1)
    await expect(page).toHaveURL(/\/checkout$/)
  })
})

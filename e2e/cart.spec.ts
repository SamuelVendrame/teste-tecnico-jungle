import { expect, loginViaApi, resetMocks, test } from './fixtures'
import { submitLogin } from './support/auth'
import {
  EMERALD,
  SAGE,
  addFromDetail,
  cartLine,
  cartSummary,
  lineTotal,
  settledTotals,
  totalsValue,
} from './support/cart'

/**
 * Carrinho: quantidades, remoção, cupom e persistência após refresh/login.
 * Emerald Ape #042 custa 1.19 ETH e Sage Nomad #009, 2.45 ETH (ambos Ethereum).
 */
test.describe('Carrinho', () => {
  test('visitante: quantidade, remoção, cupons e persistência após recarregar', async ({
    page,
  }) => {
    await resetMocks(page)
    await addFromDetail(page, EMERALD)
    await addFromDetail(page, SAGE)

    await page.goto('/cart')
    const summary = cartSummary(page)
    const emerald = cartLine(page, EMERALD)
    const sage = cartLine(page, SAGE)
    await expect(emerald).toBeVisible()
    await expect(sage).toBeVisible()
    await settledTotals(summary)
    await expect(totalsValue(summary, 'Subtotal')).toHaveText('3.64 ETH')

    // Quantidade: o +/- é agrupado (debounce) e vira um único PATCH.
    const patch = page.waitForRequest(
      (req) => req.method() === 'PATCH' && req.url().includes(`/api/cart/items/`),
    )
    await emerald.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(emerald.getByRole('status', { name: /: 2$/ })).toHaveText('2')
    const patchRequest = await patch
    expect(patchRequest.postDataJSON()).toMatchObject({ quantity: 2 })
    expect((await patchRequest.response())?.ok()).toBe(true)
    await expect(lineTotal(emerald)).toHaveText('2.38 ETH')
    await settledTotals(summary)
    await expect(totalsValue(summary, 'Subtotal')).toHaveText('4.83 ETH')

    // Remoção.
    await sage
      .getByRole('button', { name: `Remover ${SAGE.name} (${SAGE.edition}) do carrinho` })
      .click()
    await expect(sage).toHaveCount(0)
    await settledTotals(summary)
    await expect(totalsValue(summary, 'Subtotal')).toHaveText('2.38 ETH')

    // Cupom válido: aparece a linha de desconto (10% de 2.38).
    const coupon = summary.getByLabel('Código promocional')
    await coupon.fill('KURIO10')
    await summary.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary.getByText('Cupom KURIO10 aplicado')).toBeVisible()
    await settledTotals(summary)
    await expect(totalsValue(summary, 'Desconto (KURIO10)')).toContainText('0.238')
    await expect(totalsValue(summary, 'Total')).toHaveText('2.1441 ETH')

    // Remover o cupom volta o total sem desconto.
    await summary.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(summary.getByText('Cupom KURIO10 aplicado')).toHaveCount(0)
    await settledTotals(summary)
    await expect(totalsValue(summary, 'Desconto')).toContainText('0.00')
    await expect(totalsValue(summary, 'Total')).toHaveText('2.3821 ETH')

    // Cupom expirado: erro inline associado ao campo, nada aplicado.
    await coupon.fill('GENESIS')
    await summary.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary.getByRole('alert')).toHaveText('Cupom expirado')
    await expect(coupon).toHaveAttribute('aria-invalid', 'true')
    await expect(totalsValue(summary, 'Desconto')).toContainText('0.00')

    // Refresh: o carrinho do visitante vem do servidor (X-Cart-Id persistido).
    await page.reload()
    await expect(emerald).toBeVisible()
    await expect(emerald.getByRole('status', { name: /: 2$/ })).toHaveText('2')
    await expect(sage).toHaveCount(0)
    await settledTotals(summary)
    await expect(totalsValue(summary, 'Subtotal')).toHaveText('2.38 ETH')
  })

  test('login a partir de "Conectar e finalizar" mescla o carrinho do visitante', async ({
    page,
  }) => {
    await resetMocks(page)
    await addFromDetail(page, EMERALD)
    await addFromDetail(page, SAGE)
    await page.goto('/cart')
    await expect(cartLine(page, SAGE)).toBeVisible()

    await cartSummary(page).getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/login\?returnTo=/)
    await submitLogin(page, 'ana')

    // Volta para onde o usuário ia (o checkout), já com os itens do visitante.
    await expect(page).toHaveURL(/\/checkout$/)
    const review = page.getByRole('region', { name: 'Seus NFTs' })
    await expect(review.getByText(EMERALD.name)).toBeVisible()
    await expect(review.getByText(SAGE.name)).toBeVisible()

    await page.goto('/cart')
    await expect(cartLine(page, EMERALD)).toBeVisible()
    await expect(cartLine(page, SAGE)).toBeVisible()
    // O id de visitante foi descartado: o carrinho agora é o da conta.
    expect(await page.evaluate(() => localStorage.getItem('kurio:guest-cart'))).toBeNull()
  })

  test('carrinho de usuário autenticado persiste após recarregar', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await addFromDetail(page, SAGE)

    await page.goto('/cart')
    const sage = cartLine(page, SAGE)
    await expect(sage).toBeVisible()
    const saved = page.waitForResponse(
      (res) => res.request().method() === 'PATCH' && res.url().includes('/api/cart/items/'),
    )
    await sage.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(lineTotal(sage)).toHaveText('4.9 ETH')
    expect((await saved).ok()).toBe(true)

    await page.reload()
    await expect(sage).toBeVisible()
    await expect(sage.getByRole('status', { name: /: 2$/ })).toHaveText('2')
    await expect(lineTotal(sage)).toHaveText('4.9 ETH')
  })
})

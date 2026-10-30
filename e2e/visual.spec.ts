import type { Page } from '@playwright/test'

import { expect, loginViaApi, resetMocks, test, waitForImages } from './fixtures'
import { EMERALD, SAGE, cartLine, cartSummary, seedCart, settledTotals } from './support/cart'
import { settledCount } from './support/catalog'
import { reviewSection, settledQuoteTotal } from './support/checkout'

/**
 * Regressão visual. Os dados vêm do seed determinístico, a animação é desligada
 * (reducedMotion + `animations: 'disabled'`) e a página só é fotografada depois de
 * rede ociosa, fontes e imagens carregadas. Só a contagem regressiva da cotação no
 * checkout ("Cotação válida por") é mascarada: o resto não depende de data/hora.
 *
 * Baselines: `npm run test:e2e:update -- visual.spec.ts`.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await waitForImages(page)
  // Rola ao topo: o scroll do teste anterior ou do clique nunca entra no frame.
  await page.evaluate(() => window.scrollTo(0, 0))
}

test.describe('Regressão visual', () => {
  test('início (catálogo na página 1)', async ({ page }) => {
    await resetMocks(page)
    await settledCount(page)
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' }).first()).toBeVisible()
    await settle(page)

    await expect(page).toHaveScreenshot('home.png', { fullPage: true })
  })

  test('detalhe do NFT', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    // "Mais desta coleção" carrega depois do detalhe.
    await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()
    await expect(page.getByRole('status', { name: /Carregando/ })).toHaveCount(0)
    await settle(page)

    await expect(page).toHaveScreenshot('nft-detail.png', { fullPage: true })
  })

  test('carrinho com dois itens', async ({ page }) => {
    await resetMocks(page)
    await seedCart(page, [{ nft: EMERALD }, { nft: SAGE }])
    await page.goto('/cart')
    await expect(cartLine(page, EMERALD)).toBeVisible()
    await expect(cartLine(page, SAGE)).toBeVisible()
    await settledTotals(cartSummary(page))
    await settle(page)

    await expect(page).toHaveScreenshot('cart.png', { fullPage: true })
  })

  test('pagamento com carteira selecionada', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await seedCart(page, [{ nft: EMERALD }, { nft: SAGE }])
    await page.goto('/checkout')
    await expect(page.getByRole('radio', { name: /MetaMask principal/ })).toBeChecked()
    await settledQuoteTotal(page)
    await expect(reviewSection(page).getByText(SAGE.name)).toBeVisible()
    await settle(page)

    await expect(page).toHaveScreenshot('checkout.png', {
      fullPage: true,
      // A validade da cotação muda a cada segundo.
      mask: [page.getByText(/Cotação válida por/)],
    })
  })
})

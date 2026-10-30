import type { Page } from '@playwright/test'

import { expect, resetMocks, test, waitForImages } from './fixtures'
import { settledCount } from './support/catalog'

/**
 * Regressão visual. Os dados vêm do seed determinístico, a animação é desligada
 * (reducedMotion + `animations: 'disabled'`) e a página só é fotografada depois de
 * rede ociosa, fontes e imagens carregadas. Nada é mascarado: não há conteúdo
 * dependente de data/hora nas telas fotografadas.
 *
 * Baselines: `npm run test:e2e:update -- visual.spec.ts`.
 * Carrinho e checkout entram no spec do fluxo de compra.
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
})

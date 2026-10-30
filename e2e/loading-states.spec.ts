import { expect, mockControl, resetMocks, setScenario, test } from './fixtures'
import { cards, resultsList, settledCount } from './support/catalog'

/**
 * Consultas de leitura fazem até 2 novas tentativas em falhas transitórias
 * (5xx, rede) com atraso de 1 s e 2 s (src/app/query-client.ts). Por isso o
 * estado de erro só aparece depois de ~3 s e as falhas injetadas precisam ser
 * maiores que o número de tentativas.
 */
const ERROR_TIMEOUT = 20_000

test.describe('Carregamento e falhas', () => {
  test('cenário slow: skeletons aparecem antes dos cards e são substituídos por eles', async ({
    page,
  }) => {
    await resetMocks(page, 'slow')

    const skeleton = page.getByRole('status', { name: 'Carregando NFTs' })
    await expect(skeleton).toBeVisible()
    await expect(skeleton.locator('.skeleton').first()).toBeVisible()
    expect(await skeleton.locator('.skeleton').count()).toBeGreaterThanOrEqual(9)
    await expect(resultsList(page)).toHaveCount(0)

    await expect(cards(page)).toHaveCount(9, { timeout: 15_000 })
    await expect(skeleton).toHaveCount(0)
    await expect(page.locator('main .skeleton')).toHaveCount(0)
  })

  test('cenário slow: ao filtrar, os cards anteriores ficam marcados como ocupados até a nova lista chegar', async ({
    page,
  }) => {
    await resetMocks(page)
    await settledCount(page)
    await setScenario(page, 'slow')

    await page.getByRole('tab', { name: 'Em alta' }).click()

    await expect(resultsList(page)).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByText('Atualizando…')).toBeVisible()
    await expect(resultsList(page)).toHaveAttribute('aria-busy', 'false', { timeout: 15_000 })
    await expect(page.getByText('Atualizando…')).toBeHidden()
  })

  test('cenário slow: o detalhe mostra o skeleton antes do conteúdo', async ({ page }) => {
    await resetMocks(page, 'slow', '/nft/emerald-ape-042')

    await expect(page.getByRole('status', { name: 'Carregando NFT' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('status', { name: 'Carregando NFT' })).toHaveCount(0)
  })

  test('falha persistente em /api/nfts mostra o erro; "Tentar novamente" recupera os cards', async ({
    page,
  }) => {
    await resetMocks(page)
    await settledCount(page)
    // Mais falhas que tentativas (1 do loader + 3 da consulta) para o erro aparecer.
    await mockControl(page, 'fail-next', { path: '/api/nfts', status: 503, count: 8 })

    await page.getByRole('tab', { name: 'Novos lançamentos' }).click()

    const error = page
      .getByRole('alert')
      .filter({ hasText: 'Não foi possível carregar o catálogo' })
    await expect(error).toBeVisible({ timeout: ERROR_TIMEOUT })
    const retry = error.getByRole('button', { name: 'Tentar novamente' })
    await expect(retry).toBeEnabled()
    await expect(resultsList(page)).toHaveCount(0)

    // A API volta a responder; o usuário tenta de novo.
    await mockControl(page, 'fail-next/clear', {})
    await retry.click()

    await expect(error).toBeHidden()
    await expect(cards(page).first()).toBeVisible()
    expect(await settledCount(page)).toMatch(/NFTs, página 1 de \d+/)
  })

  test('uma falha transitória isolada é recuperada sozinha pelas novas tentativas', async ({
    page,
  }) => {
    await resetMocks(page)
    await settledCount(page)
    await mockControl(page, 'fail-next', { path: '/api/nfts', status: 503, count: 1 })

    await page.getByRole('tab', { name: 'Em alta' }).click()

    await expect(cards(page).first()).toBeVisible({ timeout: ERROR_TIMEOUT })
    await expect(page.getByRole('alert').filter({ hasText: 'catálogo' })).toHaveCount(0)
  })

  test('cenário offline: mostra o erro de conexão e recupera quando a rede volta', async ({
    page,
  }) => {
    await resetMocks(page, 'offline')

    const error = page
      .getByRole('alert')
      .filter({ hasText: 'Não foi possível carregar o catálogo' })
    await expect(error).toBeVisible({ timeout: ERROR_TIMEOUT })
    await expect(error).toContainText('Verifique sua conexão')
    await expect(resultsList(page)).toHaveCount(0)

    await setScenario(page, 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()

    await expect(cards(page)).toHaveCount(9)
    await expect(error).toBeHidden()
  })

  test('cenário offline: o detalhe mostra o erro da rota e recupera ao tentar novamente', async ({
    page,
  }) => {
    await resetMocks(page, 'offline', '/nft/emerald-ape-042')

    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar este NFT' })
    await expect(error).toBeVisible({ timeout: ERROR_TIMEOUT })

    await setScenario(page, 'default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })
})

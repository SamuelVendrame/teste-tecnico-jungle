import { expect, resetMocks, test } from './fixtures'

/**
 * Fixtures usados (seed determinístico, ver src/mocks/README.md):
 * - emerald-ape-042: 1 edição "Padrão", 1.19 ETH, 16 disponíveis, máximo 5 por pedido.
 * - ivory-baron-312: edição "Limitada" esgotada ao lado de edições disponíveis.
 * - cosmic-bloom-505: todas as edições esgotadas.
 * - golden-signal-160: 2 disponíveis (menos que o máximo por pedido, 5).
 * - emerald-ape-042 tem 19 avaliações (média 4.8); neon-vessel-552 não tem nenhuma.
 */
test.describe('Detalhe do NFT', () => {
  test('acesso direto renderiza nome, preço e edições', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/emerald-ape-042')

    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page).toHaveTitle(/Emerald Ape #042/)
    await expect(page.locator('data:visible', { hasText: '1.19 ETH' }).first()).toBeVisible()

    const edition = page.getByRole('radio', { name: 'Padrão, 1.19 ETH, 16 disponíveis' })
    await expect(edition).toBeVisible()
    await expect(edition).toBeChecked()
    await expect(page.getByRole('group', { name: 'Quantidade' })).toBeVisible()
  })

  test('mostra edições de preços diferentes e troca a edição selecionada', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/lunar-tide-882')

    const standard = page.getByRole('radio', { name: /^Padrão, 1\.34 ETH/ })
    const limited = page.getByRole('radio', { name: /^Limitada, 2\.68 ETH/ })
    await expect(standard).toBeChecked()

    await limited.click()

    await expect(limited).toBeChecked()
    await expect(page.locator('data:visible', { hasText: '2.68 ETH' }).first()).toBeVisible()
  })

  test('NFT inexistente mostra a mensagem na página e o link de volta ao início', async ({
    page,
  }) => {
    await resetMocks(page, 'default', '/nft/does-not-exist')

    await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()
    await expect(page.getByText('O NFT que você procura não existe')).toBeVisible()
    // A página não cai em tela branca: o shell (skip link, rodapé) continua presente.
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeAttached()

    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('ul[aria-label*="NFTs, página"]')).toBeVisible()
  })

  test('edição esgotada fica desabilitada e não pode ser selecionada', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/ivory-baron-312')

    const soldOut = page.getByRole('radio', { name: 'Limitada, 9.82 ETH, esgotada' })
    await expect(soldOut).toBeDisabled()
    await expect(soldOut).not.toBeChecked()
    await soldOut.click({ force: true })
    await expect(soldOut).not.toBeChecked()

    // A edição disponível continua selecionada e permite comprar.
    await expect(page.getByRole('radio', { name: /^Padrão, 4\.91 ETH/ })).toBeChecked()
    await expect(page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ })).toBeEnabled()
  })

  test('NFT com todas as edições esgotadas desabilita compra e carrinho', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/cosmic-bloom-505')

    await expect(page.getByRole('radio', { name: /esgotada$/ })).toHaveCount(2)
    for (const radio of await page.getByRole('radio').all()) await expect(radio).toBeDisabled()
    await expect(page.getByRole('button', { name: /^(ESGOTADA|Edição esgotada)$/ })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
    await expect(
      page.getByText('Esta edição está esgotada.').locator('visible=true').first(),
    ).toBeVisible()
  })

  test('o seletor de quantidade não passa do máximo por pedido', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/emerald-ape-042')
    const stepper = page.getByRole('group', { name: 'Quantidade' })
    const quantity = stepper.getByRole('status', { name: /^Quantidade: / })
    const increase = stepper.getByRole('button', { name: 'Aumentar quantidade' })
    const decrease = stepper.getByRole('button', { name: 'Diminuir quantidade' })

    await expect(quantity).toHaveText('1')
    await expect(decrease).toBeDisabled()
    await expect(
      page.getByText('Máximo de 5 por pedido').locator('visible=true').first(),
    ).toBeVisible()

    for (let expected = 2; expected <= 5; expected++) {
      await increase.click()
      await expect(quantity).toHaveText(String(expected))
    }

    await expect(increase).toBeDisabled()
    await increase.click({ force: true })
    await expect(quantity).toHaveText('5')

    await decrease.click()
    await expect(quantity).toHaveText('4')
    await expect(increase).toBeEnabled()
  })

  test('com estoque menor que o máximo por pedido, o limite é o estoque', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/golden-signal-160')
    const stepper = page.getByRole('group', { name: 'Quantidade' })
    const quantity = stepper.getByRole('status', { name: /^Quantidade: / })
    const increase = stepper.getByRole('button', { name: 'Aumentar quantidade' })

    await expect(
      page.getByText('Apenas 2 disponíveis').locator('visible=true').first(),
    ).toBeVisible()
    await increase.click()
    await expect(quantity).toHaveText('2')
    await expect(increase).toBeDisabled()
  })
})

test.describe('Avaliações de colecionadores', () => {
  test('a aba carrega as avaliações sob demanda e mostra mais em lotes', async ({ page }) => {
    const reviewRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/nfts/') && request.url().endsWith('/reviews'))
        reviewRequests.push(request.url())
    })
    await resetMocks(page, 'default', '/nft/emerald-ape-042')

    // Resumo (contagem) vem no próprio NFT; a lista só é pedida ao abrir a aba.
    await expect(page.getByRole('tab', { name: /\(19\)$/ })).toBeVisible()
    expect(reviewRequests).toHaveLength(0)

    // Rótulo curto no mobile ("Avaliações (19)"), completo no desktop.
    await page.getByRole('tab', { name: /^Avaliações( de colecionadores)? \(19\)$/ }).click()

    const reviews = page.getByRole('article', { name: /^Avaliação de / })
    await expect(reviews).toHaveCount(6)
    expect(reviewRequests).toHaveLength(1)
    await expect(page.getByText('4.8', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Mostrar mais avaliações (13 restantes)' }).click()
    await expect(reviews).toHaveCount(12)
    await page.getByRole('button', { name: 'Mostrar mais avaliações (7 restantes)' }).click()
    await expect(reviews).toHaveCount(18)
    await page.getByRole('button', { name: 'Mostrar mais avaliações (1 restante)' }).click()
    await expect(reviews).toHaveCount(19)
    await expect(page.getByRole('button', { name: /Mostrar mais avaliações/ })).toHaveCount(0)
  })

  test('NFT sem avaliações mostra o estado vazio', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/neon-vessel-552')

    await page.getByRole('tab', { name: /^Avaliações( de colecionadores)? \(0\)$/ }).click()

    await expect(
      page.getByText('Este NFT ainda não tem avaliações de colecionadores.'),
    ).toBeVisible()
    await expect(page.getByRole('article', { name: /^Avaliação de / })).toHaveCount(0)
  })

  test('falha ao carregar as avaliações oferece nova tentativa', async ({ page }) => {
    await resetMocks(page, 'default', '/nft/emerald-ape-042')
    await page.evaluate(() =>
      fetch('/__mock/fail-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 503 repetido: esgota os retries de falha transitória da query (ver src/app/query-client.ts).
        body: JSON.stringify({
          method: 'GET',
          path: '/api/nfts/emerald-ape-042/reviews',
          status: 503,
          count: 3,
        }),
      }),
    )

    await page.getByRole('tab', { name: /^Avaliações( de colecionadores)? \(19\)$/ }).click()

    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'Não foi possível carregar as avaliações.' })
    await expect(alert).toBeVisible({ timeout: 20_000 })
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()

    await expect(page.getByRole('article', { name: /^Avaliação de / })).toHaveCount(6)
  })
})

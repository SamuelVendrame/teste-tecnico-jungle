import { expect, resetMocks, test } from './fixtures'
import {
  cardNames,
  cardPrices,
  cards,
  closeFilters,
  filterOption,
  openFilters,
  resultsList,
  searchFor,
  settledCount,
  sortBy,
  urlState,
} from './support/catalog'

const ALL = '45 NFTs, página 1 de 5'

test.describe('Catálogo: busca, filtros, ordenação e paginação', () => {
  test('carrega a primeira página do catálogo completo', async ({ page }) => {
    await resetMocks(page)

    expect(await settledCount(page)).toBe(ALL)
    await expect(cards(page)).toHaveCount(9)
    // Valores padrão ficam fora da URL.
    expect(urlState(page)).toEqual({})
  })

  test('busca por texto atualiza a URL (q) e os resultados', async ({ page, isMobile }) => {
    await resetMocks(page)

    await searchFor(page, isMobile, 'emerald')

    await expect.poll(() => urlState(page).q).toBe('emerald')
    await expect(resultsList(page)).not.toHaveAttribute('aria-label', ALL)
    const names = await cardNames(page)
    expect(names.length).toBeGreaterThan(0)
    expect(names.length).toBeLessThan(45)
    for (const name of names) expect(name).toMatch(/emerald/i)
    await expect(page.getByText('Resultados para')).toBeVisible()
  })

  test('combina coleção e rede: a URL leva os dois filtros e a contagem diminui', async ({
    page,
    isMobile,
  }) => {
    await resetMocks(page)
    const filters = await openFilters(page, isMobile)

    await filterOption(filters, 'Arte 3D').click()
    await expect(resultsList(page)).toHaveAttribute('aria-label', '5 NFTs, página 1 de 1')
    expect(urlState(page).collection).toEqual(['arte-3d'])

    await filterOption(filters, 'Ethereum').click()
    await expect(resultsList(page)).toHaveAttribute('aria-label', '2 NFTs, página 1 de 1')
    expect(urlState(page)).toMatchObject({ collection: ['arte-3d'], network: ['ethereum'] })
    await expect(filterOption(filters, 'Arte 3D')).toHaveAttribute('aria-pressed', 'true')
    await expect(filterOption(filters, 'Ethereum')).toHaveAttribute('aria-pressed', 'true')

    await closeFilters(page, isMobile)
    await expect(cards(page)).toHaveCount(2)
  })

  test('ordenar por menor preço deixa os preços em ordem crescente', async ({ page, isMobile }) => {
    await resetMocks(page)

    await sortBy(page, isMobile, 'Menor preço')

    await expect.poll(() => urlState(page).sort).toBe('price-asc')
    await expect(cards(page).first().locator('p > data')).toHaveText('0.02 ETH')
    const prices = await cardPrices(page)
    expect(prices.length).toBe(9)
    expect(prices[0]!).toBeLessThanOrEqual(prices[1]!)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })

  test('paginação vai para a página 2 e filtrar depois reseta a página', async ({
    page,
    isMobile,
  }) => {
    await resetMocks(page)
    const firstPage = await cardNames(page)

    await page
      .getByRole('navigation', { name: 'Paginação do catálogo' })
      .getByRole('button', { name: 'Página 2' })
      .click()

    await expect(resultsList(page)).toHaveAttribute('aria-label', '45 NFTs, página 2 de 5')
    expect(urlState(page).page).toBe(2)
    const secondPage = await cardNames(page)
    expect(secondPage).not.toEqual(firstPage)

    const filters = await openFilters(page, isMobile)
    await filterOption(filters, 'Ethereum').click()

    await expect(resultsList(page)).toHaveAttribute('aria-label', /página 1 de/)
    await expect.poll(() => 'page' in urlState(page)).toBe(false)
    expect(urlState(page).network).toEqual(['ethereum'])
  })

  test('voltar, avançar e recarregar restauram filtros e cards', async ({ page, isMobile }) => {
    await resetMocks(page)
    const filters = await openFilters(page, isMobile)
    await filterOption(filters, 'Arte 3D').click()
    await expect(resultsList(page)).toHaveAttribute('aria-label', '5 NFTs, página 1 de 1')
    await filterOption(filters, 'Ethereum').click()
    await expect(resultsList(page)).toHaveAttribute('aria-label', '2 NFTs, página 1 de 1')
    const combinedNames = await cardNames(page)
    const combinedUrl = page.url()
    await closeFilters(page, isMobile)

    await page.goBack()
    await expect(resultsList(page)).toHaveAttribute('aria-label', '5 NFTs, página 1 de 1')
    expect(urlState(page)).toEqual({ collection: ['arte-3d'] })
    const backFilters = await openFilters(page, isMobile)
    await expect(filterOption(backFilters, 'Arte 3D')).toHaveAttribute('aria-pressed', 'true')
    await expect(filterOption(backFilters, 'Ethereum')).toHaveAttribute('aria-pressed', 'false')
    await closeFilters(page, isMobile)

    await page.goForward()
    await expect(resultsList(page)).toHaveAttribute('aria-label', '2 NFTs, página 1 de 1')
    expect(page.url()).toBe(combinedUrl)
    expect(await cardNames(page)).toEqual(combinedNames)

    await page.reload()
    await expect(resultsList(page)).toHaveAttribute('aria-label', '2 NFTs, página 1 de 1')
    expect(page.url()).toBe(combinedUrl)
    expect(await cardNames(page)).toEqual(combinedNames)
    const reloadFilters = await openFilters(page, isMobile)
    await expect(filterOption(reloadFilters, 'Arte 3D')).toHaveAttribute('aria-pressed', 'true')
    await expect(filterOption(reloadFilters, 'Ethereum')).toHaveAttribute('aria-pressed', 'true')
  })

  test('restaura a página e a ordenação ao voltar do detalhe', async ({ page }) => {
    await resetMocks(page, 'default', '/?page=2&sort=price-desc')
    await expect(resultsList(page)).toHaveAttribute('aria-label', '45 NFTs, página 2 de 5')
    const names = await cardNames(page)

    await cards(page).first().getByRole('link').click()
    await expect(page).toHaveURL(/\/nft\//)
    await page.goBack()

    await expect(resultsList(page)).toHaveAttribute('aria-label', '45 NFTs, página 2 de 5')
    expect(await cardNames(page)).toEqual(names)
    expect(urlState(page)).toMatchObject({ page: 2, sort: 'price-desc' })
  })

  test('busca sem resultados mostra o estado vazio e "Limpar filtros" restaura o catálogo', async ({
    page,
    isMobile,
  }) => {
    await resetMocks(page)

    await searchFor(page, isMobile, 'zzzz')

    const empty = page.getByRole('heading', { name: 'Nenhum NFT encontrado' })
    await expect(empty).toBeVisible()
    await expect(resultsList(page)).toHaveCount(0)
    // No desktop a sidebar também tem "Limpar filtros": o do estado vazio fica junto do título.
    const clear = empty.locator('..').getByRole('button', { name: 'Limpar filtros' })
    await expect(clear).toBeVisible()

    await clear.click()

    await expect(empty).toBeHidden()
    expect(await settledCount(page)).toBe(ALL)
    await expect.poll(() => 'q' in urlState(page)).toBe(false)
  })

  test('cenário empty-catalog mostra o estado vazio e permite limpar a busca', async ({ page }) => {
    await resetMocks(page, 'empty-catalog')
    const empty = page.getByRole('heading', { name: 'Nenhum NFT encontrado' })
    await expect(empty).toBeVisible()
    await expect(resultsList(page)).toHaveCount(0)

    // Com um filtro ativo, o estado vazio oferece "Limpar filtros".
    await resetMocks(page, 'empty-catalog', '/?q=ape')
    await expect(empty).toBeVisible()
    const clear = empty.locator('..').getByRole('button', { name: 'Limpar filtros' })
    await expect(clear).toBeVisible()

    await clear.click()

    await expect.poll(() => 'q' in urlState(page)).toBe(false)
    await expect(empty).toBeVisible()
    await expect(clear).toBeHidden()
  })
})

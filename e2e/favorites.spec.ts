import { expect, loginViaApi, mockControl, resetMocks, setScenario, test } from './fixtures'
import { cards, settledCount, urlState } from './support/catalog'

/**
 * Seed: a Ana favorita Emerald Ape #042 (nft_001), Cosmic Bloom #118 (nft_004) e
 * Golden Beat #207 (nft_007). Sage Nomad #009 (nft_002) não é favorito de ninguém.
 * Os dois primeiros ficam na primeira página da ordenação padrão.
 */
const FAVORITE = 'Emerald Ape #042'
const OTHER = 'Sage Nomad #009'

const add = (name: string) => `Adicionar ${name} aos favoritos`
const remove = (name: string) => `Remover ${name} dos favoritos`

test.describe('Favoritos', () => {
  test('visitante que clica no coração vai para o login com returnTo e volta depois', async ({
    page,
  }) => {
    await resetMocks(page, 'default', '/?sort=price-asc')
    await settledCount(page)

    await cards(page)
      .getByRole('button', { name: /^Adicionar .* aos favoritos$/ })
      .first()
      .click()

    await expect(page).toHaveURL(/\/login\?returnTo=/)
    expect(urlState(page).returnTo).toBe('/?sort=price-asc')

    await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('Senha123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page).toHaveURL(/\/\?sort=price-asc$/)
    await settledCount(page)
  })

  test('alternar o coração atualiza na hora (otimista) e persiste após recarregar', async ({
    page,
  }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await settledCount(page)
    const other = cards(page).getByRole('button', { name: add(OTHER) })
    const favorite = cards(page).getByRole('button', { name: remove(FAVORITE) })
    await expect(favorite).toHaveAttribute('aria-pressed', 'true')
    await expect(other).toHaveAttribute('aria-pressed', 'false')

    // Com a API lenta (1,5 a 3 s) a UI precisa mudar antes da resposta chegar.
    await setScenario(page, 'slow')
    const saved = page.waitForResponse(
      (res) => res.url().includes('/api/favorites/') && res.request().method() === 'PUT',
    )
    await other.click()
    await expect(cards(page).getByRole('button', { name: remove(OTHER) })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 1_000 },
    )
    await saved

    const removed = page.waitForResponse(
      (res) => res.url().includes('/api/favorites/') && res.request().method() === 'DELETE',
    )
    await favorite.click()
    await expect(cards(page).getByRole('button', { name: add(FAVORITE) })).toHaveAttribute(
      'aria-pressed',
      'false',
      { timeout: 1_000 },
    )
    await removed

    await setScenario(page, 'default')
    await page.reload()
    await settledCount(page)
    await expect(cards(page).getByRole('button', { name: remove(OTHER) })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(cards(page).getByRole('button', { name: add(FAVORITE) })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('o coração do detalhe reflete e altera o mesmo favorito', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await page.goto('/nft/emerald-ape-042')

    const heart = page.getByRole('button', { name: remove(FAVORITE) })
    await expect(heart).toHaveAttribute('aria-pressed', 'true')

    const removed = page.waitForResponse(
      (res) => res.url().includes('/api/favorites/') && res.request().method() === 'DELETE',
    )
    await heart.click()

    const back = page.getByRole('button', { name: add(FAVORITE) })
    await expect(back).toHaveAttribute('aria-pressed', 'false')
    await removed
    await page.reload()
    await expect(page.getByRole('button', { name: add(FAVORITE) })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('falha ao salvar desfaz o coração, avisa com um toast e permite tentar de novo', async ({
    page,
  }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await settledCount(page)
    const heart = cards(page).getByRole('button', { name: add(OTHER) })
    await expect(heart).toHaveAttribute('aria-pressed', 'false')
    // `path` aceita prefixo com "*": o PUT é /api/favorites/<id>.
    await mockControl(page, 'fail-next', {
      path: '/api/favorites*',
      method: 'PUT',
      status: 503,
      count: 1,
    })

    const failed = page.waitForResponse(
      (res) => res.url().includes('/api/favorites/') && res.request().method() === 'PUT',
    )
    await heart.click()

    expect((await failed).status()).toBe(503)
    await expect(page.getByText('Não foi possível salvar o favorito')).toBeVisible()
    await expect(cards(page).getByRole('button', { name: add(OTHER) })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // O servidor também não guardou nada.
    await page.reload()
    await settledCount(page)
    await expect(cards(page).getByRole('button', { name: add(OTHER) })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    // A falha era de uso único: a nova tentativa funciona e persiste.
    const saved = page.waitForResponse(
      (res) => res.url().includes('/api/favorites/') && res.request().method() === 'PUT',
    )
    await cards(page)
      .getByRole('button', { name: add(OTHER) })
      .click()
    await expect(cards(page).getByRole('button', { name: remove(OTHER) })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect((await saved).status()).toBe(200)
    await page.reload()
    await settledCount(page)
    await expect(cards(page).getByRole('button', { name: remove(OTHER) })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

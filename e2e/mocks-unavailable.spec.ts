import { expect, test } from './fixtures'

/**
 * Quando o Service Worker do MSW não intercepta a aba (ex.: "Bypass for network" nas
 * DevTools), as chamadas cairiam no servidor estático e cada tela mostraria um erro
 * genérico. A app detecta isso na inicialização e avisa com um "Recarregar".
 *
 * A condição é reproduzida com service workers bloqueados no contexto do navegador
 * (`serviceWorkers: 'block'`): o registro do worker falha, como num navegador que
 * bloqueia service workers.
 */
test.describe('API simulada indisponível na aba', () => {
  test.use({ serviceWorkers: 'block' })

  test('avisa na tela e o formulário de login explica o motivo', async ({ page }) => {
    await page.goto('/login')

    const banner = page
      .getByRole('alert')
      .filter({ hasText: 'A API simulada não está ativa nesta aba' })
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner.getByRole('button', { name: 'Recarregar página' })).toBeVisible()

    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('ana@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('Senha123')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(
      page.getByRole('alert').filter({ hasText: 'API simulada (MSW) não está ativa' }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

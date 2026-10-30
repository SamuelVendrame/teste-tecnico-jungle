import { expect, expireSession, loginViaApi, resetMocks, test, USERS } from './fixtures'
import { cards } from './support/catalog'
import {
  expectSignedIn,
  expectSignedOut,
  logout,
  openLoginInApp,
  submitLogin,
} from './support/auth'

test.describe('Conta: cadastro, login, logout e sessão', () => {
  test('cadastra um usuário novo, cai na home autenticado e mostra o usuário', async ({
    page,
    isMobile,
  }, testInfo) => {
    const email = `novo.${Date.now()}.${testInfo.project.name}@kurio.dev`
    await resetMocks(page, 'default', '/register')

    await page.getByLabel('Nome completo').fill('Carla Teste')
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Senha', { exact: true }).fill('Senha123')
    await page.getByLabel('Confirmar senha').fill('Senha123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('ul[aria-label*="NFTs, página"]')).toBeVisible()
    await expectSignedIn(page, isMobile, 'Carla Teste')
  })

  test('cadastro com e-mail já existente mostra o conflito no campo', async ({ page }) => {
    await resetMocks(page, 'default', '/register')

    await page.getByLabel('Nome completo').fill('Outra Ana')
    await page.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await page.getByLabel('Senha', { exact: true }).fill('Senha123')
    await page.getByLabel('Confirmar senha').fill('Senha123')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    const email = page.getByLabel('E-mail', { exact: true })
    await expect(page.getByText('Este e-mail já está cadastrado')).toBeVisible()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toBeFocused()
    await expect(page).toHaveURL(/\/register/)
    // O erro oferece o caminho para entrar na conta existente.
    await expect(page.getByRole('main').getByRole('link', { name: 'Entrar' }).last()).toBeVisible()
  })

  test('cadastro valida campos antes de enviar (senha curta e confirmação diferente)', async ({
    page,
  }) => {
    await resetMocks(page, 'default', '/register')

    await page.getByLabel('Nome completo').fill('Carla Teste')
    await page.getByLabel('E-mail', { exact: true }).fill('carla@kurio.dev')
    await page.getByLabel('Senha', { exact: true }).fill('abc')
    await page.getByLabel('Confirmar senha').fill('outra')
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Confirmar senha')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('As senhas não conferem')).toBeVisible()
    await expect(page).toHaveURL(/\/register/)
  })

  test('login com senha errada mostra o erro do formulário e não autentica', async ({
    page,
    isMobile,
  }) => {
    await resetMocks(page, 'default', '/login')

    await submitLogin(page, 'ana', 'SenhaErrada1')

    await expect(
      page.getByRole('alert').filter({ hasText: 'E-mail ou senha inválidos' }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => localStorage.getItem('kurio:session'))).toBeNull()
    await page.goto('/')
    await expectSignedOut(page, isMobile)
  })

  test('login pela interface e logout limpam a sessão do cabeçalho', async ({ page, isMobile }) => {
    await resetMocks(page, 'default', '/login')

    await submitLogin(page, 'ana')

    await expect(page).toHaveURL(/\/$/)
    await expectSignedIn(page, isMobile, USERS.ana.name)

    await logout(page, isMobile)

    await expect(page.getByText('Você saiu da sua conta').first()).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('kurio:session'))).toBeNull()
    // Recarregar não restaura a sessão encerrada.
    await page.reload()
    await expectSignedOut(page, isMobile)
  })

  test('login volta ao destino pedido (returnTo)', async ({ page }) => {
    await resetMocks(page, 'default', '/login?returnTo=%2Fnft%2Femerald-ape-042')

    await submitLogin(page, 'ana')

    await expect(page).toHaveURL(/\/nft\/emerald-ape-042$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })

  test('sessão expirada em rota privada redireciona para /login com returnTo', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    expect(await expireSession(page)).toMatchObject({ ok: true, expired: true })

    await page.goto('/profile')

    await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile/)
    await expect(page.getByText('Sua sessão expirou').first()).toBeVisible()

    // Entrando de novo, o usuário volta para onde estava.
    await submitLogin(page, 'ana')
    await expect(page).toHaveURL(/\/profile$/)
  })

  test('sessão expirada em página pública mostra o aviso e leva ao login', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await expireSession(page)

    await page.reload()

    const dialog = page.getByRole('dialog', { name: 'Sua sessão expirou' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Entrar novamente' }).click()
    await expect(page).toHaveURL(/\/login\?returnTo=%2F/)
  })

  test('troca de usuário não vaza os favoritos da conta anterior', async ({ page, isMobile }) => {
    await resetMocks(page, 'default', '/login')
    await submitLogin(page, 'ana')
    await expect(page).toHaveURL(/\/$/)
    // Emerald Ape #042 é favorito seeded da Ana e o primeiro card da home.
    const remove = cards(page).getByRole('button', {
      name: 'Remover Emerald Ape #042 dos favoritos',
    })
    await expect(remove).toHaveAttribute('aria-pressed', 'true')

    await logout(page, isMobile)
    // Sem sessão, o card volta a oferecer apenas "adicionar" (sem estado de favorito).
    await expect(
      cards(page).getByRole('button', { name: 'Adicionar Emerald Ape #042 aos favoritos' }),
    ).toBeVisible()

    // Login de outra conta sem recarregar: o cache em memória não pode reaproveitar dados da Ana.
    await openLoginInApp(page, isMobile)
    await submitLogin(page, 'bruno')
    if (isMobile) await page.getByRole('link', { name: 'Início' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expectSignedIn(page, isMobile, USERS.bruno.name)

    const add = cards(page).getByRole('button', {
      name: 'Adicionar Emerald Ape #042 aos favoritos',
    })
    await expect(add).toHaveAttribute('aria-pressed', 'false')
    await expect(
      cards(page).getByRole('button', { name: /^Remover .* dos favoritos$/ }),
    ).toHaveCount(0)
    // Nenhum dado da Ana sobra no armazenamento do navegador.
    const stored = await page.evaluate(() => localStorage.getItem('kurio:session'))
    expect(stored).toContain(USERS.bruno.email)
    expect(stored).not.toContain(USERS.ana.email)
  })
})

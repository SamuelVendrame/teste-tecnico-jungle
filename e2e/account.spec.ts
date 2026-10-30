import type { Locator, Page } from '@playwright/test'

import { expect, loginViaApi, resetMocks, test } from './fixtures'

/**
 * Conta: perfil, avatar, senha e carteiras, com erros de validação do cliente e
 * da API. Seed: Ana (`ana_ribeiro`) tem carteiras principal e secundária; Bruno
 * (`bruno_lima`) só a principal.
 */

/** PNG 8x8 válido (o avatar é recortado e redimensionado no navegador para 256 px). */
const PNG_8X8 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM40eWPFTEMLQkA2mBoQe671FQAAAAASUVORK5CYII=',
  'base64',
)

function profileForm(page: Page): Locator {
  return page.getByRole('region', { name: 'Dados do perfil' })
}

function passwordForm(page: Page): Locator {
  return page.getByRole('region', { name: 'Alterar senha' })
}

/** Mensagem de erro ligada ao campo por aria-describedby. */
async function fieldError(field: Locator): Promise<string> {
  const ids = (await field.getAttribute('aria-describedby')) ?? ''
  const page = field.page()
  const texts = await Promise.all(
    ids
      .split(/\s+/)
      .filter((id) => id.endsWith('-error'))
      .map((id) => page.locator(`[id="${id}"]`).textContent()),
  )
  return texts.join(' ').trim()
}

async function expectFieldError(field: Locator, message: string) {
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect.poll(() => fieldError(field)).toBe(message)
}

test.describe('Perfil', () => {
  test.beforeEach(async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await page.goto('/profile')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' }),
    ).toBeVisible()
  })

  test('editar nome e bio persiste após recarregar', async ({ page }) => {
    const form = profileForm(page)
    await form.getByLabel('Nome de exibição').fill('Ana R. Souza')
    await form.getByLabel('Bio', { exact: true }).fill('Arte generativa, fotografia e on-chain.')
    await form.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Perfil atualizado')).toBeVisible()
    await expect(form.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()

    await page.reload()
    await expect(profileForm(page).getByLabel('Nome de exibição')).toHaveValue('Ana R. Souza')
    await expect(profileForm(page).getByLabel('Bio', { exact: true })).toHaveValue(
      'Arte generativa, fotografia e on-chain.',
    )
  })

  test('nome de usuário em uso mostra o erro da API no campo', async ({ page }) => {
    const form = profileForm(page)
    const username = form.getByLabel('Nome de usuário')
    await username.fill('bruno_lima')
    await form.getByRole('button', { name: 'Salvar alterações' }).click()

    await expectFieldError(username, 'Este nome de usuário já está em uso.')
    await expect(username).toBeFocused()

    // Validação do cliente: formato inválido nem chega à API.
    await username.fill('Ana Ribeiro')
    await form.getByRole('button', { name: 'Salvar alterações' }).click()
    await expectFieldError(username, 'Use letras minúsculas, números e _')

    await page.reload()
    await expect(profileForm(page).getByLabel('Nome de usuário')).toHaveValue('ana_ribeiro')
  })

  test('upload de avatar mostra a prévia e persiste', async ({ page }) => {
    const form = profileForm(page)
    await expect(form.getByRole('img', { name: 'Pré-visualização do avatar' })).toHaveCount(0)

    await form.getByLabel('Arquivo do avatar').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: PNG_8X8,
    })
    const preview = form.getByRole('img', { name: 'Pré-visualização do avatar' })
    await expect(preview).toBeVisible()
    await expect(preview).toHaveAttribute('src', /^data:image\/(webp|png);base64,/)

    await form.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Perfil atualizado')).toBeVisible()

    await page.reload()
    await expect(
      profileForm(page).getByRole('img', { name: 'Pré-visualização do avatar' }),
    ).toHaveAttribute('src', /^data:image\/(webp|png);base64,/)
  })

  test('troca de senha: senha atual errada, confirmação divergente e sucesso', async ({ page }) => {
    const form = passwordForm(page)
    const current = form.getByLabel(/^Senha atual/)
    const next = form.getByLabel(/^Nova senha/)
    const confirm = form.getByLabel(/^Confirmar nova senha/)
    const submit = form.getByRole('button', { name: 'Alterar senha' })

    // Senha atual errada: erro da API no campo.
    await current.fill('Errada123')
    await next.fill('NovaSenha1')
    await confirm.fill('NovaSenha1')
    await submit.click()
    await expectFieldError(current, 'Senha atual incorreta.')

    // Confirmação divergente: validação do cliente.
    await current.fill('Senha123')
    await confirm.fill('OutraSenha1')
    await submit.click()
    await expectFieldError(confirm, 'As senhas não coincidem')

    await confirm.fill('NovaSenha1')
    await submit.click()
    await expect(page.getByText('Senha alterada')).toBeVisible()
    await expect(current).toHaveValue('')

    // A nova senha passa a valer no login; a antiga não.
    const status = await page.evaluate(async () => {
      const login = (password: string) =>
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'ana@kurio.dev', password }),
        }).then((r) => r.status)
      return { next: await login('NovaSenha1'), old: await login('Senha123') }
    })
    expect(status).toEqual({ next: 200, old: 401 })
  })
})

test.describe('Carteiras', () => {
  function slot(page: Page, kind: 'principal' | 'secundária'): Locator {
    return page.getByRole('article', { name: `Carteira ${kind}` })
  }

  test('editar o apelido da principal persiste; endereço inválido é recusado', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await page.goto('/wallets')
    const primary = slot(page, 'principal')
    await expect(primary.getByText('MetaMask principal')).toBeVisible()

    await primary.getByRole('button', { name: 'Editar carteira principal' }).click()
    let dialog = page.getByRole('dialog', { name: 'Editar carteira principal' })
    await expect(dialog).toBeVisible()

    // Endereço inválido: erro no campo e nada é salvo.
    const address = dialog.getByLabel('Endereço da carteira')
    await address.fill('0x123')
    await dialog.getByRole('button', { name: 'Salvar carteira' }).click()
    await expectFieldError(address, 'Endereço inválido')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()

    await primary.getByRole('button', { name: 'Editar carteira principal' }).click()
    dialog = page.getByRole('dialog', { name: 'Editar carteira principal' })
    await expect(dialog.getByLabel('Endereço da carteira')).toHaveValue(
      '0x8f3C2a91B7e4D05c6A1f9E2b3D4c5A6b7C8d9E0F',
    )
    await dialog.getByLabel('Apelido da carteira').fill('Cofre MetaMask')
    await dialog.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('Carteira principal atualizada')).toBeVisible()
    await expect(primary.getByText('Cofre MetaMask')).toBeVisible()

    await page.reload()
    await expect(slot(page, 'principal').getByText('Cofre MetaMask')).toBeVisible()
  })

  test('Bruno cadastra a carteira secundária', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'bruno')
    await page.goto('/wallets')
    const secondary = slot(page, 'secundária')
    await expect(
      secondary.getByText('Você ainda não cadastrou uma carteira secundária.'),
    ).toBeVisible()

    await secondary.getByRole('button', { name: 'Cadastrar carteira secundária' }).click()
    const dialog = page.getByRole('dialog', { name: 'Cadastrar carteira secundária' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Apelido da carteira').fill('Polygon do Bruno')
    await dialog.getByRole('radio', { name: 'WalletConnect' }).click()
    await dialog.getByRole('combobox', { name: 'Rede' }).click()
    await page.getByRole('option', { name: 'Polygon' }).click()
    await dialog
      .getByLabel('Endereço da carteira')
      .fill('0x00112233445566778899aAbBcCdDeEfF00112233')
    await dialog.getByRole('button', { name: 'Salvar carteira' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText('Carteira secundária cadastrada')).toBeVisible()
    await expect(secondary.getByText('Polygon do Bruno')).toBeVisible()

    await page.reload()
    const reloaded = slot(page, 'secundária')
    await expect(reloaded.getByText('Polygon do Bruno')).toBeVisible()
    await expect(reloaded.getByText('WalletConnect')).toBeVisible()
    await expect(reloaded.getByText('Polygon', { exact: true })).toBeVisible()
  })

  test('API recusa uma segunda carteira principal (WALLET_LIMIT)', async ({ page }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    const result = await page.evaluate(async () => {
      const raw = localStorage.getItem('kurio:session')
      const token = raw ? (JSON.parse(raw) as { token: string }).token : ''
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: 'primary',
          label: 'Outra principal',
          address: '0x00112233445566778899aabbccddeeff00112233',
          network: 'ethereum',
          provider: 'coinbase',
        }),
      })
      return { status: res.status, body: (await res.json()) as { error: { code: string } } }
    })
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('WALLET_LIMIT')
  })
})

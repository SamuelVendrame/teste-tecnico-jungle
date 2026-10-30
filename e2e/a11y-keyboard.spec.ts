import type { Locator, Page } from '@playwright/test'

import { expect, loginViaApi, resetMocks, test } from './fixtures'
import { openFilters, settledCount } from './support/catalog'

const RESULTS = 'ul[aria-label*="NFTs, página"]'

interface Focused {
  label: string
  inCard: boolean
  inMain: boolean
  inHeader: boolean
}

/** Descreve o elemento com foco: nome acessível aproximado e em que região ele está. */
async function focused(page: Page): Promise<Focused> {
  return page.evaluate((results) => {
    const el = document.activeElement
    const label =
      el?.getAttribute('aria-label') || el?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60)
    return {
      label: label || el?.tagName || '',
      inCard: Boolean(el?.closest(results)),
      inMain: Boolean(el?.closest('main')),
      inHeader: Boolean(el?.closest('header')),
    }
  }, RESULTS)
}

/** Pressiona Tab até o foco satisfazer o predicado; devolve o caminho percorrido. */
async function tabUntil(page: Page, done: (f: Focused) => boolean, max = 80): Promise<Focused[]> {
  const path: Focused[] = []
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const current = await focused(page)
    path.push(current)
    if (done(current)) return path
  }
  throw new Error(
    `Foco não chegou ao destino em ${max} Tabs: ${path.map((f) => f.label).join(' > ')}`,
  )
}

/** Garante que o foco permanece dentro do contêiner durante várias voltas de Tab/Shift+Tab. */
async function expectFocusTrapped(page: Page, container: Locator, tabs = 30) {
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab')
    const inside = await container.evaluate((root) => root.contains(document.activeElement))
    expect(inside, `foco saiu do contêiner após ${i + 1} teclas`).toBe(true)
  }
}

test.describe('Teclado e foco', () => {
  test('Tab percorre o skip link, o header e chega aos cards; Enter abre o detalhe', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'A ordem de Tab com Header é do desktop; o mobile usa a Tab Bar fixa.')
    await resetMocks(page)
    await settledCount(page)

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()

    const path = await tabUntil(page, (f) => f.inCard)
    const labels = path.map((f) => f.label)
    // Links do header antes do conteúdo: logo, Início, busca, carrinho e Entrar.
    const home = labels.indexOf('Início')
    const search = labels.indexOf('Buscar NFTs')
    const login = labels.indexOf('Entrar')
    expect(labels[0]).toBe('Kurio, página inicial')
    expect(home).toBeGreaterThan(0)
    expect(search).toBeGreaterThan(home)
    expect(login).toBeGreaterThan(search)
    expect(path.slice(0, login + 1).every((f) => f.inHeader)).toBe(true)
    // Só depois do header o foco entra no conteúdo, e o primeiro item da lista é o card.
    expect(path.slice(login + 1).every((f) => f.inMain || f.inCard)).toBe(true)
    expect(path.at(-1)!.inCard).toBe(true)

    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/nft\/[a-z0-9-]+$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('o skip link leva o foco ao conteúdo principal', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Verificado no desktop; o skip link é o mesmo componente no mobile.')
    await resetMocks(page)
    // Só aperta Tab com a app montada (resetMocks volta antes do React renderizar).
    await settledCount(page)

    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')

    await expect(page.locator('main#conteudo-principal')).toBeFocused()
    await page.keyboard.press('Tab')
    expect((await focused(page)).inHeader).toBe(false)
  })

  test('busca do header abre pelo teclado, fecha com Esc e devolve o foco ao ícone', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'No mobile a busca é um campo fixo na página, sem painel.')
    await resetMocks(page)
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })

    await trigger.focus()
    await page.keyboard.press('Enter')
    const input = page.getByRole('searchbox', { name: /Buscar NFTs por nome/ })
    await expect(input).toBeFocused()

    await page.keyboard.press('Escape')

    await expect(input).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('menu da conta (desktop) mantém o foco dentro e Esc devolve ao botão do avatar', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'O menu da conta só existe no Header (desktop).')
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    const trigger = page.getByRole('button', { name: 'Menu da conta de Ana Ribeiro' })

    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Perfil' })).toBeFocused()

    await expectFocusTrapped(page, menu, 12)
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem').first()).toBeAttached()

    await page.keyboard.press('Escape')

    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('filtros em Sheet (mobile) prendem o foco, Esc fecha e devolve o foco ao botão', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'O Sheet de filtros é o caminho do mobile; no desktop a sidebar é fixa.')
    await resetMocks(page)
    await settledCount(page)
    const trigger = page.getByRole('button', { name: 'Abrir filtros' })

    const sheet = await openFilters(page, true)
    // O foco entra no diálogo ao abrir.
    expect(await sheet.evaluate((root) => root.contains(document.activeElement))).toBe(true)

    await expectFocusTrapped(page, sheet, 40)

    await page.keyboard.press('Escape')

    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('login vazio marca os campos como inválidos e liga cada erro via aria-describedby', async ({
    page,
  }) => {
    await resetMocks(page, 'default', '/login')
    const email = page.getByLabel('E-mail', { exact: true })
    const password = page.getByLabel('Senha', { exact: true })

    await email.focus()
    await page.keyboard.press('Enter')

    for (const field of [email, password]) {
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      const describedBy = await field.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      const message = page.locator(`[id="${describedBy}"]`)
      await expect(message).toBeVisible()
      await expect(message).not.toHaveText('')
    }
    // O foco vai para o primeiro campo com erro, para quem usa só o teclado.
    await expect(email).toBeFocused()
    await expect(page).toHaveURL(/\/login/)

    // Corrigir o campo remove o estado inválido.
    await email.fill('ana@kurio.dev')
    await page.keyboard.press('Tab')
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('cadastro vazio descreve cada campo inválido com sua mensagem de erro', async ({ page }) => {
    await resetMocks(page, 'default', '/register')

    await page.getByRole('button', { name: 'Criar perfil' }).click()

    for (const label of ['Nome completo', 'E-mail', 'Senha', 'Confirmar senha']) {
      const field = page.getByLabel(label, { exact: true })
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      const describedBy = (await field.getAttribute('aria-describedby')) ?? ''
      // A senha também referencia a lista de requisitos; um dos ids é o do erro.
      const errorId = describedBy.split(' ').find((id) => id.endsWith('-error'))
      expect(errorId, `${label} sem id de erro em aria-describedby`).toBeTruthy()
      await expect(page.locator(`[id="${errorId}"]`)).toBeVisible()
    }
  })
})

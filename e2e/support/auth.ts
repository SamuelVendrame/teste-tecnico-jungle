/**
 * Helpers de conta compartilhados entre os specs. No desktop a conta fica no
 * Header (menu do avatar); no mobile não há Header, então o estado de sessão é
 * lido na Tab Bar e o "Sair" fica na barra da conta em /profile.
 */
import type { Page } from '@playwright/test'

import { expect, USERS } from '../fixtures'

type UserKey = keyof typeof USERS

/** Confirma que a UI mostra o usuário autenticado. */
export async function expectSignedIn(page: Page, isMobile: boolean, name: string) {
  if (isMobile) {
    await expect(page.getByRole('link', { name: 'Perfil', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Perfil (requer login)' })).toHaveCount(0)
    return
  }
  await expect(page.getByRole('button', { name: `Menu da conta de ${name}` })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toHaveCount(0)
}

/** Confirma que a UI voltou ao estado de visitante. */
export async function expectSignedOut(page: Page, isMobile: boolean) {
  if (isMobile) {
    await expect(page.getByRole('link', { name: 'Perfil (requer login)' })).toBeVisible()
    return
  }
  await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Menu da conta de/ })).toHaveCount(0)
}

/** Sai da conta pela interface (menu do avatar no desktop, barra da conta no mobile). */
export async function logout(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('link', { name: 'Perfil', exact: true }).click()
    await expect(page).toHaveURL(/\/profile/)
    await page
      .getByRole('navigation', { name: 'Conta' })
      .getByRole('button', { name: 'Sair' })
      .click()
  } else {
    await page.getByRole('button', { name: /^Menu da conta de/ }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
  }
  await expect(page).toHaveURL(/\/$/)
  await expectSignedOut(page, isMobile)
}

/** Vai para o login pela navegação da própria app (sem recarregar a página). */
export async function openLoginInApp(page: Page, isMobile: boolean) {
  const link = isMobile
    ? page.getByRole('link', { name: 'Perfil (requer login)' })
    : page.getByRole('link', { name: 'Entrar', exact: true })
  await link.click()
  await expect(page).toHaveURL(/\/login/)
}

/** Preenche e envia o formulário de login que já está aberto. */
export async function submitLogin(page: Page, user: UserKey, password?: string) {
  await page.getByLabel('E-mail', { exact: true }).fill(USERS[user].email)
  await page.getByLabel('Senha', { exact: true }).fill(password ?? USERS[user].password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

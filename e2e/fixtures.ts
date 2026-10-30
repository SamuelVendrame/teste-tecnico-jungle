/**
 * Fixtures compartilhadas dos testes E2E.
 *
 * Isolamento: cada teste começa com `resetMocks(page)`, que carrega a app com
 * `?scenario=<nome>&reset=1`, restaurando a seed do banco simulado, limpando
 * storage e aguardando o service worker do MSW ficar ativo.
 *
 * Os mocks rodam dentro do navegador (MSW), por isso os endpoints de controle
 * `/__mock/*` só funcionam via `page.evaluate(fetch)` depois do primeiro load.
 */
import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Senha123', name: 'Ana Ribeiro' },
  bruno: { email: 'bruno@kurio.dev', password: 'Senha123', name: 'Bruno Lima' },
} as const

export type ScenarioName =
  | 'default'
  | 'slow'
  | 'flaky'
  | 'offline'
  | 'empty-catalog'
  | 'session-expired'
  | 'order-declined'
  | 'order-timeout'
  | 'price-change'
  | 'coupon-expired'
  | 'out-of-order'
  | 'sold-out'

export async function waitForMocks(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { __kurioMocks?: unknown }).__kurioMocks), null, {
    timeout: 15_000,
  })
}

export async function resetMocks(page: Page, scenario: ScenarioName = 'default', path = '/') {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}scenario=${scenario}&reset=1`)
  await waitForMocks(page)
}

export async function mockControl<T = unknown>(
  page: Page,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  return page.evaluate(
    async ({ endpoint, body }) => {
      const res = await fetch(`/__mock/${endpoint}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return res.json()
    },
    { endpoint, body },
  ) as Promise<T>
}

export async function setScenario(page: Page, name: ScenarioName) {
  await mockControl(page, 'scenario', { name })
}

/** Login pela API (rápido) seguido de reload para a app hidratar a sessão. */
export async function loginViaApi(page: Page, user: keyof typeof USERS = 'ana') {
  const { email, password } = USERS[user]
  await page.evaluate(
    async ({ email, password }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error(`login falhou: ${res.status}`)
      const session = await res.json()
      localStorage.setItem(
        'kurio:session',
        JSON.stringify({ user: session.user, token: session.token, expiresAt: session.expiresAt }),
      )
    },
    { email, password },
  )
  await page.reload()
  await waitForMocks(page)
}

/** Login pela interface, para os testes do fluxo de conta. */
export async function loginViaUi(page: Page, user: keyof typeof USERS = 'ana') {
  const { email, password } = USERS[user]
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(email)
  await page.getByLabel(/^senha/i).fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
}

export const test = base.extend<{ isMobile: boolean }>({
  isMobile: async ({}, use, testInfo) => {
    await use(testInfo.project.name === 'mobile')
  },
})

export { expect }

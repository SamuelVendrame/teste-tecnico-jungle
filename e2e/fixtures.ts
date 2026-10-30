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
  await page.waitForFunction(
    () => Boolean((window as unknown as { __kurioMocks?: unknown }).__kurioMocks),
    null,
    {
      timeout: 15_000,
    },
  )
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
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/**
 * Expira no servidor simulado a sessão do usuário logado. O endpoint de controle
 * identifica a sessão pelo Bearer, então o token é lido do localStorage da página.
 */
export async function expireSession(page: Page) {
  return page.evaluate(async () => {
    const raw = localStorage.getItem('kurio:session')
    const token = raw ? (JSON.parse(raw) as { token?: string }).token : undefined
    const res = await fetch('/__mock/session/expire', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
    return (await res.json()) as { ok: boolean; expired: boolean }
  })
}

/** Extrai o número de textos como "1.19 ETH". */
export function parseEth(text: string | null): number {
  const match = /([\d.]+)\s*ETH/.exec(text ?? '')
  if (!match) throw new Error(`Preço não reconhecido: "${text}"`)
  return Number(match[1])
}

/** Aguarda todas as imagens da página terminarem de carregar (regressão visual). */
export async function waitForImages(page: Page) {
  // Imagens abaixo da dobra são lazy: força o carregamento antes de esperar.
  await page.evaluate(() => {
    document.querySelectorAll('img').forEach((img) => {
      img.loading = 'eager'
    })
  })
  await page.waitForFunction(() =>
    Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
  )
}

export const test = base.extend<{ isMobile: boolean }>({
  // eslint-disable-next-line no-empty-pattern, react-hooks/rules-of-hooks -- API do Playwright, não é hook do React
  isMobile: async ({}, runTest, testInfo) => {
    await runTest(testInfo.project.name === 'mobile')
  },
})

export { expect }

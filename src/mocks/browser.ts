/**
 * Ponto de entrada da camada de mocks no navegador (VITE_ENABLE_MSW=true).
 *
 * `startMocks()` precisa terminar ANTES de qualquer requisição: além dos handlers REST
 * no Service Worker, `worker.start()` aplica o interceptor de WebSocket na página,
 * e o socket.io-client só é carregado depois disso (ver `src/realtime/socket-client.ts`).
 *
 * Depois de iniciar, a função confere que o worker está de fato interceptando ESTA
 * aba (GET /__mock/state tem de voltar JSON). Quando não está, por exemplo com
 * "Bypass for network" ligado nas DevTools ou numa aba que o navegador deixou sem
 * controle do worker, ela falha com `MocksUnavailableError` em vez de deixar as
 * chamadas chegarem ao servidor estático e virarem erros genéricos.
 */
import { setupWorker, type SetupWorker } from 'msw/browser'

import { handlers } from './handlers'
import { applyScenarioFromUrl } from './scenarios'
import { socketHandlers } from './socket'

declare global {
  interface Window {
    /** Acesso dos testes (Playwright) ao worker do MSW. */
    __kurioMocks?: { worker: SetupWorker }
  }
}

export class MocksUnavailableError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'MocksUnavailableError'
  }
}

export const worker: SetupWorker = setupWorker(...handlers, ...socketHandlers)

let started: Promise<void> | null = null

async function verifyInterception(): Promise<void> {
  let response: Response
  try {
    response = await fetch('/__mock/state', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    throw new MocksUnavailableError(
      `GET /__mock/state falhou (${error instanceof Error ? error.message : String(error)}).`,
    )
  }
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !type.includes('application/json')) {
    const controlled = Boolean(navigator.serviceWorker?.controller)
    throw new MocksUnavailableError(
      `GET /__mock/state respondeu ${response.status} ${type || 'sem content-type'}; ` +
        `a aba ${controlled ? 'está' : 'não está'} sob controle do Service Worker.`,
    )
  }
}

export function startMocks(): Promise<void> {
  started ??= (async () => {
    applyScenarioFromUrl()
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    })
    await verifyInterception()
    window.__kurioMocks = { worker }
  })()
  return started
}

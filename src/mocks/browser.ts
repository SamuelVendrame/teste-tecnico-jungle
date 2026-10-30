/**
 * Ponto de entrada da camada de mocks no navegador (VITE_ENABLE_MSW=true).
 *
 * `startMocks()` precisa terminar ANTES de o React montar: além dos handlers REST
 * no Service Worker, `worker.start()` aplica o interceptor de WebSocket na página,
 * e o socket.io-client só é carregado depois disso (ver `src/realtime/socket-client.ts`).
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

export const worker: SetupWorker = setupWorker(...handlers, ...socketHandlers)

let started: Promise<void> | null = null

export function startMocks(): Promise<void> {
  started ??= (async () => {
    applyScenarioFromUrl()
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    })
    window.__kurioMocks = { worker }
  })()
  return started
}

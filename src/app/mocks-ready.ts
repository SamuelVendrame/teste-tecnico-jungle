/**
 * Sincroniza a camada de mocks com o resto da app sem bloquear a renderização.
 *
 * O MSW precisa registrar um Service Worker antes de interceptar `fetch`, e
 * instalar o interceptor de WebSocket antes de o `socket.io-client` ser avaliado.
 * Em vez de esperar isso para montar o React (o que atrasava o LCP em segundos
 * no mobile), a app renderiza na hora com skeletons e quem depende da rede
 * aguarda `mocksReady`:
 * - o interceptor de requisição do Axios (`src/api/client.ts`);
 * - o carregamento do socket.io-client (`src/realtime/socket-client.ts`).
 *
 * `mocksReady` resolve também quando os mocks FALHAM (worker não registrado ou
 * não interceptando esta aba): a app não trava, mas `getMocksStatus()` passa a
 * `failed`, o Axios recusa as requisições com uma mensagem explícita e o shell
 * mostra o aviso com "Recarregar" (`MocksUnavailableBanner`). Sem isso, as
 * chamadas iam parar no servidor estático e tudo virava "Algo deu errado".
 *
 * Com mocks desligados a promessa resolve imediatamente.
 */
import { useSyncExternalStore } from 'react'

export const MOCKS_ENABLED = import.meta.env.VITE_ENABLE_MSW !== 'false'

export type MocksStatus =
  { state: 'pending' } | { state: 'ready' } | { state: 'failed'; reason: string }

let status: MocksStatus = MOCKS_ENABLED ? { state: 'pending' } : { state: 'ready' }
const listeners = new Set<() => void>()

let resolveReady: () => void = () => {}

export const mocksReady: Promise<void> = MOCKS_ENABLED
  ? new Promise<void>((resolve) => {
      resolveReady = resolve
    })
  : Promise.resolve()

function setStatus(next: MocksStatus) {
  status = next
  resolveReady()
  for (const listener of listeners) listener()
}

export function markMocksReady() {
  if (status.state === 'pending') setStatus({ state: 'ready' })
}

export function markMocksFailed(reason: string) {
  setStatus({ state: 'failed', reason })
}

export function getMocksStatus(): MocksStatus {
  return status
}

export function areMocksReady(): boolean {
  return status.state !== 'pending'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMocksStatus(): MocksStatus {
  return useSyncExternalStore(subscribe, getMocksStatus, getMocksStatus)
}

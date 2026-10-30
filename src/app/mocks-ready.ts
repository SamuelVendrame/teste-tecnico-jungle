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
 * Com mocks desligados a promessa resolve imediatamente.
 */
export const MOCKS_ENABLED = import.meta.env.VITE_ENABLE_MSW !== 'false'

let resolveReady: () => void = () => {}
let settled = !MOCKS_ENABLED

export const mocksReady: Promise<void> = MOCKS_ENABLED
  ? new Promise<void>((resolve) => {
      resolveReady = () => {
        settled = true
        resolve()
      }
    })
  : Promise.resolve()

export function markMocksReady() {
  resolveReady()
}

export function areMocksReady(): boolean {
  return settled
}

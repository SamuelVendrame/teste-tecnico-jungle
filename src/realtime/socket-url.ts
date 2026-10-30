/**
 * Endereço do servidor Socket.IO, compartilhado pelo cliente (`socket-client.ts`)
 * e pelo servidor simulado (`src/mocks/socket.ts`) para que os dois nunca divirjam.
 *
 * Atenção: em `io('ws://host/socket')` o socket.io-client trata `/socket` como
 * NAMESPACE, não como caminho HTTP, e abriria `ws://host/socket.io/` no namespace
 * `/socket`. O binding do MSW só conhece o namespace `/`, então separamos a URL em
 * origem + `path` explícito: o WebSocket abre em
 * `ws://host/socket/socket.io/?EIO=4&transport=websocket`, namespace `/`.
 */
export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL || 'ws://localhost/socket'

export interface SocketEndpoint {
  /** Origem passada para `io()`, ex.: `ws://localhost`. */
  origin: string
  /** Caminho base configurado, sem barra final, ex.: `/socket`. */
  basePath: string
  /** Opção `path` do socket.io-client, ex.: `/socket/socket.io`. */
  enginePath: string
}

export function resolveSocketEndpoint(raw: string = SOCKET_URL): SocketEndpoint {
  const url = new URL(raw)
  const basePath = url.pathname.replace(/\/+$/, '')
  return {
    origin: `${url.protocol}//${url.host}`,
    basePath,
    enginePath: `${basePath}/socket.io`,
  }
}

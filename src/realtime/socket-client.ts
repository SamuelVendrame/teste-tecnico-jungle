/**
 * Wrapper único do socket.io-client.
 *
 * - Singleton preguiçoso: nada é criado no import. O pacote `socket.io-client` é
 *   carregado com `import()` na primeira chamada de `connectRealtime()`. Isso é
 *   obrigatório com MSW: o engine.io-client captura `globalThis.WebSocket` no
 *   momento em que o módulo é avaliado; se fosse importado estaticamente, ele
 *   guardaria o WebSocket nativo antes de `worker.start()` aplicar o interceptor
 *   e a conexão escaparia do mock. Também tira o socket do bundle inicial.
 * - Só transporte WebSocket (o binding do MSW não simula long-polling).
 * - `connectRealtime()` / `disconnectRealtime()` são idempotentes (StrictMode
 *   monta, desmonta e monta de novo): só a última intenção vale.
 * - A cada `connect` o cliente envia `session.bind` com o token atual;
 *   `rebindSession()` reenvia quando o token muda.
 */
import type { Socket } from 'socket.io-client'
import type { z } from 'zod'

import { SOCKET_EVENTS, type sessionBindPayload } from '@/api/contracts'
import { mocksReady } from '@/app/mocks-ready'
import { sessionStore } from '@/features/session/session-store'

import { resolveSocketEndpoint } from './socket-url'
import { realtimeStatus } from './status-store'

export type RealtimeEventListener = (name: string, payload: unknown) => void
export type RealtimeConnectListener = (info: { isReconnect: boolean }) => void

type SessionBindPayload = z.infer<typeof sessionBindPayload>

const DOMAIN_EVENTS = [SOCKET_EVENTS.nftUpdated, SOCKET_EVENTS.orderUpdated] as const

const eventListeners = new Set<RealtimeEventListener>()
const connectListeners = new Set<RealtimeConnectListener>()

let socket: Socket | null = null
let socketPromise: Promise<Socket> | null = null
/** Intenção atual da aplicação; o carregamento assíncrono respeita a última. */
let wanted = false
let everConnected = false

function emitBind(s: Socket) {
  const payload: SessionBindPayload = { token: sessionStore.getState().token }
  s.emit(SOCKET_EVENTS.sessionBind, payload)
}

function wire(s: Socket) {
  s.on('connect', () => {
    realtimeStatus.set('connected')
    emitBind(s)
    const isReconnect = everConnected
    everConnected = true
    connectListeners.forEach((l) => l({ isReconnect }))
  })
  s.on('disconnect', () => {
    // `active` continua true quando o Manager vai tentar reconectar sozinho.
    realtimeStatus.set(wanted && s.active ? 'reconnecting' : 'disconnected')
  })
  s.on('connect_error', () => {
    if (wanted && s.active) realtimeStatus.set('reconnecting')
  })
  s.io.on('reconnect_attempt', () => {
    if (wanted) realtimeStatus.set('reconnecting')
  })
  for (const name of DOMAIN_EVENTS) {
    s.on(name, (payload: unknown) => {
      eventListeners.forEach((l) => l(name, payload))
    })
  }
}

function loadSocket(): Promise<Socket> {
  if (socket) return Promise.resolve(socket)
  // O interceptor de WebSocket do MSW precisa estar instalado antes de o
  // engine.io-client ser avaliado; por isso esperamos os mocks subirem.
  socketPromise ??= mocksReady
    .then(() => import('socket.io-client'))
    .then(({ io }) => {
      const { origin, enginePath } = resolveSocketEndpoint()
      const s = io(origin, {
        path: enginePath,
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
      })
      wire(s)
      socket = s
      return s
    })
  return socketPromise
}

export function connectRealtime(): void {
  wanted = true
  loadSocket()
    .then((s) => {
      // connect() é no-op se já conectado/conectando.
      if (wanted) s.connect()
    })
    .catch((error: unknown) => {
      socketPromise = null
      realtimeStatus.set('disconnected')
      console.error('[realtime] failed to load socket.io-client', error)
    })
}

export function disconnectRealtime(): void {
  wanted = false
  socket?.disconnect()
  realtimeStatus.set('disconnected')
}

/** Reenvia `session.bind` com o token atual (login, logout, expiração). */
export function rebindSession(): void {
  if (socket?.connected) emitBind(socket)
}

export function addRealtimeEventListener(listener: RealtimeEventListener): () => void {
  eventListeners.add(listener)
  return () => {
    eventListeners.delete(listener)
  }
}

export function addRealtimeConnectListener(listener: RealtimeConnectListener): () => void {
  connectListeners.add(listener)
  return () => {
    connectListeners.delete(listener)
  }
}

/**
 * Servidor Socket.IO simulado com MSW + @mswjs/socket.io-binding.
 *
 * O socket.io-client da aplicação abre um WebSocket de verdade; o MSW intercepta
 * esse WebSocket na página (não no Service Worker) e este handler responde com o
 * protocolo Engine.IO/Socket.IO. Detalhes, limitações e contornos em
 * `src/mocks/README-socket.md`.
 *
 * Também expõe rotas HTTP de controle (usadas pelo Playwright):
 * - POST /__mock/socket/disconnect  derruba todas as conexões (o cliente reconecta)
 * - POST /__mock/socket/emit        {event, payload} envia um evento cru a todos
 * - GET  /__mock/socket/state       quantos clientes estão conectados
 */
import { toSocketIo } from '@mswjs/socket.io-binding'
import { http, HttpResponse, ws, type WebSocketHandlerConnection } from 'msw'

import { SOCKET_EVENTS, sessionBindPayload } from '@/api/contracts'
import { getDb, now } from '@/mocks/db'
import { mockEvents, type DomainEvent } from '@/mocks/events'
import { resolveSocketEndpoint } from '@/realtime/socket-url'

/** Menor que o pingInterval (25s) anunciado pelo handshake falso do binding. */
const PING_EVERY_MS = 20_000

/**
 * Resolve o dono da conexão a partir do token, lendo as sessões do banco simulado.
 * Token ausente, desconhecido ou expirado -> null (visitante).
 * TODO: trocar por `getUserIdByToken` de '@/mocks/db' quando o banco exportar.
 */
function getUserIdByToken(token: string | null): string | null {
  if (!token) return null
  const session = getDb().sessions[token]
  if (!session || Date.parse(session.expiresAt) <= now().getTime()) return null
  return session.userId
}

interface MockSocketConnection {
  raw: WebSocketHandlerConnection
  io: ReturnType<typeof toSocketIo>
  /** Dono da conexão, definido por `session.bind`. null = visitante. */
  userId: string | null
  pingTimer: ReturnType<typeof setInterval>
}

const connections = new Set<MockSocketConnection>()
let unsubscribeEvents: (() => void) | null = null

function forward(event: DomainEvent) {
  for (const conn of connections) {
    // Sem rooms no binding: o roteamento por usuário é feito aqui.
    if (event.type === 'order.updated' && conn.userId !== event.userId) continue
    conn.io.client.emit(event.type, event)
  }
}

function ensureSubscribed() {
  unsubscribeEvents ??= mockEvents.subscribe(forward)
}

function releaseIfIdle() {
  if (connections.size > 0 || !unsubscribeEvents) return
  unsubscribeEvents()
  unsubscribeEvents = null
}

const { origin, basePath } = resolveSocketEndpoint()
/**
 * O cliente abre `${origin}${basePath}/socket.io/?EIO=4&transport=websocket`.
 * O MSW ignora a query string no match, e o curinga cobre `/socket.io/`.
 */
export const SOCKET_LINK_URL = `${origin}${basePath}/*`

const socketLink = ws.link(SOCKET_LINK_URL)

const socketConnectionHandler = socketLink.addEventListener('connection', (connection) => {
  const io = toSocketIo(connection)
  const conn: MockSocketConnection = {
    raw: connection,
    io,
    userId: null,
    // Engine.IO v4: o servidor envia ping ("2") e o cliente responde pong ("3").
    // Sem isso o cliente derruba a conexão após pingInterval + pingTimeout.
    pingTimer: setInterval(() => connection.client.send('2'), PING_EVERY_MS),
  }
  connections.add(conn)
  ensureSubscribed()

  io.client.on(SOCKET_EVENTS.sessionBind, (_message, payload: unknown) => {
    const parsed = sessionBindPayload.safeParse(payload)
    conn.userId = getUserIdByToken(parsed.success ? parsed.data.token : null)
  })

  connection.client.addEventListener('close', () => {
    clearInterval(conn.pingTimer)
    connections.delete(conn)
    releaseIfIdle()
  })
})

interface EmitBody {
  event?: unknown
  payload?: unknown
}

const controlHandlers = [
  http.post('/__mock/socket/disconnect', () => {
    const closed = connections.size
    // Fecha do lado do servidor: para o socket.io-client é "transport close",
    // então o Manager agenda a reconexão automaticamente.
    for (const conn of [...connections]) conn.raw.client.close()
    return HttpResponse.json({ closed })
  }),

  http.post('/__mock/socket/emit', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as EmitBody | null
    if (!body || typeof body.event !== 'string') {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Informe { event: string, payload }' } },
        { status: 422 },
      )
    }
    // Cru e para todos: serve para injetar duplicatas, versões antigas e
    // eventos de outro usuário e provar que o CLIENTE os descarta.
    for (const conn of connections) conn.io.client.emit(body.event, body.payload)
    return HttpResponse.json({ delivered: connections.size })
  }),

  http.get('/__mock/socket/state', () =>
    HttpResponse.json({
      connected: connections.size,
      clients: [...connections].map((c) => ({ userId: c.userId })),
    }),
  ),
]

export const socketHandlers = [socketConnectionHandler, ...controlHandlers]

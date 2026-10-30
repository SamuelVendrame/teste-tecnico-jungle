/**
 * Liga socket -> cache -> sessão. Sem React: `useRealtime()` só chama
 * `startRealtime()` num efeito e usa o retorno como cleanup.
 *
 * - Eventos de domínio vão para `applyRealtimeEvent` com o usuário da sessão
 *   ATUAL (token válido + user), lido no momento em que o evento chega.
 * - `connect` depois de uma queda reconcilia os recursos ativos com o REST.
 * - Sessão: token vira null (logout/expiração) -> limpa o log de eventos e os
 *   avisos e refaz `session.bind` com token null, para o servidor parar de
 *   rotear `order.updated` do usuário anterior. Usuário diferente -> limpa o log.
 * - O cleanup libera todos os listeners e desconecta (idempotente).
 */
import type { QueryClient } from '@tanstack/react-query'

import { sessionStore, type SessionState } from '@/features/session/session-store'

import { applyRealtimeEvent, reconcileAfterReconnect } from './apply-events'
import { eventLog } from './event-log'
import { realtimeNotices } from './notices'
import {
  addRealtimeConnectListener,
  addRealtimeEventListener,
  connectRealtime,
  disconnectRealtime,
  rebindSession,
} from './socket-client'

function currentUserId(state: SessionState): string | null {
  return state.token && state.user ? state.user.id : null
}

export function startRealtime(queryClient: QueryClient): () => void {
  let previous = sessionStore.getState()

  const offEvents = addRealtimeEventListener((name, payload) => {
    applyRealtimeEvent(queryClient, name, payload, {
      userId: currentUserId(sessionStore.getState()),
    })
  })

  const offConnect = addRealtimeConnectListener(({ isReconnect }) => {
    if (isReconnect) reconcileAfterReconnect(queryClient)
  })

  const offSession = sessionStore.subscribe(() => {
    const next = sessionStore.getState()
    const tokenChanged = next.token !== previous.token
    const userChanged = (next.user?.id ?? null) !== (previous.user?.id ?? null)

    if ((tokenChanged && next.token === null) || userChanged) {
      eventLog.clear()
      realtimeNotices.clear()
    }
    if (tokenChanged) rebindSession()
    previous = next
  })

  connectRealtime()

  return () => {
    offEvents()
    offConnect()
    offSession()
    disconnectRealtime()
  }
}

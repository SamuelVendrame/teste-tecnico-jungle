/**
 * API pública do tempo real para a UI.
 *
 * - `useRealtime()`: montado UMA vez no layout raiz. Conecta ao montar,
 *   desconecta ao desmontar, liga eventos ao cache e à sessão. Não expõe nada.
 * - `useRealtimeStatus()`: 'connected' | 'reconnecting' | 'disconnected'.
 * - `useRealtimeNotices()` / `dismissNotice(id)` / `realtimeNotices`: avisos
 *   para toasts e região aria-live.
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { startRealtime } from './controller'

export function useRealtime(): void {
  const queryClient = useQueryClient()
  useEffect(() => startRealtime(queryClient), [queryClient])
}

export { useRealtimeStatus, type RealtimeStatus } from './status-store'
export {
  dismissNotice,
  realtimeNotices,
  useRealtimeNotices,
  type RealtimeNotice,
  type RealtimeNoticeKind,
} from './notices'

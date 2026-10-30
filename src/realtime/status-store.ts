/**
 * Estado da conexão em tempo real, exposto à UI por um store externo mínimo.
 *
 * - `disconnected`: ainda não conectou ou foi desligado de propósito (unmount).
 * - `connected`: handshake Socket.IO concluído.
 * - `reconnecting`: a conexão caiu (ou falhou) e o cliente está tentando de novo.
 */
import { useSyncExternalStore } from 'react'

export type RealtimeStatus = 'connected' | 'reconnecting' | 'disconnected'

let status: RealtimeStatus = 'disconnected'
const listeners = new Set<() => void>()

export const realtimeStatus = {
  get: (): RealtimeStatus => status,
  set(next: RealtimeStatus) {
    if (next === status) return
    status = next
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get, realtimeStatus.get)
}

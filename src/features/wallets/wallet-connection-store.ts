/**
 * Estado local (somente UI) da conexão simulada de cada carteira.
 * Compartilhado entre a página de carteiras e o checkout, que pode reaproveitar
 * `useWalletConnection` / `setWalletConnection`. Não é persistido nem enviado à API.
 */
import { useSyncExternalStore } from 'react'

export type WalletConnectionState = 'disconnected' | 'connecting' | 'connected' | 'refused'

const DEFAULT_STATE: WalletConnectionState = 'disconnected'
const states = new Map<string, WalletConnectionState>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getWalletConnection(walletId: string): WalletConnectionState {
  return states.get(walletId) ?? DEFAULT_STATE
}

export function setWalletConnection(walletId: string, state: WalletConnectionState) {
  if (getWalletConnection(walletId) === state) return
  if (state === DEFAULT_STATE) states.delete(walletId)
  else states.set(walletId, state)
  emit()
}

export function useWalletConnection(walletId: string | null | undefined): WalletConnectionState {
  return useSyncExternalStore(
    subscribe,
    () => (walletId ? getWalletConnection(walletId) : DEFAULT_STATE),
    () => DEFAULT_STATE,
  )
}

/** Simulação da página de carteiras: conectar leva um instante; conectada, desconecta na hora. */
export const SIMULATED_CONNECT_DELAY_MS = 900

export function toggleSimulatedConnection(walletId: string) {
  const current = getWalletConnection(walletId)
  if (current === 'connecting') return
  if (current === 'connected') {
    setWalletConnection(walletId, 'disconnected')
    return
  }
  setWalletConnection(walletId, 'connecting')
  setTimeout(() => {
    if (getWalletConnection(walletId) === 'connecting') {
      setWalletConnection(walletId, 'connected')
    }
  }, SIMULATED_CONNECT_DELAY_MS)
}

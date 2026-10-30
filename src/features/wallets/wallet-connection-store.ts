/**
 * Estado da conexão de cada carteira, compartilhado entre a página de carteiras
 * e o checkout (`useWalletConnection` / `setWalletConnection`). Não é persistido.
 *
 * Conectar passa pela API (`POST /wallets/:id/connect`, simulada no MSW): o
 * tempo de aprovação é a latência do cenário e a recusa é um 409 WALLET_REFUSED.
 * Nenhuma resposta é inventada aqui.
 */
import { useSyncExternalStore } from 'react'

import { isApiClientError } from '@/api/client'
import { walletApi } from '@/api/endpoints'

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

const attempts = new Map<string, number>()

/**
 * Pede a conexão à API. Resultado: `connected`, `refused` (409 WALLET_REFUSED) ou
 * `disconnected` (outra falha). Se nesse meio-tempo a carteira foi desconectada,
 * a tela saiu ou outra tentativa começou, a resposta antiga é descartada e o
 * estado atual é devolvido.
 */
export async function connectWallet(
  walletId: string,
  options: { simulateRefusal?: boolean } = {},
): Promise<WalletConnectionState> {
  const attempt = (attempts.get(walletId) ?? 0) + 1
  attempts.set(walletId, attempt)
  setWalletConnection(walletId, 'connecting')
  let next: WalletConnectionState
  try {
    await walletApi.connect(walletId, options)
    next = 'connected'
  } catch (error) {
    next = isApiClientError(error) && error.code === 'WALLET_REFUSED' ? 'refused' : 'disconnected'
  }
  if (attempts.get(walletId) !== attempt || getWalletConnection(walletId) !== 'connecting') {
    return getWalletConnection(walletId)
  }
  setWalletConnection(walletId, next)
  return next
}

/** Página de carteiras: conecta pela API; conectada, desconecta na hora. */
export function toggleSimulatedConnection(walletId: string) {
  const current = getWalletConnection(walletId)
  if (current === 'connecting') return
  if (current === 'connected') {
    setWalletConnection(walletId, 'disconnected')
    return
  }
  void connectWallet(walletId)
}

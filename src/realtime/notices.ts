/**
 * Avisos de tempo real voltados ao usuário (toasts + região aria-live na UI).
 *
 * São gerados por `apply-events.ts` apenas quando um evento APLICADO muda algo que
 * o usuário precisa saber: preço/disponibilidade de um item que está em algum
 * carrinho em cache, ou a resolução (confirmado/recusado) de um pedido.
 * A UI consome com `useRealtimeNotices()` e remove com `dismissNotice(id)`.
 */
import { useSyncExternalStore } from 'react'

export type RealtimeNoticeKind = 'nft-price' | 'nft-availability' | 'order'

export interface RealtimeNotice {
  id: string
  kind: RealtimeNoticeKind
  message: string
  nftId?: string
  orderId?: string
  /** Epoch ms em que o aviso foi criado. */
  at: number
}

/** Limite para a lista não crescer sem fim se a UI não dispensar avisos. */
const MAX_NOTICES = 20

let notices: readonly RealtimeNotice[] = []
const listeners = new Set<() => void>()
let seq = 0

function emitChange() {
  listeners.forEach((l) => l())
}

export const realtimeNotices = {
  getSnapshot: (): readonly RealtimeNotice[] => notices,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  push(notice: Omit<RealtimeNotice, 'id' | 'at'>): RealtimeNotice {
    seq += 1
    const full: RealtimeNotice = { ...notice, id: `notice-${Date.now()}-${seq}`, at: Date.now() }
    notices = [...notices, full].slice(-MAX_NOTICES)
    emitChange()
    return full
  },
  dismiss(id: string) {
    const next = notices.filter((n) => n.id !== id)
    if (next.length === notices.length) return
    notices = next
    emitChange()
  },
  clear() {
    if (notices.length === 0) return
    notices = []
    emitChange()
  },
}

export function dismissNotice(id: string): void {
  realtimeNotices.dismiss(id)
}

export function useRealtimeNotices(): readonly RealtimeNotice[] {
  return useSyncExternalStore(
    realtimeNotices.subscribe,
    realtimeNotices.getSnapshot,
    realtimeNotices.getSnapshot,
  )
}

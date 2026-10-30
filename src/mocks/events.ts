/**
 * Barramento de eventos de domínio da camada de mocks.
 * Os handlers REST publicam aqui toda mudança de NFT e de pedido; o servidor
 * Socket.IO simulado (src/mocks/socket.ts) assina e repassa aos clientes.
 */
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'

export type DomainEvent = NftUpdatedEvent | OrderUpdatedEvent

type Listener = (event: DomainEvent) => void

const listeners = new Set<Listener>()

export const mockEvents: {
  subscribe(listener: (event: DomainEvent) => void): () => void
  emit(event: DomainEvent): void
} = {
  subscribe(listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  emit(event) {
    for (const listener of [...listeners]) {
      try {
        listener(event)
      } catch (error) {
        console.error('[mocks] listener de evento falhou', error)
      }
    }
  },
}

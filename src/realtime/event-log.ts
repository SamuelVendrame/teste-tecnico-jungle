/**
 * Registro de eventos já vistos, para tolerar duplicatas e eventos antigos.
 *
 * - `seen`: LRU (Set em ordem de inserção) com os últimos 500 `eventId`s.
 * - `versions`: `kind:id` -> maior versão já aceita para aquele recurso.
 *
 * `shouldApply(event)` responde false para `eventId` repetido ou para versão
 * <= última aceita, e registra o evento quando responde true. É a primeira
 * barreira; a segunda é a comparação com a versão que está no cache
 * (`apply-events.ts`), que cobre o caso em que o REST já trouxe um estado novo.
 *
 * O log é por sessão: é limpo no logout/expiração e na troca de usuário.
 */
const MAX_SEEN = 500

export interface LoggableEvent {
  eventId: string
  version: number
  resource: { kind: string; id: string }
}

export function createEventLog(maxSeen = MAX_SEEN) {
  const seen = new Set<string>()
  const versions = new Map<string, number>()

  function remember(eventId: string) {
    // Reinserir move o id para o fim (mais recente) da ordem do Set.
    seen.delete(eventId)
    seen.add(eventId)
    while (seen.size > maxSeen) {
      const oldest = seen.values().next().value
      if (oldest === undefined) break
      seen.delete(oldest)
    }
  }

  return {
    shouldApply(event: LoggableEvent): boolean {
      if (seen.has(event.eventId)) {
        remember(event.eventId)
        return false
      }
      remember(event.eventId)
      const key = `${event.resource.kind}:${event.resource.id}`
      const last = versions.get(key)
      if (last !== undefined && event.version <= last) return false
      versions.set(key, event.version)
      return true
    },
    clear() {
      seen.clear()
      versions.clear()
    },
    get size() {
      return seen.size
    },
  }
}

export type EventLog = ReturnType<typeof createEventLog>

/** Log único da aplicação (uma conexão Socket.IO por aba). */
export const eventLog = createEventLog()

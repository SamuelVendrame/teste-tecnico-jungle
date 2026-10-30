import { QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'

/**
 * Política de cache e retries (documentada em ARCHITECTURE.md):
 * - staleTime 30s: dados de catálogo são considerados frescos por 30s; eventos
 *   Socket.IO e invalidações após mutations atualizam antes disso quando necessário.
 * - gcTime 5min: dados saem da memória 5min depois de não terem observadores.
 * - retry: só em falhas transitórias (rede, 5xx, 408, 429). Nunca em 4xx de
 *   negócio (401, 403, 404, 409, 422), pois repetir não muda o resultado.
 * - Mutations não fazem retry automático: evita duplicar efeitos. A idempotência
 *   de pedidos é feita por chave explícita, não por retry.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false
        return isTransientError(error)
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    },
    mutations: {
      retry: false,
    },
  },
})

export function isTransientError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    if (!error.response) return true // rede / timeout / cancelamento
    const status = error.response.status
    return status >= 500 || status === 408 || status === 429
  }
  return false
}

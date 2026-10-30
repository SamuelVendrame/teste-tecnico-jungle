import { QueryClient } from '@tanstack/react-query'

import { isApiClientError } from '@/api/client'

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

/**
 * O interceptor do Axios (`src/api/client.ts`) rejeita sempre com `ApiClientError`:
 * status 0 (rede/timeout), 5xx, 408 e 429 são transitórios. Requisição cancelada
 * (resposta obsoleta descartada pelo `signal`) nunca é repetida.
 */
export function isTransientError(error: unknown): boolean {
  return isApiClientError(error) && error.isTransient && !error.canceled
}

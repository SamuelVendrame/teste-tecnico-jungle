import axios, { AxiosError, type AxiosRequestConfig } from 'axios'

import { HEADERS, apiError, type ApiError, type ApiErrorCode } from './contracts'

/**
 * Cliente HTTP único. Toda chamada REST passa por aqui.
 *
 * - Token de sessão e id de carrinho de visitante são lidos de um "token store"
 *   injetado pela camada de sessão (evita import circular com o estado).
 * - Respostas de erro são normalizadas em `ApiClientError` com o código do
 *   contrato, para que a UI trate por código e não por status HTTP.
 * - `signal` do TanStack Query é repassado ao Axios: consultas obsoletas são
 *   canceladas quando os parâmetros mudam.
 */

export interface AuthTokenStore {
  getToken(): string | null
  getGuestCartId(): string | null
  onUnauthorized(): void
}

let tokenStore: AuthTokenStore = {
  getToken: () => null,
  getGuestCartId: () => null,
  onUnauthorized: () => {},
}

export function bindTokenStore(store: AuthTokenStore) {
  tokenStore = store
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStore.getToken()
  if (token) config.headers.set(HEADERS.authorization, `Bearer ${token}`)
  const cartId = tokenStore.getGuestCartId()
  if (cartId) config.headers.set(HEADERS.cartId, cartId)
  config.headers.set(HEADERS.requestId, crypto.randomUUID())
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      const parsed = apiError.safeParse(error.response?.data)
      const status = error.response?.status ?? 0
      const code: ApiErrorCode = parsed.success
        ? parsed.data.error.code
        : status === 0
          ? 'SERVICE_UNAVAILABLE'
          : status >= 500
            ? 'INTERNAL_ERROR'
            : 'INTERNAL_ERROR'
      const message = parsed.success
        ? parsed.data.error.message
        : error.code === 'ECONNABORTED'
          ? 'A requisição demorou demais. Verifique sua conexão.'
          : status === 0
            ? 'Sem conexão com o servidor.'
            : 'Algo deu errado. Tente novamente.'
      const apiErr = new ApiClientError({
        code,
        message,
        status,
        details: parsed.success ? parsed.data.error.details : undefined,
        meta: parsed.success ? parsed.data.error.meta : undefined,
        canceled: axios.isCancel(error),
        cause: error,
      })
      if (code === 'UNAUTHORIZED' && status === 401) tokenStore.onUnauthorized()
      return Promise.reject(apiErr)
    }
    return Promise.reject(error)
  },
)

export class ApiClientError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details?: ApiError['error']['details']
  readonly meta?: ApiError['error']['meta']
  readonly canceled: boolean

  constructor(init: {
    code: ApiErrorCode
    message: string
    status: number
    details?: ApiError['error']['details']
    meta?: ApiError['error']['meta']
    canceled: boolean
    cause?: unknown
  }) {
    super(init.message, { cause: init.cause })
    this.name = 'ApiClientError'
    this.code = init.code
    this.status = init.status
    this.details = init.details
    this.meta = init.meta
    this.canceled = init.canceled
  }

  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500 || this.status === 408 || this.status === 429
  }
}

export function isApiClientError(e: unknown): e is ApiClientError {
  return e instanceof ApiClientError
}

/** Helper para requisições tipadas com validação Zod da resposta. */
export async function request<T>(
  config: AxiosRequestConfig,
  parse: (data: unknown) => T,
): Promise<T> {
  const res = await api.request(config)
  return parse(res.data)
}

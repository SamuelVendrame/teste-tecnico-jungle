/**
 * Erro de domínio da API simulada. Lançado pelas regras de negócio e convertido
 * em resposta `{ error: { code, message, details?, meta? } }` pelo wrapper de rotas.
 */
import type { ApiErrorCode } from '@/api/contracts'

export type FieldErrors = Record<string, string[]>

export class ApiProblem extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details?: FieldErrors
  readonly meta?: Record<string, unknown>

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    extra: { details?: FieldErrors; meta?: Record<string, unknown> } = {},
  ) {
    super(message)
    this.name = 'ApiProblem'
    this.status = status
    this.code = code
    this.details = extra.details
    this.meta = extra.meta
  }
}

export const problems = {
  unauthorized: (message = 'Sessão inválida ou expirada. Entre novamente.') =>
    new ApiProblem(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Você não tem permissão para acessar este recurso.') =>
    new ApiProblem(403, 'FORBIDDEN', message),
  notFound: (message = 'Recurso não encontrado.') => new ApiProblem(404, 'NOT_FOUND', message),
  validation: (details: FieldErrors, message = 'Revise os campos destacados.') =>
    new ApiProblem(422, 'VALIDATION_ERROR', message, { details }),
}

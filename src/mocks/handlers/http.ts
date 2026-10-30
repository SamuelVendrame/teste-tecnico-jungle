/**
 * Infra comum dos handlers REST:
 * - `route()` registra um handler em `/api<path>` e aplica o cenário ativo
 *   (latência, offline, flaky) antes da regra de negócio;
 * - `ApiProblem` lançado pelo domínio vira `{ error: { code, message, details?, meta? } }`;
 * - `parseBody()` valida com os schemas Zod do contrato e devolve 422 por campo.
 */
import { http, HttpResponse, type PathParams, type RequestHandler } from 'msw'
import type { z } from 'zod'

import { apiErrorCode, type ApiError } from '@/api/contracts'

import { ApiProblem, problems, type FieldErrors } from '../domain/errors'
import { getScenario, nextLatency, shouldFailFlaky, takeInjectedFailure } from '../scenarios'
import { sleep } from '../utils'

export const API_BASE = '/api'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface RouteContext {
  request: Request
  params: PathParams
  url: URL
}

type Resolver = (ctx: RouteContext) => Response | Promise<Response>

export function json<T>(body: T, status = 200): Response {
  return HttpResponse.json(body as never, { status })
}

export function noContent(): Response {
  return new HttpResponse(null, { status: 204 })
}

export function errorResponse(problem: ApiProblem): Response {
  const body: ApiError = {
    error: {
      code: problem.code,
      message: problem.message,
      ...(problem.details ? { details: problem.details } : {}),
      ...(problem.meta ? { meta: problem.meta } : {}),
    },
  }
  return HttpResponse.json(body, { status: problem.status })
}

/** Aplica o cenário ativo. Devolve uma resposta de falha ou null para seguir. */
async function applyNetworkConditions(request: Request, url: URL): Promise<Response | null> {
  const scenario = getScenario()
  if (scenario.offline) return HttpResponse.error()
  await sleep(nextLatency(url.pathname, request.method))
  const injected = takeInjectedFailure(request.method, url.pathname)
  if (injected) {
    if (injected.status === 0) return HttpResponse.error()
    const code = apiErrorCode.safeParse(injected.code)
    return errorResponse(
      new ApiProblem(
        injected.status,
        code.success ? code.data : 'INTERNAL_ERROR',
        injected.message,
      ),
    )
  }
  if (shouldFailFlaky(url.pathname)) {
    return errorResponse(
      new ApiProblem(
        503,
        'SERVICE_UNAVAILABLE',
        'Serviço temporariamente indisponível. Tente novamente.',
      ),
    )
  }
  return null
}

export function route(method: Method, path: string, resolver: Resolver): RequestHandler {
  return http[method](`${API_BASE}${path}`, async ({ request, params }) => {
    const url = new URL(request.url)
    const blocked = await applyNetworkConditions(request, url)
    if (blocked) return blocked
    try {
      return await resolver({ request, params, url })
    } catch (error) {
      if (error instanceof ApiProblem) return errorResponse(error)
      console.error('[mocks] erro inesperado em', method.toUpperCase(), path, error)
      return errorResponse(
        new ApiProblem(500, 'INTERNAL_ERROR', 'Erro inesperado no servidor simulado.'),
      )
    }
  })
}

export function param(params: PathParams, name: string): string {
  const value = params[name]
  const single = Array.isArray(value) ? value[0] : value
  if (typeof single !== 'string' || single === '') throw problems.notFound()
  return decodeURIComponent(single)
}

/** Converte issues do Zod em `details` por campo (`a.b.0` -> chave "a.b.0"). */
export function zodDetails(error: z.ZodError): FieldErrors {
  const details: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_'
    ;(details[key] ??= []).push(issue.message)
  }
  return details
}

export function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value)
  if (!result.success) throw problems.validation(zodDetails(result.error))
  return result.data
}

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let body: unknown
  try {
    const text = await request.text()
    body = text ? JSON.parse(text) : {}
  } catch {
    throw problems.validation({ _: ['Corpo da requisição não é um JSON válido.'] })
  }
  return validate(schema, body)
}

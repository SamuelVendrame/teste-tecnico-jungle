/**
 * Endpoints de controle da simulação (`/__mock/*`), usados pelo painel de dev e
 * pelo Playwright. Ignoram latência, offline e falhas dos cenários.
 *
 * Os controles do Socket.IO (desconectar, emitir evento cru) ficam em socket.ts.
 */
import { http, HttpResponse, type RequestHandler } from 'msw'
import { z } from 'zod'

import { ethAmount } from '@/api/contracts'

import { advanceClock, dbCounts, getDb, now } from './db'
import { bearerToken, expireSession } from './domain/auth'
import { ApiProblem } from './domain/errors'
import { resolveOrder } from './domain/orders'
import { findNft, updateNft } from './domain/nfts'
import { errorResponse, param, parseBody } from './handlers/http'
import {
  SCENARIO_NAMES,
  SCENARIO_PRESETS,
  clearInjectedFailures,
  getScenario,
  injectFailure,
  listInjectedFailures,
  resetMockDb,
  scenarioRuntimeSnapshot,
  setScenario,
} from './scenarios'

const scenarioInput = z.object({ name: z.enum(SCENARIO_NAMES as [string, ...string[]]) })

const nftUpdateInput = z.object({
  priceEth: ethAmount.optional(),
  editions: z
    .array(
      z.object({
        id: z.string(),
        priceEth: ethAmount.optional(),
        available: z.number().int().min(0).optional(),
      }),
    )
    .optional(),
})

const resolveInput = z.object({ status: z.enum(['confirmed', 'declined']) })
const clockInput = z.object({ ms: z.number().int().min(0) })
const failInput = z.object({
  method: z.string().default('*'),
  path: z.string().startsWith('/api'),
  status: z.number().int().min(0).max(599).default(500),
  code: z.string().default('INTERNAL_ERROR'),
  message: z.string().default('Falha simulada.'),
  count: z.number().int().min(1).max(50).default(1),
})

function state() {
  return {
    scenario: getScenario(),
    scenarios: SCENARIO_NAMES.map((name) => ({
      name,
      label: SCENARIO_PRESETS[name].label,
      description: SCENARIO_PRESETS[name].description,
    })),
    runtime: scenarioRuntimeSnapshot(),
    injectedFailures: listInjectedFailures(),
    counts: dbCounts(),
    clock: { now: now().toISOString(), offsetMs: getDb().meta.clockOffsetMs },
  }
}

/** Mesmo tratamento de erro das rotas /api, sem os efeitos de cenário. */
function control(
  method: 'get' | 'post',
  path: string,
  resolver: (ctx: {
    request: Request
    params: Record<string, unknown>
  }) => Promise<Response> | Response,
): RequestHandler {
  return http[method](`/__mock${path}`, async ({ request, params }) => {
    try {
      return await resolver({ request, params })
    } catch (error) {
      if (error instanceof ApiProblem) return errorResponse(error)
      console.error('[mocks] erro em controle', path, error)
      return errorResponse(new ApiProblem(500, 'INTERNAL_ERROR', 'Falha no endpoint de controle.'))
    }
  })
}

export const controlHandlers: RequestHandler[] = [
  control('get', '/state', () => HttpResponse.json(state())),

  control('post', '/reset', () => {
    resetMockDb()
    return HttpResponse.json({ ok: true, state: state() })
  }),

  control('post', '/scenario', async ({ request }) => {
    const { name } = await parseBody(request, scenarioInput)
    setScenario(name as (typeof SCENARIO_NAMES)[number])
    return HttpResponse.json({ ok: true, state: state() })
  }),

  control('post', '/nfts/:id/update', async ({ request, params }) => {
    const id = param(params as never, 'id')
    const nft = findNft(id)
    if (!nft) throw new ApiProblem(404, 'NOT_FOUND', 'NFT não encontrado.')
    const patch = await parseBody(request, nftUpdateInput)
    return HttpResponse.json({ ok: true, nft: updateNft(nft.id, patch) })
  }),

  control('post', '/orders/:id/resolve', async ({ request, params }) => {
    const id = param(params as never, 'id')
    const { status } = await parseBody(request, resolveInput)
    const before = getDb().orders[id]
    if (!before) throw new ApiProblem(404, 'NOT_FOUND', 'Pedido não encontrado.')
    const wasPending = before.status === 'pending'
    const order = await resolveOrder(id, status)
    return HttpResponse.json({ ok: true, changed: wasPending, order })
  }),

  control('post', '/session/expire', ({ request }) => {
    const token = bearerToken(request)
    const expired = token ? expireSession(token) : false
    return HttpResponse.json({ ok: true, expired })
  }),

  control('post', '/clock/advance', async ({ request }) => {
    const { ms } = await parseBody(request, clockInput)
    advanceClock(ms)
    return HttpResponse.json({ ok: true, clock: state().clock })
  }),

  control('post', '/fail-next', async ({ request }) => {
    const input = await parseBody(request, failInput)
    injectFailure({
      method: input.method,
      path: input.path,
      status: input.status,
      code: input.code,
      message: input.message,
      remaining: input.count,
    })
    return HttpResponse.json({ ok: true, injectedFailures: listInjectedFailures() })
  }),

  control('post', '/fail-next/clear', () => {
    clearInjectedFailures()
    return HttpResponse.json({ ok: true })
  }),
]

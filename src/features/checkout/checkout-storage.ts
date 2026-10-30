/**
 * Estado do checkout que precisa sobreviver a refresh, expiração de sessão e
 * timeout. Tudo com try/catch: storage bloqueado não pode quebrar a compra.
 *
 * - `kurio:checkout-attempt` (sessionStorage): a tentativa de pedido em aberto
 *   (chave de idempotência + payload exato + fingerprint). Ver `use-create-order.ts`.
 * - `kurio:checkout-form` (sessionStorage): dados do colecionador digitados.
 * - `kurio:pending-order` (localStorage): id do último pedido criado neste
 *   navegador que ainda não chegou a estado terminal.
 */
import { z } from 'zod'

import { createOrderInput, type CollectorInfo, type CreateOrderInput } from '@/api/contracts'

const ATTEMPT_KEY = 'kurio:checkout-attempt'
const FORM_KEY = 'kurio:checkout-form'
const PENDING_ORDER_KEY = 'kurio:pending-order'

export interface CheckoutAttempt {
  /** Idempotency-Key enviada em TODAS as tentativas deste mesmo pedido. */
  key: string
  /** Fingerprint da cotação revisada quando a tentativa começou. */
  fingerprint: string
  /** Payload exato: um reenvio manda os mesmos bytes (mesmo hash no servidor). */
  input: CreateOrderInput
  userId: string
  createdAt: string
}

/** Rascunho do formulário: aceita valores ainda inválidos (o usuário estava digitando). */
const draftSchema = z
  .object({ name: z.string(), email: z.string(), document: z.string() })
  .partial()

const attemptSchema = z.object({
  key: z.string(),
  fingerprint: z.string(),
  input: createOrderInput,
  userId: z.string(),
  createdAt: z.string(),
})

function read<T>(storage: () => Storage, key: string, parse: (v: unknown) => T): T | null {
  try {
    const raw = storage().getItem(key)
    return raw ? parse(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function write(storage: () => Storage, key: string, value: unknown) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    // Storage indisponível (modo privado/cota): segue só em memória.
  }
}

const session = () => window.sessionStorage
const local = () => window.localStorage

export const checkoutAttempt = {
  read: (userId: string): CheckoutAttempt | null => {
    const attempt = read(session, ATTEMPT_KEY, (v) => attemptSchema.parse(v))
    return attempt && attempt.userId === userId ? attempt : null
  },
  write: (attempt: CheckoutAttempt) => write(session, ATTEMPT_KEY, attempt),
  clear: () => write(session, ATTEMPT_KEY, null),
}

export const checkoutForm = {
  read: (): Partial<CollectorInfo> | null => read(session, FORM_KEY, (v) => draftSchema.parse(v)),
  write: (values: Partial<CollectorInfo>) => write(session, FORM_KEY, values),
  clear: () => write(session, FORM_KEY, null),
}

export const pendingOrder = {
  read: (): string | null => {
    try {
      return local().getItem(PENDING_ORDER_KEY)
    } catch {
      return null
    }
  },
  write: (orderId: string) => write(local, PENDING_ORDER_KEY, orderId),
  /** Remove só se ainda apontar para este pedido (outro pedido pode ter sido criado depois). */
  clear: (orderId: string) => {
    if (pendingOrder.read() === orderId) write(local, PENDING_ORDER_KEY, null)
  },
}

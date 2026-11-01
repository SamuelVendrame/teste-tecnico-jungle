/**
 * Estado do checkout que precisa sobreviver a refresh, expiração de sessão e
 * timeout. Tudo com try/catch: storage bloqueado não pode quebrar a compra.
 *
 * - `kurio:checkout-attempt` (sessionStorage): a tentativa de pedido em aberto
 *   (chave de idempotência + payload exato + fingerprint). Ver `use-create-order.ts`.
 * - `kurio:checkout-form` (sessionStorage): dados do colecionador digitados.
 * - `kurio:pending-order` (localStorage): id do último pedido criado neste
 *   navegador que ainda não chegou a estado terminal.
 *
 * Os três registros guardam o `userId` do dono e só são lidos pelo mesmo usuário:
 * dados pessoais (nome, e-mail, CPF) nunca aparecem para outra conta no mesmo
 * navegador. `clearPrivateStorage` apaga tudo no logout e, na troca de usuário,
 * o que pertence a outra conta (ver `use-auth.ts`).
 */
import { z } from 'zod'

import {
  createOrderInput,
  ensSuffix,
  type CollectorInfo,
  type CreateOrderInput,
} from '@/api/contracts'

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
const draftSchema = z.object({
  userId: z.string(),
  values: z
    .object({
      displayName: z.string(),
      profileName: z.string(),
      secondaryRef: z.string(),
      referralCode: z.string(),
      email: z.string(),
      ensSuffix,
      ensName: z.string(),
      note: z.string(),
    })
    .partial(),
})

const pendingSchema = z.object({ userId: z.string(), orderId: z.string() })

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
  /** Rascunho de outra conta é ignorado (não apagado: o dono pode voltar nesta aba). */
  read: (userId: string): Partial<CollectorInfo> | null => {
    const draft = read(session, FORM_KEY, (v) => draftSchema.parse(v))
    return draft && draft.userId === userId ? draft.values : null
  },
  write: (userId: string, values: Partial<CollectorInfo>) =>
    write(session, FORM_KEY, { userId, values }),
  clear: () => write(session, FORM_KEY, null),
}

export const pendingOrder = {
  /** Pedido pendente do usuário; o de outra conta é ignorado, nunca apagado por quem não é dono. */
  read: (userId: string): string | null => {
    const entry = read(local, PENDING_ORDER_KEY, (v) => pendingSchema.parse(v))
    return entry && entry.userId === userId ? entry.orderId : null
  },
  write: (userId: string, orderId: string) => write(local, PENDING_ORDER_KEY, { userId, orderId }),
  /** Remove só se ainda apontar para este pedido (outro pedido pode ter sido criado depois). */
  clear: (userId: string, orderId: string) => {
    if (pendingOrder.read(userId) === orderId) write(local, PENDING_ORDER_KEY, null)
  },
}

/**
 * Apaga o estado de checkout persistido. Sem `keepUserId` (logout) apaga tudo;
 * com ele (login de outra conta) mantém apenas o que pertence a esse usuário.
 */
export function clearPrivateStorage(keepUserId?: string) {
  const owner = (storage: () => Storage, key: string): string | null =>
    read(storage, key, (v) => z.object({ userId: z.string() }).parse(v).userId)
  const entries: Array<[() => Storage, string]> = [
    [session, ATTEMPT_KEY],
    [session, FORM_KEY],
    [local, PENDING_ORDER_KEY],
  ]
  for (const [storage, key] of entries) {
    if (keepUserId === undefined || owner(storage, key) !== keepUserId) write(storage, key, null)
  }
}

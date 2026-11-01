/**
 * Criação idempotente do pedido.
 *
 * Ciclo de vida da chave de idempotência (uma por TENTATIVA de checkout):
 * 1. No primeiro "Confirmar pedido" geramos `crypto.randomUUID()` e gravamos em
 *    sessionStorage (`kurio:checkout-attempt`) a chave + o payload exato + o
 *    fingerprint da cotação, ANTES de enviar. Assim um reload, um timeout ou uma
 *    expiração de sessão no meio do envio não perdem a chave.
 * 2. Enquanto a tentativa estiver em aberto, todo reenvio (botão "Tentar novamente",
 *    novo clique em "Confirmar", volta do login) manda a MESMA chave e o MESMO
 *    payload. Se o servidor já criou o pedido (ex.: respondeu depois do nosso
 *    timeout de 8 s), ele devolve o mesmo pedido em vez de criar outro.
 * 3. A chave só é descartada diante de uma resposta definitiva:
 *    - pedido criado/recuperado (2xx);
 *    - QUOTE_STALE: o conteúdo mudou; a próxima confirmação é OUTRO pedido, com
 *      cotação nova e chave nova (reusar a chave com payload diferente daria
 *      IDEMPOTENCY_KEY_REUSED);
 *    - erros de negócio que garantem que nada foi criado (estoque, validação,
 *      cotação inexistente).
 *    Falhas transitórias (timeout, rede, 5xx) e 401 mantêm a tentativa aberta.
 *
 * Cliques repetidos: o botão fica desabilitado durante o envio e, além disso,
 * `inFlight` (ref síncrona) ignora qualquer segunda chamada antes de o React
 * re-renderizar. O servidor ainda serializa requisições com a mesma chave.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { isApiClientError } from '@/api/client'
import {
  quote as quoteSchema,
  type CreateOrderInput,
  type Order,
  type Quote,
} from '@/api/contracts'
import { orderApi } from '@/api/endpoints'
import { announce } from '@/components/common/announce'
import { setWalletConnection } from '@/features/wallets/wallet-connection-store'
import { queryKeys } from '@/lib/query-keys'

import {
  checkoutAttempt,
  checkoutForm,
  pendingOrder,
  type CheckoutAttempt,
} from './checkout-storage'

export type OrderProblem =
  /** Não sabemos se o pedido foi criado: reenviar com a mesma chave. */
  | { kind: 'uncertain'; message: string }
  /** Estoque mudou: voltar ao carrinho. */
  | { kind: 'unavailable'; message: string }
  /** A chave já gerou um pedido com outro conteúdo: mostrar esse pedido. */
  | { kind: 'key-reused'; message: string; orderId: string | null }
  | { kind: 'error'; message: string }

interface Options {
  userId: string
  /** QUOTE_STALE: o servidor devolveu uma cotação nova (já gravada) em `meta.quote`. */
  onStaleQuote: (fresh: Quote) => void
}

const UNCERTAIN_MESSAGE =
  'Não conseguimos confirmar se o pedido foi criado. Tente novamente: reenviaremos o mesmo pedido, sem risco de cobrança duplicada.'

export function useCreateOrder({ userId, onStaleQuote }: Options) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const inFlight = useRef(false)
  const onStaleRef = useRef(onStaleQuote)
  useEffect(() => {
    onStaleRef.current = onStaleQuote
  })

  const [openAttempt, setOpenAttempt] = useState<CheckoutAttempt | null>(() =>
    checkoutAttempt.read(userId),
  )
  // Tentativa em aberto ao montar = a página caiu (reload/sessão) antes da resposta.
  const [problem, setProblem] = useState<OrderProblem | null>(() =>
    openAttempt ? { kind: 'uncertain', message: UNCERTAIN_MESSAGE } : null,
  )

  function closeAttempt() {
    checkoutAttempt.clear()
    setOpenAttempt(null)
  }

  const mutation = useMutation({
    mutationKey: ['orders', userId, 'create'],
    mutationFn: (attempt: CheckoutAttempt) => orderApi.create(attempt.input, attempt.key),
    onSuccess: (order: Order) => {
      closeAttempt()
      checkoutForm.clear()
      pendingOrder.write(userId, order.id)
      queryClient.setQueryData(queryKeys.orders.detail(userId, order.id), order)
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.list(userId) })
      // A cotação é de uso único: a que estava em cache não vale mais.
      queryClient.removeQueries({ queryKey: ['quote'] })
      announce('Pedido enviado. Aguardando confirmação da rede.')
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    },
    onError: (error, variables) => {
      if (!isApiClientError(error)) {
        setProblem({ kind: 'uncertain', message: UNCERTAIN_MESSAGE })
        return
      }
      switch (error.code) {
        case 'QUOTE_STALE': {
          closeAttempt()
          const parsed = quoteSchema.safeParse(error.meta?.quote)
          if (parsed.success) onStaleRef.current(parsed.data)
          else void queryClient.invalidateQueries({ queryKey: ['quote'] })
          announce('A cotação mudou. Revise os valores antes de confirmar.')
          return
        }
        case 'OUT_OF_STOCK':
        case 'EDITION_UNAVAILABLE':
          closeAttempt()
          void queryClient.invalidateQueries({ queryKey: ['quote'] })
          void queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) })
          setProblem({
            kind: 'unavailable',
            message: 'Alguns itens não têm mais disponibilidade suficiente. Ajuste o carrinho.',
          })
          return
        case 'IDEMPOTENCY_KEY_REUSED': {
          closeAttempt()
          const orderId = typeof error.meta?.orderId === 'string' ? error.meta.orderId : null
          setProblem({
            kind: 'key-reused',
            message: 'Esta tentativa já gerou um pedido. Acompanhe o pedido existente.',
            orderId,
          })
          return
        }
        case 'UNAUTHORIZED':
          // A camada de sessão leva ao login com returnTo=/checkout; a tentativa
          // continua aberta e é reenviada com a mesma chave na volta.
          return
        case 'NOT_FOUND':
          closeAttempt()
          void queryClient.invalidateQueries({ queryKey: ['quote'] })
          setProblem({
            kind: 'error',
            message: 'A cotação expirou. Revise os valores atualizados e confirme novamente.',
          })
          return
        case 'WALLET_NOT_CONNECTED':
          // O servidor não tem a conexão desta carteira (ex.: outra aba desconectou).
          closeAttempt()
          setWalletConnection(variables.input.walletId, 'disconnected')
          setProblem({
            kind: 'error',
            message: 'A carteira não está conectada. Conecte-a e confirme novamente.',
          })
          return
        default:
          if (error.isTransient || error.status === 0) {
            setProblem({ kind: 'uncertain', message: UNCERTAIN_MESSAGE })
            return
          }
          closeAttempt()
          setProblem({
            kind: 'error',
            message: error.details?.walletId?.[0] ?? error.message,
          })
      }
    },
    onSettled: () => {
      inFlight.current = false
    },
  })

  function send(attempt: CheckoutAttempt) {
    if (inFlight.current) return
    inFlight.current = true
    setProblem(null)
    mutation.mutate(attempt)
  }

  /** Confirma o pedido. Com tentativa em aberto, reenvia a mesma (mesma chave e payload). */
  function submit(input: CreateOrderInput) {
    if (inFlight.current) return
    const open = checkoutAttempt.read(userId)
    if (open) {
      send(open)
      return
    }
    const attempt: CheckoutAttempt = {
      key: crypto.randomUUID(),
      fingerprint: input.quoteFingerprint,
      input,
      userId,
      createdAt: new Date().toISOString(),
    }
    checkoutAttempt.write(attempt)
    setOpenAttempt(attempt)
    send(attempt)
  }

  /** "Tentar novamente" após timeout/queda: mesma chave, mesmo payload. */
  function retry() {
    const open = checkoutAttempt.read(userId) ?? openAttempt
    if (open) send(open)
  }

  return {
    submit,
    retry,
    pending: mutation.isPending,
    problem,
    dismissProblem: () => setProblem(null),
    /** Há um pedido enviado cujo resultado ainda não sabemos. */
    hasOpenAttempt: openAttempt !== null,
  }
}

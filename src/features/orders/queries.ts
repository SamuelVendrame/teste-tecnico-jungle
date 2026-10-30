/**
 * Pedido: leitura, polling de segurança e "assentamento" do pedido pendente.
 *
 * Fontes de atualização de um pedido pendente, em ordem:
 * 1. `order.updated` via Socket.IO (src/realtime/apply-events.ts) grava o novo
 *    status direto no cache `orders.detail(userId, id)`;
 * 2. rede de segurança: `refetchInterval` de 3 s enquanto `status === 'pending'`
 *    (cobre evento perdido, socket reconectando e reload da página). Para sozinho
 *    quando o pedido fica terminal (confirmado/recusado).
 */
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { isApiClientError } from '@/api/client'
import type { Order } from '@/api/contracts'
import { orderApi } from '@/api/endpoints'
import { pendingOrder } from '@/features/checkout/checkout-storage'
import { useSession } from '@/features/session/session-store'
import { queryKeys } from '@/lib/query-keys'

export const ORDER_POLL_MS = 3_000

export function orderDetailOptions(userId: string, orderId: string) {
  return queryOptions({
    queryKey: queryKeys.orders.detail(userId, orderId),
    queryFn: ({ signal }) => orderApi.get(orderId, { signal }),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? ORDER_POLL_MS : false),
    // Pedido de outra conta / inexistente não muda com novas tentativas.
    retry: (count, error) => !(isApiClientError(error) && error.status < 500) && count < 2,
  })
}

export function isTerminal(order: Pick<Order, 'status'>): boolean {
  return order.status === 'confirmed' || order.status === 'declined'
}

const settling = new Set<string>()

/**
 * Efeitos de fim de pedido no cliente, aplicados uma única vez por navegador.
 *
 * O SERVIDOR é quem tira do carrinho os itens/quantidades comprados quando o
 * pedido é confirmado (recusa preserva o carrinho), independentemente da página
 * aberta. Aqui só sincronizamos o cache: o carrinho é revalidado (cobre o
 * caminho do polling de 3 s, quando o `order.updated` não chegou pelo socket),
 * a cotação aberta deixa de valer e `kurio:pending-order` é apagado.
 */
export function settleOrder(queryClient: QueryClient, userId: string, order: Order) {
  if (!isTerminal(order) || pendingOrder.read(userId) !== order.id || settling.has(order.id)) return
  settling.add(order.id)
  pendingOrder.clear(userId, order.id)
  if (order.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) })
  }
  void queryClient.invalidateQueries({ queryKey: ['quote'] })
  settling.delete(order.id)
}

/** Aplica `settleOrder` quando o pedido observado chega a um estado terminal. */
export function useSettleOrder(order: Order | undefined) {
  const queryClient = useQueryClient()
  const userId = useSession().user?.id
  useEffect(() => {
    if (order && userId && isTerminal(order)) settleOrder(queryClient, userId, order)
  }, [order, userId, queryClient])
}

/**
 * Pedido pendente criado neste navegador (`kurio:pending-order`), para o banner
 * do checkout. Também assenta o pedido se ele terminou sem que a página do
 * pedido estivesse aberta. Só lê o registro do próprio usuário (o de outra conta
 * no mesmo navegador é ignorado); um pedido apagado (404) é esquecido.
 */
export function usePendingOrder() {
  const session = useSession()
  const userId = session.status === 'authenticated' ? (session.user?.id ?? null) : null
  const [orderId, setOrderId] = useState(() => (userId ? pendingOrder.read(userId) : null))
  const query = useQuery({
    ...orderDetailOptions(userId ?? 'anonymous', orderId ?? 'none'),
    enabled: userId !== null && orderId !== null,
  })
  useSettleOrder(query.data)

  const forbidden =
    isApiClientError(query.error) && (query.error.status === 403 || query.error.status === 404)
  useEffect(() => {
    if (forbidden && orderId && userId) {
      pendingOrder.clear(userId, orderId)
      setOrderId(null)
    }
  }, [forbidden, orderId, userId])

  const order = query.data
  return order && order.status === 'pending' ? order : null
}

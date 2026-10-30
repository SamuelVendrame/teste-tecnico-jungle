import { createFileRoute } from '@tanstack/react-router'

import { OrderPage, OrderSkeleton } from '@/features/orders/OrderPage'
import { orderDetailOptions } from '@/features/orders/queries'
import { requireAuth } from '@/features/session/require-auth'
import { sessionStore } from '@/features/session/session-store'

export const Route = createFileRoute('/orders/$orderId')({
  beforeLoad: ({ location }) => requireAuth(location),
  // prefetchQuery nunca lança: 403/404 viram estado de erro dentro da página.
  loader: async ({ context: { queryClient }, params: { orderId } }) => {
    const userId = sessionStore.getState().user?.id
    if (userId) await queryClient.prefetchQuery(orderDetailOptions(userId, orderId))
  },
  pendingComponent: OrderSkeleton,
  pendingMs: 200,
  component: function OrderRoute() {
    const { orderId } = Route.useParams()
    return <OrderPage orderId={orderId} />
  },
})

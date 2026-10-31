import { createFileRoute, redirect } from '@tanstack/react-router'

import { cartApi } from '@/api/endpoints'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { checkoutAttempt } from '@/features/checkout/checkout-storage'
import { requireAuth } from '@/features/session/require-auth'
import { sessionStore } from '@/features/session/session-store'
import { queryKeys } from '@/lib/query-keys'

/**
 * Rota privada. `requireAuth` recebe o `location` inteiro: o `href` (caminho +
 * busca) vira o `returnTo` do login, então quem perde a sessão no meio do
 * checkout volta exatamente para cá (com o rascunho do formulário preservado).
 */
export const Route = createFileRoute('/checkout')({
  beforeLoad: ({ location }) => requireAuth(location),
  loader: async ({ context: { queryClient } }) => {
    const userId = sessionStore.getState().user?.id
    if (!userId) return
    const cart = await queryClient
      .ensureQueryData({
        queryKey: queryKeys.cart(userId),
        queryFn: ({ signal }) => cartApi.get({ signal }),
      })
      // Falha ao ler o carrinho: a página mostra o erro com 'Tentar novamente'.
      .catch(() => null)
    // Carrinho vazio com tentativa em aberto: o servidor pode ter confirmado o pedido
    // (e consumido o carrinho) sem a resposta chegar. A página oferece recuperá-lo
    // pela mesma chave em vez de cair no carrinho vazio.
    if (cart && cart.items.length === 0 && !checkoutAttempt.read(userId)) {
      throw redirect({ to: '/cart', replace: true })
    }
  },
  component: CheckoutPage,
})

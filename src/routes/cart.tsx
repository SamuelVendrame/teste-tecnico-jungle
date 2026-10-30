import { createFileRoute } from '@tanstack/react-router'

import { CartPage } from '@/features/cart/CartPage'

/** Rota pública: visitantes também têm carrinho (identificado por X-Cart-Id). */
export const Route = createFileRoute('/cart')({
  component: CartPage,
})

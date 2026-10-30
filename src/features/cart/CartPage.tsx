import { Link, useNavigate } from '@tanstack/react-router'
import { ShoppingCartIcon } from 'lucide-react'
import { toast } from 'sonner'

import type { CartItem } from '@/api/contracts'
import { announce } from '@/components/common/announce'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import { sessionStore, useSession } from '@/features/session/session-store'
import { cn } from '@/lib/utils'

import { CART_GRID } from './components/cart-grid'
import { CartItemRow } from './components/CartItemRow'
import { CartSummary } from './components/CartSummary'
import { PriceUpdateBanner } from './components/PriceUpdateBanner'
import { QuoteIssues, type IssueAction } from './components/QuoteIssues'
import { PurchaseBreadcrumb, ScreenHeader } from './components/ScreenHeader'
import {
  couponErrorMessage,
  useAddToCart,
  useCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from './use-cart'
import { usePriceNotices } from './use-price-notices'
import { cartNetwork, isCouponError, useQuote } from './use-quote'

export function CartPage() {
  const session = useSession()
  const navigate = useNavigate()
  const cartQuery = useCart()
  const cart = cartQuery.data
  const quote = useQuote(cart, cartNetwork(cart))
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()
  const addToCart = useAddToCart()
  const { notices, clear } = usePriceNotices(() => {
    if (quote.input) void quote.refetch()
  })

  const header = (
    <>
      <ScreenHeader title="Carrinho de NFTs" fallbackTo="/" />
      <PurchaseBreadcrumb current="Carrinho" />
      <h1 className="sr-only hidden md:block">Carrinho de NFTs</h1>
    </>
  )

  if (cartQuery.isPending) {
    return (
      <Container className="pt-8 pb-16">
        {header}
        <CartSkeleton />
      </Container>
    )
  }

  if (cartQuery.isError || !cart) {
    return (
      <Container className="pt-8 pb-16">
        {header}
        <ErrorState
          className="mt-6"
          title="Não foi possível carregar o carrinho"
          onRetry={() => void cartQuery.refetch()}
          retrying={cartQuery.isFetching}
        />
      </Container>
    )
  }

  if (cart.items.length === 0) {
    return (
      <Container className="pt-8 pb-16">
        {header}
        <EmptyState
          className="mt-6"
          headingLevel="h2"
          icon={<ShoppingCartIcon />}
          title="Seu carrinho está vazio"
          description="Explore o mercado e adicione NFTs para vê-los aqui."
          action={
            <Button asChild className="rounded-[4px] font-bold">
              <Link to="/">Explorar NFTs</Link>
            </Button>
          }
        />
      </Container>
    )
  }

  const quoteData = quote.data
  const priceByLine = new Map(
    quoteData?.lines.map((l) => [`${l.nftId}:${l.editionId}`, l.unitPriceEth]) ?? [],
  )
  const blocking = quoteData?.issues.some((i) => i.type !== 'price-changed') ?? false
  const couponQuoteError =
    quote.isError && isCouponError(quote.error) && cart.couponCode
      ? `${couponErrorMessage(quote.error)}: remova o cupom ${cart.couponCode} para continuar.`
      : null

  const checkoutDisabledReason = blocking
    ? 'Ajuste os itens indicados acima para continuar.'
    : couponQuoteError
      ? 'Remova o cupom inválido para continuar.'
      : null

  function label(item: CartItem) {
    return `${item.nft.name} (${item.edition.name})`
  }

  function changeQuantity(item: CartItem, quantity: number) {
    updateItem.mutate(
      { itemId: item.id, quantity },
      { onSuccess: () => announce(`Quantidade de ${label(item)} alterada para ${quantity}.`) },
    )
  }

  function remove(item: CartItem) {
    removeItem.mutate(item.id, {
      onSuccess: () => {
        announce(`${label(item)} removido do carrinho.`)
        toast(`${item.nft.name} removido do carrinho`, {
          action: {
            label: 'Desfazer',
            onClick: () =>
              addToCart.mutate(
                { nftId: item.nftId, editionId: item.editionId, quantity: item.quantity },
                { onSuccess: () => announce(`${label(item)} voltou ao carrinho.`) },
              ),
          },
        })
      },
    })
  }

  function onIssueAction(action: IssueAction) {
    if (action.kind === 'remove') remove(action.item)
    // PATCH com a mesma quantidade grava o preço atual como novo snapshot do item.
    else if (action.kind === 'accept-price') changeQuantity(action.item, action.item.quantity)
    else changeQuantity(action.item, action.quantity)
  }

  function goToCheckout() {
    if (session.status !== 'authenticated') {
      sessionStore.setReturnTo('/checkout')
      void navigate({ to: '/login', search: { returnTo: '/checkout' } })
      return
    }
    void navigate({ to: '/checkout' })
  }

  return (
    <Container className="pt-8 pb-10 md:pb-16">
      {header}

      <div className="mt-3 flex flex-col gap-3 empty:hidden">
        <PriceUpdateBanner notices={notices} onDismiss={clear} />
        {quoteData && (
          <QuoteIssues
            issues={quoteData.issues}
            cart={cart}
            onAction={onIssueAction}
            busy={updateItem.isPending || removeItem.isPending}
          />
        )}
      </div>

      <div className="mt-4 flex flex-col gap-6 md:mt-3 lg:grid lg:grid-cols-[minmax(0,782px)_332px] lg:items-start lg:justify-between lg:gap-10">
        <section aria-labelledby="cart-items-title">
          <h2 id="cart-items-title" className="sr-only">
            Itens do carrinho
          </h2>
          <div
            aria-hidden
            className={cn(
              'hidden border-b border-border-soft pb-3 text-base font-bold text-text-primary md:grid md:pr-6',
              CART_GRID,
            )}
          >
            <span>NFTs</span>
            <span>Preço</span>
            <span>Edições</span>
            <span>Total</span>
            <span />
          </div>
          <ul className="flex flex-col gap-5 md:mt-3 md:gap-3">
            {cart.items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                unitPriceEth={
                  priceByLine.get(`${item.nftId}:${item.editionId}`) ?? item.edition.priceEth
                }
                onQuantityChange={(q) => changeQuantity(item, q)}
                onRemove={() => remove(item)}
                removing={removeItem.isPending && removeItem.variables === item.id}
              />
            ))}
          </ul>
        </section>

        <CartSummary
          className="max-md:[@media(min-height:700px)]:sticky max-md:[@media(min-height:700px)]:bottom-[126px] md:ml-auto md:w-full md:max-w-[420px] lg:max-w-none"
          quote={quoteData}
          refreshing={quote.isPlaceholderData || (quote.isFetching && !quote.isPending)}
          couponCode={cart.couponCode}
          couponQuoteError={couponQuoteError}
          quoteFailed={quote.isError && !couponQuoteError}
          onRetryQuote={() => void quote.refetch()}
          checkoutDisabledReason={checkoutDisabledReason}
          onCheckout={goToCheckout}
        />
      </div>
    </Container>
  )
}

/** Skeleton do carrinho com as dimensões das linhas e do resumo (sem layout shift). */
export function CartSkeleton() {
  return (
    <div role="status" aria-label="Carregando carrinho" className="mt-4 md:mt-3">
      <span className="sr-only">Carregando carrinho…</span>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,782px)_332px] lg:justify-between lg:gap-10">
        <div>
          <div className="hidden h-[29px] border-b border-border-soft md:block" />
          <div className="flex flex-col gap-5 md:mt-3 md:gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="skeleton h-[100px] rounded-[10px] md:h-[70px] md:rounded-[4px]"
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="skeleton hidden h-6 w-48 md:block" />
          <div className="skeleton h-[50px] rounded-full md:h-10 md:rounded-[2px]" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
          <div className="skeleton h-[60px] rounded-full md:h-10 md:rounded-[2px]" />
        </div>
      </div>
    </div>
  )
}

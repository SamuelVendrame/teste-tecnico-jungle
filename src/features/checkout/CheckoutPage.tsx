/**
 * Checkout em uma página (como no Figma): dados do colecionador, carteira e
 * rede, revisão da cotação e confirmação.
 *
 * Cotação desatualizada nunca é confirmada:
 * - "cotação revisada" (`reviewed`) é a que o usuário está vendo e aceitou. Se a
 *   cotação viva muda de fingerprint SEM o usuário ter mudado a entrada (preço ou
 *   estoque mudou no servidor via `nft.updated`, ou o servidor respondeu
 *   QUOTE_STALE com `meta.quote`), o botão de confirmar trava e abre o diálogo
 *   "A cotação mudou". Só "Revisar e confirmar" aceita a nova cotação.
 * - Mudanças feitas pelo próprio usuário (rede, carteira) trocam a entrada da
 *   cotação e são aceitas direto: os valores novos já estão na tela.
 * - Enquanto a cotação recalcula (isFetching) o botão também fica travado.
 * - O servidor revalida o fingerprint em POST /orders (última barreira).
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ClockIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  ShoppingCartIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import {
  collectorInfo,
  type CollectorInfo,
  type NetworkId,
  type Quote,
  type Wallet,
} from '@/api/contracts'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { EthAmount } from '@/components/common/EthAmount'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import { PriceUpdateBanner } from '@/features/cart/components/PriceUpdateBanner'
import { PurchaseBreadcrumb, ScreenHeader } from '@/features/cart/components/ScreenHeader'
import { useCart, useCartOwnerId } from '@/features/cart/use-cart'
import { usePriceNotices } from '@/features/cart/use-price-notices'
import { useQuote } from '@/features/cart/use-quote'
import { usePendingOrder } from '@/features/orders/queries'
import { useSession } from '@/features/session/session-store'
import { useWalletConnection } from '@/features/wallets/wallet-connection-store'
import { useWallets } from '@/features/wallets/use-wallets'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

import { checkoutForm } from './checkout-storage'
import { CollectorFields } from './components/CollectorFields'
import { QuoteChangedDialog } from './components/QuoteChangedDialog'
import { ReviewSection } from './components/ReviewSection'
import { WalletSection } from './components/WalletSection'
import { hasBlockingIssues } from './quote-diff'
import { useCreateOrder, type OrderProblem } from './use-create-order'
import { useQuoteCountdown } from './use-quote-countdown'

function defaultWallet(wallets: Wallet[] | undefined): Wallet | undefined {
  return wallets?.find((w) => w.kind === 'primary') ?? wallets?.[0]
}

export function CheckoutPage() {
  const session = useSession()
  const user = session.user
  const userId = user?.id ?? 'anonymous'
  const ownerId = useCartOwnerId()
  const queryClient = useQueryClient()

  const cartQuery = useCart()
  const cart = cartQuery.data
  const walletsQuery = useWallets()
  const wallets = walletsQuery.data

  const [walletId, setWalletId] = useState<string | null>(null)
  const [networkChoice, setNetworkChoice] = useState<NetworkId | null>(null)
  const selectedWallet = wallets?.find((w) => w.id === walletId) ?? defaultWallet(wallets)
  const network = networkChoice ?? selectedWallet?.network ?? null
  const connection = useWalletConnection(selectedWallet?.id)

  // Passo 1: formulário (rascunho sobrevive a refresh e à expiração da sessão).
  const form = useForm<CollectorInfo>({
    resolver: zodResolver(collectorInfo),
    mode: 'onTouched',
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      document: '',
      ...checkoutForm.read(userId),
    },
  })
  useEffect(() => {
    const sub = form.watch((values) => checkoutForm.write(userId, values))
    return () => sub.unsubscribe()
  }, [form, userId])

  // Passo 3: cotação na rede escolhida.
  const quote = useQuote(cart, network)
  const live: Quote | undefined = quote.isPlaceholderData ? undefined : quote.data
  const [reviewed, setReviewed] = useState<{ inputKey: string; quote: Quote } | null>(null)

  // Aceite automático (ajuste de estado durante o render, sem efeito):
  // primeira cotação, entrada alterada pelo usuário ou renovação sem mudança de valores.
  if (
    live &&
    (!reviewed ||
      reviewed.inputKey !== quote.fingerprintInput ||
      (reviewed.quote.fingerprint === live.fingerprint && reviewed.quote.id !== live.id))
  ) {
    setReviewed({ inputKey: quote.fingerprintInput, quote: live })
  }
  const quoteChanged =
    !!live &&
    !!reviewed &&
    reviewed.inputKey === quote.fingerprintInput &&
    reviewed.quote.fingerprint !== live.fingerprint

  const createOrder = useCreateOrder({
    userId,
    onStaleQuote: (fresh) => {
      queryClient.setQueryData(queryKeys.quote(ownerId, quote.fingerprintInput), fresh)
      if (reviewed && reviewed.quote.fingerprint === fresh.fingerprint) {
        toast.info('A cotação expirou e foi renovada sem mudança de valores. Confirme novamente.')
      }
    },
  })

  const { notices, clear } = usePriceNotices(() => {
    if (quote.input) void quote.refetch()
  })
  const secondsLeft = useQuoteCountdown(live?.expiresAt, () => {
    if (quote.input) void quote.refetch()
  })
  const pending = usePendingOrder()

  const showChangedDialog = quoteChanged && !createOrder.pending && !createOrder.hasOpenAttempt

  const header = (
    <>
      <ScreenHeader title="Pagamento com carteira" fallbackTo="/cart" />
      <PurchaseBreadcrumb current="Pagamento" />
      <h1 className="sr-only hidden md:block">Pagamento</h1>
    </>
  )

  if (cartQuery.isPending) {
    return (
      <Container className="pt-8 pb-16">
        {header}
        <div
          role="status"
          aria-label="Carregando checkout"
          className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,763px)_405px] lg:justify-between"
        >
          <div className="skeleton h-[320px]" />
          <div className="skeleton h-[520px]" />
        </div>
      </Container>
    )
  }
  if (cartQuery.isError || !cart) {
    return (
      <Container className="pt-8 pb-16">
        {header}
        <ErrorState
          className="mt-6"
          title="Não foi possível carregar o checkout"
          onRetry={() => void cartQuery.refetch()}
          retrying={cartQuery.isFetching}
        />
      </Container>
    )
  }
  if (cart.items.length === 0) {
    // O servidor pode ter confirmado um pedido cuja resposta não chegou (timeout) e
    // já consumido o carrinho: a tentativa em aberto segue recuperável pela mesma chave.
    if (createOrder.pending || (createOrder.hasOpenAttempt && createOrder.problem)) {
      return (
        <Container className="pt-8 pb-16">
          {header}
          <div className="mt-6 max-w-[763px]">
            {createOrder.problem ? (
              <ProblemAlert
                problem={createOrder.problem}
                retrying={createOrder.pending}
                onRetry={createOrder.retry}
                onDismiss={createOrder.dismissProblem}
              />
            ) : (
              <p role="status" className="flex items-center gap-2 text-sm text-text-primary">
                <LoaderCircleIcon aria-hidden className="size-4 motion-safe:animate-spin" />
                Confirmando pedido…
              </p>
            )}
          </div>
        </Container>
      )
    }
    return (
      <Container className="pt-8 pb-16">
        {header}
        <EmptyState
          className="mt-6"
          headingLevel="h2"
          icon={<ShoppingCartIcon />}
          title="Seu carrinho está vazio"
          description="Adicione NFTs ao carrinho para finalizar uma compra."
          action={
            <Button asChild className="rounded-[4px] font-bold">
              <Link to="/cart">Ir para o carrinho</Link>
            </Button>
          }
        />
      </Container>
    )
  }

  const blocking = live ? hasBlockingIssues(live) : false
  const disabledReason = !selectedWallet
    ? 'Selecione uma carteira cadastrada.'
    : !live || quote.isFetching || secondsLeft === 0
      ? 'Atualizando a cotação…'
      : quoteChanged
        ? 'A cotação mudou: revise os valores.'
        : blocking
          ? 'Ajuste os itens indisponíveis no carrinho.'
          : connection !== 'connected'
            ? 'Conecte a carteira para confirmar.'
            : null
  // Uma tentativa em aberto é reenviada como está (mesma chave e payload).
  const canSubmit = createOrder.hasOpenAttempt || disabledReason === null

  const onConfirm = form.handleSubmit((collector) => {
    if (createOrder.hasOpenAttempt) {
      createOrder.retry()
      return
    }
    if (!live || !selectedWallet || !network || disabledReason) return
    createOrder.submit({
      quoteId: live.id,
      quoteFingerprint: live.fingerprint,
      walletId: selectedWallet.id,
      network,
      collector,
    })
  })

  const reasonId = 'checkout-confirm-reason'
  const totalForBar = live?.totalEth ?? reviewed?.quote.totalEth

  return (
    <Container className="pt-8 pb-10 md:pb-16">
      {header}

      <div className="mt-3 flex flex-col gap-3 empty:hidden">
        {pending && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-brand/60 bg-surface-dark px-4 py-3 text-sm"
          >
            <ClockIcon aria-hidden className="size-4 text-text-accent" />
            <span className="font-bold text-text-primary">Você tem um pedido pendente.</span>
            <Link
              to="/orders/$orderId"
              params={{ orderId: pending.id }}
              className="text-text-accent underline-offset-4 hover:underline"
            >
              Acompanhar pedido
            </Link>
          </div>
        )}
        <PriceUpdateBanner notices={notices} onDismiss={clear} />
      </div>

      <form
        noValidate
        onSubmit={(e) => void onConfirm(e)}
        className="mt-5 flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,763px)_405px] lg:items-start lg:justify-between lg:gap-10"
      >
        {/*
          Desktop: coluna esquerda = colecionador + carteira/rede; direita = revisão e confirmação.
          Mobile (Figma compacto): as colunas viram `contents` e a ordem é carteira, dados,
          revisão/totais e o botão fixo no rodapé.
        */}
        <div className="contents lg:flex lg:flex-col lg:gap-10">
          <CollectorFields
            className="order-2 lg:order-none"
            form={form}
            network={network}
            onNetworkChange={setNetworkChoice}
            networkDisabled={createOrder.pending}
            username={user?.username}
          />

          <WalletSection
            className="order-1 lg:order-none"
            wallets={wallets}
            loading={walletsQuery.isPending}
            failed={walletsQuery.isError}
            onRetry={() => void walletsQuery.refetch()}
            selectedId={selectedWallet?.id ?? null}
            onSelect={(id) => {
              setWalletId(id)
              // A rede acompanha a carteira escolhida (pode ser trocada depois).
              setNetworkChoice(wallets?.find((w) => w.id === id)?.network ?? null)
            }}
            disabled={createOrder.pending}
          />
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <ReviewSection
            className="order-3 lg:order-none"
            cart={cart}
            quote={quote.data}
            refreshing={quote.isPlaceholderData || (quote.isFetching && !quote.isPending)}
            failed={quote.isError}
            onRetry={() => void quote.refetch()}
            secondsLeft={live ? secondsLeft : null}
          />

          {createOrder.problem && (
            <ProblemAlert
              className="order-4 lg:order-none"
              problem={createOrder.problem}
              retrying={createOrder.pending}
              onRetry={createOrder.retry}
              onDismiss={createOrder.dismissProblem}
            />
          )}

          <div className="sticky bottom-0 z-10 order-5 -mx-4 -mb-10 flex flex-col gap-3 bg-linear-to-t from-background from-80% to-transparent px-4 pt-6 pb-6 sm:-mx-6 sm:px-6 md:static md:mx-0 md:mb-0 md:bg-none md:p-0 lg:order-none">
            {totalForBar && (
              <p className="flex items-baseline justify-end gap-6 text-lg font-bold md:hidden">
                <span>Total:</span>
                <EthAmount value={totalForBar} className="text-xl text-text-accent" />
              </p>
            )}
            <Button
              type="submit"
              disabled={createOrder.pending || !canSubmit}
              aria-busy={createOrder.pending}
              aria-describedby={
                disabledReason && !createOrder.hasOpenAttempt ? reasonId : undefined
              }
              className="h-[60px] w-full rounded-full bg-linear-to-r from-brand to-[#a8703f] text-[15px] font-bold text-ink hover:opacity-95 md:h-[45px] md:rounded-[2px] md:bg-none md:bg-brand"
            >
              {createOrder.pending && (
                <LoaderCircleIcon aria-hidden className="motion-safe:animate-spin" />
              )}
              {createOrder.pending
                ? 'Confirmando pedido…'
                : createOrder.hasOpenAttempt
                  ? 'Tentar novamente'
                  : 'Confirmar compra'}
            </Button>
            {disabledReason && !createOrder.hasOpenAttempt && !createOrder.pending && (
              <p id={reasonId} className="text-center text-xs text-text-secondary">
                {disabledReason}
              </p>
            )}
          </div>
        </div>
      </form>

      <QuoteChangedDialog
        previous={showChangedDialog ? (reviewed?.quote ?? null) : null}
        next={showChangedDialog ? (live ?? null) : null}
        blocking={blocking}
        onAccept={() => {
          if (live) setReviewed({ inputKey: quote.fingerprintInput, quote: live })
        }}
      />
    </Container>
  )
}

function ProblemAlert({
  problem,
  retrying,
  onRetry,
  onDismiss,
  className,
}: {
  problem: OrderProblem
  retrying: boolean
  onRetry: () => void
  onDismiss: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm',
        className,
        problem.kind === 'uncertain'
          ? 'border-brand/60 bg-surface-dark'
          : 'border-destructive/60 bg-destructive/10',
      )}
    >
      <p className="flex items-start gap-2 text-text-primary">
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-text-accent" />
        {problem.message}
      </p>
      <div className="flex flex-wrap gap-3">
        {problem.kind === 'uncertain' && (
          <Button
            type="button"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
            aria-busy={retrying}
            className="rounded-[4px] font-bold"
          >
            <RotateCwIcon aria-hidden className={cn(retrying && 'motion-safe:animate-spin')} />
            Tentar novamente
          </Button>
        )}
        {problem.kind === 'unavailable' && (
          <Button asChild size="sm" className="rounded-[4px] font-bold">
            <Link to="/cart">Voltar ao carrinho</Link>
          </Button>
        )}
        {problem.kind === 'key-reused' && problem.orderId && (
          <Button asChild size="sm" className="rounded-[4px] font-bold">
            <Link to="/orders/$orderId" params={{ orderId: problem.orderId }}>
              Ver pedido
            </Link>
          </Button>
        )}
        {problem.kind !== 'uncertain' && (
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Fechar
          </Button>
        )}
      </div>
    </div>
  )
}

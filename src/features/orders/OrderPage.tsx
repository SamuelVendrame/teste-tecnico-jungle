import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleXIcon, ExternalLinkIcon, HourglassIcon, WifiOffIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { isApiClientError } from '@/api/client'
import { NETWORK_LABELS, type Order } from '@/api/contracts'
import { announce } from '@/components/common/announce'
import { ErrorState } from '@/components/common/ErrorState'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/session/session-store'
import { PROVIDER_LABELS } from '@/features/wallets/wallet-meta'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { dismissNotice, useRealtimeNotices, useRealtimeStatus } from '@/realtime/use-realtime'

import {
  ThankYouEnvelope,
  OrderLines,
  OrderMeta,
  OrderTotals,
  TxHash,
} from './components/OrderParts'
import { EXPLORER_LABELS, formatOrderDate } from './format'
import { orderDetailOptions, useSettleOrder } from './queries'

const STATUS_ANNOUNCEMENT: Record<Order['status'], string> = {
  pending: 'Pedido pendente. Aguardando confirmação da rede.',
  confirmed: 'Pedido confirmado. Seus NFTs agora estão na sua carteira.',
  declined: 'Pagamento recusado.',
}

export function OrderPage({ orderId }: { orderId: string }) {
  const userId = useSession().user?.id ?? 'anonymous'
  const query = useQuery(orderDetailOptions(userId, orderId))
  const order = query.data
  useSettleOrder(order)
  useOrderAnnouncements(order)

  if (query.isPending) return <OrderSkeleton />

  if (query.isError || !order) {
    const status = isApiClientError(query.error) ? query.error.status : 0
    return (
      <Container className="py-10">
        <ErrorState
          title={
            status === 403
              ? 'Este pedido pertence a outra conta'
              : status === 404
                ? 'Pedido não encontrado'
                : 'Não foi possível carregar o pedido'
          }
          description={
            status === 403 || status === 404
              ? 'Confira o link ou acompanhe seus pedidos pelo perfil.'
              : undefined
          }
          onRetry={status === 403 || status === 404 ? undefined : () => void query.refetch()}
          retrying={query.isFetching}
        />
        <p className="mt-6 text-center">
          <Link to="/" className="text-text-accent underline-offset-4 hover:underline">
            Continuar explorando
          </Link>
        </p>
      </Container>
    )
  }

  return (
    <div className="md:bg-black/40 md:py-16">
      <Container className="py-6 md:py-0">
        {order.status === 'confirmed' ? (
          <ConfirmedCard order={order} />
        ) : order.status === 'declined' ? (
          <DeclinedCard order={order} />
        ) : (
          <PendingCard order={order} />
        )}
      </Container>
    </div>
  )
}

/** Anuncia mudanças de status e consome os avisos de tempo real deste pedido. */
function useOrderAnnouncements(order: Order | undefined) {
  const notices = useRealtimeNotices()
  const previous = useRef<Order['status'] | null>(null)

  useEffect(() => {
    if (!order) return
    if (previous.current !== null && previous.current !== order.status) {
      announce(STATUS_ANNOUNCEMENT[order.status])
    }
    previous.current = order.status
  }, [order])

  useEffect(() => {
    if (!order) return
    // O status já está na tela; o aviso global deste pedido não precisa virar toast.
    notices
      .filter((n) => n.kind === 'order' && n.orderId === order.id)
      .forEach((n) => dismissNotice(n.id))
  }, [notices, order])
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article
      aria-labelledby="order-status-title"
      className={cn(
        'relative mx-auto w-full max-w-[578px] overflow-hidden rounded-[10px] bg-card md:rounded-none',
        className,
      )}
    >
      {children}
    </article>
  )
}

function CloseLink() {
  return (
    <Link
      to="/"
      aria-label="Fechar e continuar explorando"
      className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-md text-text-accent hover:bg-surface-dark"
    >
      <XIcon aria-hidden className="size-5" />
    </Link>
  )
}

function ConfirmedCard({ order }: { order: Order }) {
  const s = order.snapshot
  const network = NETWORK_LABELS[s.network]
  return (
    <Card className="border-b-[10px] border-brand">
      <CloseLink />
      <header className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center" role="status">
        <ThankYouEnvelope className="h-[80px] w-[68px] text-text-accent" />
        <div>
          <h1 id="order-status-title" className="text-lg font-bold text-text-primary">
            Pedido confirmado
          </h1>
          <p className="mt-1 text-[15px] font-bold text-text-secondary">
            Seus NFTs agora estão na sua carteira
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-y-3 border-y border-brand px-6 py-3 text-[13px] whitespace-nowrap sm:flex sm:justify-between sm:divide-x sm:divide-brand sm:px-8">
        <div className="sm:pr-4">
          <dt className="font-bold text-text-secondary">ID da transação</dt>
          <dd className="text-text-secondary">
            {order.txHash ? <TxHash hash={order.txHash} /> : '—'}
          </dd>
        </div>
        <div className="sm:px-4">
          <dt className="text-text-secondary">Data</dt>
          <dd className="text-text-secondary">{formatOrderDate(order.updatedAt)}</dd>
        </div>
        <div className="sm:px-4">
          <dt className="text-text-secondary">Total</dt>
          <dd className="text-text-secondary tabular-nums">{formatEth(s.totalEth)}</dd>
        </div>
        <div className="sm:pl-4">
          <dt className="font-bold text-text-secondary">Carteira</dt>
          <dd className="text-text-secondary">{PROVIDER_LABELS[s.wallet.provider]}</dd>
        </div>
      </dl>

      <div className="px-6 pt-6 pb-8 sm:px-11">
        <h2 className="mb-3 text-[15px] font-bold text-text-primary">Detalhes da transação</h2>
        <OrderLines order={order} />
        <OrderTotals order={order} className="mt-5 border-t border-border-soft pt-4" />
        <OrderMeta order={order} className="mt-5 border-t border-border-soft pt-4" />
        <p className="mt-5 border-t border-border-soft pt-4 text-center text-[13px] leading-relaxed text-text-secondary">
          Transação confirmada na {network}. A propriedade foi transferida para sua carteira
          conectada e registrada na rede.
        </p>
        <div className="mt-5 flex flex-col items-center gap-4">
          {order.explorerUrl && (
            <Button asChild className="h-12 rounded-[4px] px-4 text-[15px] font-bold">
              <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
                Ver no {EXPLORER_LABELS[s.network]}
                <ExternalLinkIcon aria-hidden />
                <span className="sr-only">(abre em nova aba; link simulado)</span>
              </a>
            </Button>
          )}
          <Link to="/" className="text-[15px] text-text-accent underline-offset-4 hover:underline">
            Continuar explorando
          </Link>
        </div>
      </div>
    </Card>
  )
}

function PendingCard({ order }: { order: Order }) {
  const realtime = useRealtimeStatus()
  return (
    <Card>
      <header className="flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center">
        <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-surface-dark">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-brand/70 motion-safe:animate-ping"
          />
          <HourglassIcon aria-hidden className="size-7 text-text-accent" />
        </span>
        <div role="status">
          <h1 id="order-status-title" className="text-lg font-bold text-text-primary">
            Aguardando confirmação da rede…
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Pedido criado. Você pode fechar ou recarregar a página: o status é recuperado
            automaticamente e nenhuma nova compra é feita.
          </p>
        </div>
        {realtime === 'reconnecting' && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-full bg-surface-dark px-3 py-1 text-xs text-text-secondary"
          >
            <WifiOffIcon aria-hidden className="size-3.5" />
            Reconectando…
          </p>
        )}
      </header>
      <div className="border-t border-border-soft px-6 pt-5 pb-8 sm:px-11">
        <p className="mb-4 text-xs text-text-secondary">
          Pedido <span className="font-mono">{order.id}</span> · {formatOrderDate(order.createdAt)}
        </p>
        <OrderLines order={order} />
        <OrderTotals order={order} className="mt-5 border-t border-border-soft pt-4" />
        <OrderMeta order={order} className="mt-5 border-t border-border-soft pt-4" />
      </div>
    </Card>
  )
}

function DeclinedCard({ order }: { order: Order }) {
  return (
    <Card className="border-b-[10px] border-destructive/70">
      <CloseLink />
      <header className="flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center" role="status">
        <CircleXIcon aria-hidden className="size-16 stroke-[1.4] text-destructive" />
        <div>
          <h1 id="order-status-title" className="text-lg font-bold text-text-primary">
            Pagamento recusado
          </h1>
          {order.declineReason && (
            <p className="mt-1 text-[15px] text-text-secondary">
              Motivo: <span className="text-text-primary">{order.declineReason}</span>
            </p>
          )}
          <p className="mt-2 text-sm text-text-secondary">
            Nada foi cobrado e seus itens continuam no carrinho.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="h-11 rounded-[4px] font-bold">
            <Link to="/checkout">Tentar novamente</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-[4px]">
            <Link to="/cart">Voltar ao carrinho</Link>
          </Button>
        </div>
      </header>
      <div className="border-t border-border-soft px-6 pt-5 pb-8 sm:px-11">
        <h2 className="mb-3 text-[15px] font-bold text-text-primary">Itens do pedido</h2>
        <OrderLines order={order} />
        <OrderTotals order={order} className="mt-5 border-t border-border-soft pt-4" />
      </div>
    </Card>
  )
}

export function OrderSkeleton() {
  return (
    <div className="md:bg-black/40 md:py-16">
      <Container className="py-6 md:py-0">
        <div
          role="status"
          aria-label="Carregando pedido"
          className="mx-auto flex w-full max-w-[578px] flex-col items-center gap-4 rounded-[10px] bg-card p-6 md:rounded-none"
        >
          <span className="sr-only">Carregando pedido…</span>
          <div className="skeleton size-[72px] rounded-full" />
          <div className="skeleton h-5 w-64" />
          <div className="skeleton h-12 w-full" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[70px] w-full rounded-[4px]" />
          ))}
          <div className="skeleton h-24 w-full" />
        </div>
      </Container>
    </div>
  )
}

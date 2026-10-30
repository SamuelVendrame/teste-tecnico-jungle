import { Link } from '@tanstack/react-router'
import { CheckCircle2Icon, ClockIcon, ReceiptIcon, XCircleIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import type { OrderStatus } from '@/api/contracts'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { EthAmount } from '@/components/common/EthAmount'
import { cn } from '@/lib/utils'

import { useOrders } from './use-profile'

const STATUS: Record<OrderStatus, { label: string; icon: ReactNode; className: string }> = {
  pending: {
    label: 'Pendente',
    icon: <ClockIcon />,
    className: 'border-brand-secondary text-text-secondary',
  },
  confirmed: {
    label: 'Confirmado',
    icon: <CheckCircle2Icon />,
    className: 'border-brand text-text-accent',
  },
  declined: {
    label: 'Recusado',
    icon: <XCircleIcon />,
    className: 'border-destructive text-destructive',
  },
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

/** Chip com ícone e texto (o estado nunca depende só da cor). */
function StatusChip({ status }: { status: OrderStatus }) {
  const { label, icon, className } = STATUS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold [&_svg]:size-3.5',
        className,
      )}
    >
      <span aria-hidden className="contents">
        {icon}
      </span>
      {label}
    </span>
  )
}

export function OrdersSection() {
  const orders = useOrders()
  const items = [...(orders.data?.items ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  return (
    <section id="pedidos" aria-labelledby="pedidos-title" className="scroll-mt-24 space-y-5">
      <h2 id="pedidos-title" className="text-base font-bold text-text-primary">
        Pedidos
      </h2>
      {orders.isPending ? (
        <div role="status" aria-label="Carregando pedidos" className="space-y-3">
          <span className="sr-only">Carregando pedidos…</span>
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} aria-hidden className="skeleton h-[76px] w-full rounded-lg" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState
          title="Não foi possível carregar seus pedidos"
          onRetry={() => void orders.refetch()}
          retrying={orders.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum pedido ainda"
          description="Quando você comprar um NFT, o pedido aparece aqui."
          icon={<ReceiptIcon />}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((order) => (
            <li
              key={order.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto_auto] md:gap-x-6"
            >
              <p className="min-w-0 truncate text-sm font-bold text-text-primary">
                <span className="sr-only">Pedido </span>
                {order.id}
              </p>
              <p className="order-3 text-xs text-text-secondary md:order-none">
                <time dateTime={order.createdAt}>
                  {dateFormat.format(new Date(order.createdAt))}
                </time>
              </p>
              <div className="order-2 justify-self-end md:order-none">
                <StatusChip status={order.status} />
              </div>
              <p className="order-4 justify-self-end text-sm font-bold text-text-primary md:order-none">
                <EthAmount value={order.snapshot.totalEth} />
              </p>
              <Link
                to="/orders/$orderId"
                params={{ orderId: order.id }}
                aria-label={`Ver pedido ${order.id}`}
                className="order-5 col-span-2 text-sm font-bold text-text-accent underline underline-offset-4 md:order-none md:col-span-1"
              >
                Ver pedido
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

import { Link } from '@tanstack/react-router'
import { ClockIcon } from 'lucide-react'

import type { Cart, Quote } from '@/api/contracts'
import { EthAmount } from '@/components/common/EthAmount'
import { NftImage } from '@/components/common/NftImage'
import { QuoteIssues } from '@/features/cart/components/QuoteIssues'
import { QuoteTotals } from '@/features/cart/components/QuoteTotals'
import { cn } from '@/lib/utils'

import { formatCountdown } from '../use-quote-countdown'

interface ReviewSectionProps {
  quote: Quote | undefined
  cart: Cart
  refreshing: boolean
  failed: boolean
  onRetry: () => void
  secondsLeft: number | null
  className?: string
}

/** Passo 3: revisão com os valores da cotação (fonte da verdade do pedido). */
export function ReviewSection({
  quote,
  cart,
  refreshing,
  failed,
  onRetry,
  secondsLeft,
  className,
}: ReviewSectionProps) {
  return (
    <section aria-labelledby="review-title" className={className}>
      <h2 id="review-title" className="text-base font-bold text-text-primary">
        Seus NFTs
      </h2>
      <div
        aria-hidden
        className="mt-3 hidden justify-between text-[15px] font-bold text-text-primary md:flex"
      >
        <span>NFTs</span>
        <span>Subtotal</span>
      </div>

      {quote ? (
        <ul
          aria-busy={refreshing}
          className={cn('mt-3 flex flex-col gap-3 transition-opacity', refreshing && 'opacity-60')}
        >
          {quote.lines.map((line) => (
            <li
              key={`${line.nftId}:${line.editionId}`}
              className="flex items-center gap-3 rounded-[10px] bg-card p-1 pr-4 md:rounded-[2px]"
            >
              <NftImage
                src={line.imageUrl}
                alt=""
                width={70}
                height={70}
                sizes="70px"
                className="size-[62px] shrink-0 rounded-[8px] object-cover md:size-[70px] md:rounded-[4px]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-text-primary">{line.name}</p>
                <p className="truncate text-[13px] text-text-secondary">
                  Edição: {line.editionName}
                </p>
              </div>
              <span className="text-[13px] text-text-secondary">
                <span aria-hidden>(x {line.quantity})</span>
                <span className="sr-only">{line.quantity} unidade(s)</span>
              </span>
              <EthAmount
                value={line.lineTotalEth}
                className="text-right text-[15px] font-bold text-text-accent md:text-[17px]"
              />
            </li>
          ))}
        </ul>
      ) : failed ? null : (
        <div aria-hidden className="mt-3 flex flex-col gap-3">
          {cart.items.map((i) => (
            <div
              key={i.id}
              className="skeleton h-[70px] rounded-[10px] md:h-[78px] md:rounded-[2px]"
            />
          ))}
        </div>
      )}

      {quote && <QuoteIssues issues={quote.issues} cart={cart} className="mt-3" />}
      {quote && quote.issues.some((i) => i.type !== 'price-changed') && (
        <p className="mt-2 text-sm">
          <Link
            to="/cart"
            className="font-bold text-text-accent underline-offset-4 hover:underline"
          >
            Ajustar no carrinho
          </Link>
        </p>
      )}

      <p className="mt-4 text-center text-[13px] text-text-secondary">
        {quote?.coupon ? (
          <>
            Cupom <strong className="text-text-accent">{quote.coupon.code}</strong> aplicado.{' '}
          </>
        ) : (
          'Tem um código promocional? '
        )}
        <Link to="/cart" className="text-text-primary underline-offset-4 hover:underline">
          {quote?.coupon ? 'Alterar no carrinho' : 'Aplique no carrinho'}
        </Link>
      </p>

      {failed && !quote ? (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 text-sm">
          <p className="text-text-secondary">Não foi possível calcular a cotação.</p>
          <button
            type="button"
            onClick={onRetry}
            className="font-bold text-text-accent underline-offset-4 hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <QuoteTotals
          className="mt-4"
          refreshing={refreshing}
          values={
            quote
              ? {
                  subtotalEth: quote.subtotalEth,
                  discountEth: quote.discountEth,
                  networkFeeEth: quote.networkFeeEth,
                  totalEth: quote.totalEth,
                  couponCode: quote.coupon?.code ?? null,
                }
              : null
          }
        />
      )}

      {secondsLeft !== null && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-text-secondary">
          <ClockIcon aria-hidden className="size-3.5" />
          {secondsLeft > 0 ? (
            <>
              Cotação válida por{' '}
              <span className="tabular-nums" aria-hidden>
                {formatCountdown(secondsLeft)}
              </span>
              <span className="sr-only">{Math.ceil(secondsLeft / 60)} minuto(s)</span>
            </>
          ) : (
            'Atualizando cotação…'
          )}
        </p>
      )}
    </section>
  )
}

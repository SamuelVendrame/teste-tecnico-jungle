import { Link } from '@tanstack/react-router'
import { RotateCwIcon } from 'lucide-react'

import type { Quote } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { CouponForm } from './CouponForm'
import { QuoteTotals } from './QuoteTotals'

interface CartSummaryProps {
  quote: Quote | undefined
  refreshing: boolean
  couponCode: string | null
  couponQuoteError: string | null
  quoteFailed: boolean
  onRetryQuote: () => void
  checkoutDisabledReason: string | null
  onCheckout: () => void
  className?: string
}

/**
 * "Resumo da carteira" (desktop) / "Payment Summary" (mobile): cupom, valores
 * da cotação e o botão que leva ao checkout.
 */
export function CartSummary({
  quote,
  refreshing,
  couponCode,
  couponQuoteError,
  quoteFailed,
  onRetryQuote,
  checkoutDisabledReason,
  onCheckout,
  className,
}: CartSummaryProps) {
  const reasonId = 'cart-checkout-reason'
  return (
    <section
      aria-labelledby="cart-summary-title"
      className={cn(
        '-mx-4 rounded-t-[32px] bg-card px-6 pt-6 pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] sm:-mx-6 md:mx-0 md:rounded-none md:bg-transparent md:p-0 md:shadow-none',
        className,
      )}
    >
      <h2
        id="cart-summary-title"
        className="sr-only md:not-sr-only md:block md:border-b md:border-border-soft md:pb-3 md:text-base md:font-bold md:text-text-primary"
      >
        Resumo da carteira
      </h2>

      <CouponForm appliedCode={couponCode} quoteError={couponQuoteError} className="md:mt-6" />

      {quoteFailed && !quote ? (
        <div role="alert" className="mt-5 flex items-center justify-between gap-3 text-sm">
          <p className="text-text-secondary">Não foi possível calcular o resumo.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetryQuote}
            className="rounded-[4px]"
          >
            <RotateCwIcon aria-hidden />
            Tentar novamente
          </Button>
        </div>
      ) : (
        <QuoteTotals
          className="mt-3 md:mt-6"
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

      <Button
        type="button"
        onClick={onCheckout}
        disabled={checkoutDisabledReason !== null}
        aria-describedby={checkoutDisabledReason ? reasonId : undefined}
        className="mt-6 h-[60px] w-full rounded-full bg-linear-to-r from-brand to-[#a8703f] text-[15px] font-bold text-ink hover:opacity-95 md:mt-5 md:h-10 md:rounded-[2px] md:bg-none md:bg-brand"
      >
        Conectar e finalizar
      </Button>
      {checkoutDisabledReason && (
        <p id={reasonId} className="mt-2 text-center text-xs text-text-secondary">
          {checkoutDisabledReason}
        </p>
      )}
      <Link
        to="/"
        className="mt-4 hidden text-center text-[15px] text-text-accent hover:underline md:block"
      >
        Continuar explorando
      </Link>
    </section>
  )
}

import { TicketIcon, XIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'

import { announce } from '@/components/common/announce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { couponErrorMessage, useSetCoupon } from '../use-cart'

interface CouponFormProps {
  appliedCode: string | null
  /** Erro de cupom vindo da cotação (ex.: cupom aplicado deixou de valer). */
  quoteError?: string | null
  className?: string
}

/** Campo "Código promocional" com aplicar/remover e erros inline. */
export function CouponForm({ appliedCode, quoteError, className }: CouponFormProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const setCoupon = useSetCoupon()
  const shownError = error ?? quoteError ?? null

  function apply(event: FormEvent) {
    event.preventDefault()
    const value = code.trim().toUpperCase()
    if (!value) {
      setError('Digite um código promocional')
      return
    }
    setError(null)
    setCoupon.mutate(value, {
      onSuccess: () => {
        setCode('')
        announce(`Cupom ${value} aplicado.`)
      },
      onError: (e) => {
        // O parágrafo de erro tem role=alert: o leitor de tela já é avisado.
        setError(couponErrorMessage(e))
      },
    })
  }

  function remove() {
    setError(null)
    setCoupon.mutate(null, {
      onSuccess: () => announce('Cupom removido.'),
      onError: (e) => setError(couponErrorMessage(e)),
    })
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {appliedCode ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-brand/60 px-4 py-2.5 md:rounded-[4px]">
          <p className="flex items-center gap-2 text-sm text-text-primary">
            <TicketIcon aria-hidden className="size-4 text-text-accent" />
            Cupom <strong className="text-text-accent">{appliedCode}</strong> aplicado
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={setCoupon.isPending}
            aria-busy={setCoupon.isPending}
            aria-label={`Remover cupom ${appliedCode}`}
            className="h-7 text-xs text-text-secondary hover:text-text-accent"
          >
            <XIcon aria-hidden />
            Remover
          </Button>
        </div>
      ) : (
        <form onSubmit={apply} noValidate>
          <Label
            htmlFor={id}
            className="sr-only text-[13px] font-bold text-text-primary md:not-sr-only md:mb-2 md:block"
          >
            Código promocional
          </Label>
          <div className="flex h-[50px] overflow-hidden rounded-full border border-border-soft bg-surface-card md:h-10 md:rounded-[2px] md:border-brand">
            <Input
              id={id}
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Código promocional"
              autoComplete="off"
              autoCapitalize="characters"
              aria-invalid={shownError ? true : undefined}
              aria-describedby={shownError ? errorId : undefined}
              className="h-full flex-1 rounded-none border-0 bg-transparent px-4 text-sm shadow-none placeholder:text-text-secondary/80 focus-visible:ring-0 md:text-xs dark:bg-transparent"
            />
            <Button
              type="submit"
              disabled={setCoupon.isPending}
              aria-busy={setCoupon.isPending}
              className="h-full rounded-full bg-linear-to-r from-brand to-[#a8703f] px-5 text-[15px] font-bold text-ink md:rounded-none md:bg-none md:bg-brand"
            >
              {setCoupon.isPending ? 'Aplicando…' : 'Aplicar'}
            </Button>
          </div>
        </form>
      )}
      {shownError && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {shownError}
        </p>
      )}
    </div>
  )
}

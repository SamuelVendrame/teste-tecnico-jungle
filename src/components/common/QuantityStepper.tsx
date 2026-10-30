import { MinusIcon, PlusIcon } from 'lucide-react'
import { useId } from 'react'

import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
  disabled?: boolean
  /** Texto de ajuda exibido abaixo ("Máximo de N por pedido"). */
  helperText?: string
  size?: 'md' | 'sm'
  label?: string
  showLabel?: boolean
  className?: string
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  helperText,
  size = 'md',
  label = 'Quantidade',
  showLabel = false,
  className,
}: QuantityStepperProps) {
  const helperId = useId()
  const canDecrease = !disabled && value > min
  const canIncrease = !disabled && value < max
  const button =
    size === 'md' ? 'size-[33px] [&_svg]:size-5' : 'h-[30px] w-5 rounded-[6px] [&_svg]:size-3.5'

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        role="group"
        aria-label={label}
        aria-describedby={helperText ? helperId : undefined}
        className="flex items-center gap-3"
      >
        {showLabel && (
          <span aria-hidden className="mr-1 text-sm font-medium text-text-secondary">
            Qtd.
          </span>
        )}
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={!canDecrease}
          aria-label="Diminuir quantidade"
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-brand text-ink transition-opacity hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40',
            button,
          )}
        >
          <MinusIcon aria-hidden strokeWidth={2.5} />
        </button>
        <output
          aria-live="polite"
          aria-label={`${label}: ${value}`}
          className={cn(
            'min-w-[1.5ch] text-center tabular-nums',
            size === 'md' ? 'text-lg' : 'text-xl font-medium',
          )}
        >
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={!canIncrease}
          aria-label="Aumentar quantidade"
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-brand text-ink transition-opacity hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40',
            button,
          )}
        >
          <PlusIcon aria-hidden strokeWidth={2.5} />
        </button>
      </div>
      {helperText && (
        <p id={helperId} className="text-xs text-text-secondary">
          {helperText}
        </p>
      )}
    </div>
  )
}

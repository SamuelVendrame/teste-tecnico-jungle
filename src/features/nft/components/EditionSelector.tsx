import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { useId } from 'react'

import type { NftEdition } from '@/api/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

interface EditionSelectorProps {
  editions: NftEdition[]
  value: string
  onChange: (editionId: string) => void
}

/**
 * Seletor de edição (radio group: setas navegam entre opções). Edições
 * esgotadas ficam desabilitadas e marcadas "Esgotada" (texto, não só cor).
 */
export function EditionSelector({ editions, value, onChange }: EditionSelectorProps) {
  const labelId = useId()
  return (
    <div>
      <p id={labelId} className="text-sm font-bold text-text-primary">
        Edição:
      </p>
      <RadioGroupPrimitive.Root
        aria-labelledby={labelId}
        value={value}
        onValueChange={onChange}
        orientation="horizontal"
        className="mt-3 flex flex-wrap gap-1.5 md:gap-1.5"
      >
        {editions.map((edition) => {
          const soldOut = edition.available === 0
          return (
            <RadioGroupPrimitive.Item
              key={edition.id}
              value={edition.id}
              disabled={soldOut}
              aria-label={`${edition.name}, ${formatEth(edition.priceEth)}${soldOut ? ', esgotada' : `, ${edition.available} disponíveis`}`}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-[13px] text-text-secondary transition-colors',
                'data-[state=checked]:border-brand data-[state=checked]:text-text-accent',
                'data-[state=unchecked]:border-border-soft data-[state=unchecked]:hover:border-brand/70',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              <span className={cn(soldOut && 'line-through')}>{edition.name}</span>
              {soldOut && (
                <span className="rounded-full bg-surface-dark px-1.5 text-[10px] font-medium text-text-secondary no-underline">
                  Esgotada
                </span>
              )}
            </RadioGroupPrimitive.Item>
          )
        })}
      </RadioGroupPrimitive.Root>
    </div>
  )
}

import { Link } from '@tanstack/react-router'
import { Trash2Icon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { CartItem, EthAmount as EthAmountValue } from '@/api/contracts'
import { EthAmount } from '@/components/common/EthAmount'
import { NftImage } from '@/components/common/NftImage'
import { QuantityStepper } from '@/components/common/QuantityStepper'
import { mulEth } from '@/lib/money'

import { CART_GRID } from './cart-grid'

/** Espera entre o último clique no +/- e o PATCH (agrupa cliques seguidos). */
const QUANTITY_DEBOUNCE_MS = 350

interface CartItemRowProps {
  item: CartItem
  /** Preço unitário da cotação (fonte da verdade); sem cotação, o snapshot do item. */
  unitPriceEth: EthAmountValue
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
  removing?: boolean
}

function itemLimit(item: CartItem): number {
  return Math.max(1, Math.min(item.edition.available, item.edition.maxPerOrder))
}

export function CartItemRow({
  item,
  unitPriceEth,
  onQuantityChange,
  onRemove,
  removing = false,
}: CartItemRowProps) {
  const [draft, setDraft] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quantity = draft ?? item.quantity
  const limit = itemLimit(item)
  const label = `${item.nft.name} (${item.edition.name})`

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function change(next: number) {
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      setDraft(null)
      if (next !== item.quantity) onQuantityChange(next)
    }, QUANTITY_DEBOUNCE_MS)
  }

  const lineTotal = mulEth(unitPriceEth, quantity)
  const helper =
    item.edition.available === 0
      ? 'Esgotado'
      : quantity >= limit
        ? `Máximo de ${limit} ${limit === 1 ? 'unidade' : 'unidades'}`
        : undefined

  const stepper = (
    <QuantityStepper
      size="sm"
      value={quantity}
      min={1}
      max={Math.max(limit, quantity)}
      onChange={change}
      disabled={removing}
      label={`Quantidade de ${label}`}
      helperText={helper}
    />
  )

  return (
    <li
      aria-label={label}
      className="relative flex overflow-hidden rounded-[10px] bg-card md:h-[70px] md:rounded-[4px] md:pr-6"
    >
      <div className={`flex w-full items-stretch md:items-center ${CART_GRID}`}>
        {/* Arte + nome */}
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to="/nft/$slug"
            params={{ slug: item.nft.slug }}
            tabIndex={-1}
            aria-hidden
            className="shrink-0"
          >
            <NftImage
              src={item.nft.imageUrl}
              alt=""
              width={100}
              height={100}
              sizes="100px"
              className="size-[100px] rounded-[10px] object-cover md:size-[70px] md:rounded-[4px]"
            />
          </Link>
          <div className="min-w-0 flex-1 py-3 pr-10 md:p-0">
            <Link
              to="/nft/$slug"
              params={{ slug: item.nft.slug }}
              className="block truncate text-[15px] font-bold text-text-primary hover:text-text-accent"
            >
              {item.nft.name}
            </Link>
            <p className="mt-1.5 truncate text-[13px] text-text-secondary">
              Edição: {item.edition.name}
            </p>
            {/* Mobile: preço à esquerda e stepper à direita na mesma linha, como no Figma.
                A ajuda ("Máximo de N unidades") fica sob o stepper e o card cresce. */}
            <div className="-mr-7 mt-3 flex items-start justify-between gap-2 md:hidden">
              {/* Mesma altura dos botões do stepper: a ajuda abaixo dele não desalinha o preço. */}
              <p className="flex h-[30px] shrink-0 items-center whitespace-nowrap">
                <span className="sr-only">Total do item: </span>
                <EthAmount value={lineTotal} className="text-[17px] font-bold text-text-accent" />
              </p>
              <div className="shrink-0 [&_p]:max-w-[104px] [&_p]:text-right">{stepper}</div>
            </div>
          </div>
        </div>

        <p className="hidden text-[15px] font-medium text-text-secondary md:block">
          <span className="sr-only">Preço unitário: </span>
          <EthAmount value={unitPriceEth} />
        </p>

        <div className="hidden md:block">{stepper}</div>

        <p className="hidden text-[15px] font-bold text-text-accent md:block">
          <span className="sr-only">Total do item: </span>
          <EthAmount value={lineTotal} />
        </p>

        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remover ${label} do carrinho`}
          className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-md text-text-secondary hover:text-text-accent disabled:opacity-50 md:static md:size-6"
        >
          <Trash2Icon aria-hidden className="size-5" />
        </button>
      </div>
    </li>
  )
}

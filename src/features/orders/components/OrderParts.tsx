import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { NETWORK_LABELS, type Order } from '@/api/contracts'
import { announce } from '@/components/common/announce'
import { EthAmount } from '@/components/common/EthAmount'
import { NftImage } from '@/components/common/NftImage'
import { QuoteTotals } from '@/features/cart/components/QuoteTotals'
import { PROVIDER_LABELS } from '@/features/wallets/wallet-meta'
import { cn } from '@/lib/utils'

import { truncateHash } from '../format'

/** Hash da transação truncado + botão de copiar o valor completo. */
export function TxHash({ hash, className }: { hash: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      announce('ID da transação copiado.')
      toast.success('ID da transação copiado')
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto manualmente.')
    }
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="font-mono" title={hash}>
        {truncateHash(hash)}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? 'ID da transação copiado' : 'Copiar ID da transação'}
        className="inline-flex size-6 items-center justify-center rounded text-text-secondary hover:text-text-accent"
      >
        {copied ? (
          <CheckIcon aria-hidden className="size-3.5" />
        ) : (
          <CopyIcon aria-hidden className="size-3.5" />
        )}
      </button>
    </span>
  )
}

/** Envelope com o cartão "THANK YOU" do modal de confirmação do Figma (decorativo). */
export function ThankYouEnvelope({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 68 80"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M28 6.5 34 2l6 4.5" />
      <path d="M9 34V8.5a2 2 0 0 1 2-2h46a2 2 0 0 1 2 2V34" />
      <text
        x="34"
        y="22"
        fill="currentColor"
        stroke="none"
        fontFamily="'Roboto Mono', ui-monospace, monospace"
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
      >
        THANK
      </text>
      <text
        x="34"
        y="34"
        fill="currentColor"
        stroke="none"
        fontFamily="'Roboto Mono', ui-monospace, monospace"
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
      >
        YOU
      </text>
      <path d="M2 34v40a3 3 0 0 0 3 3h58a3 3 0 0 0 3-3V34" />
      <path d="M2 34 9 28.5M66 34l-7-5.5" />
      <path d="M2 76 26 54M66 76 42 54" />
      <path d="M2 34l32 26 32-26" />
    </svg>
  )
}

/** Itens do snapshot do pedido ("Detalhes da transação"). */
export function OrderLines({ order, className }: { order: Order; className?: string }) {
  return (
    <div className={className}>
      <div
        aria-hidden
        className="grid grid-cols-[minmax(0,1fr)_60px_84px] gap-x-2 sm:grid-cols-[minmax(0,1fr)_72px_96px] border-b border-border-soft pb-3 text-[13px] font-bold text-text-primary sm:text-[15px]"
      >
        <span>NFTs</span>
        <span className="text-center">Edições</span>
        <span className="text-right">Subtotal</span>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {order.snapshot.lines.map((line) => (
          <li
            key={`${line.nftId}:${line.editionId}`}
            className="grid grid-cols-[minmax(0,1fr)_60px_84px] gap-x-2 sm:grid-cols-[minmax(0,1fr)_72px_96px] items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <NftImage
                src={line.imageUrl}
                alt=""
                width={70}
                height={70}
                sizes="70px"
                className="size-11 shrink-0 rounded-[4px] object-cover sm:size-[70px]"
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-[15px] leading-5 font-bold break-words text-text-primary">
                  {line.name}
                </p>
                <p className="truncate text-[13px] text-text-secondary">
                  Edição: {line.editionName}
                </p>
              </div>
            </div>
            <span className="text-center text-[13px] text-text-secondary">
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
    </div>
  )
}

/** Totais SEMPRE do snapshot: mudanças posteriores no catálogo não alteram o recibo. */
export function OrderTotals({ order, className }: { order: Order; className?: string }) {
  const s = order.snapshot
  return (
    <QuoteTotals
      className={className}
      values={{
        subtotalEth: s.subtotalEth,
        discountEth: s.discountEth,
        networkFeeEth: s.networkFeeEth,
        totalEth: s.totalEth,
        couponCode: s.couponCode,
      }}
    />
  )
}

/** Carteira, rede e colecionador do snapshot. */
export function OrderMeta({ order, className }: { order: Order; className?: string }) {
  const s = order.snapshot
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2', className)}>
      <div>
        <dt className="text-text-secondary">Carteira</dt>
        <dd className="text-text-primary">
          {s.wallet.label} · {PROVIDER_LABELS[s.wallet.provider]}
        </dd>
      </div>
      <div>
        <dt className="text-text-secondary">Rede</dt>
        <dd className="text-text-primary">{NETWORK_LABELS[s.network]}</dd>
      </div>
      <div>
        <dt className="text-text-secondary">Colecionador</dt>
        <dd className="text-text-primary">
          {s.collector.displayName}
          <span className="text-text-secondary">
            {' '}
            · {s.collector.ensName}
            {s.collector.ensSuffix}
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-text-secondary">E-mail</dt>
        <dd className="break-all text-text-primary">{s.collector.email}</dd>
      </div>
    </dl>
  )
}

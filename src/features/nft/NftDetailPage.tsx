import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeftIcon, HeartIcon, MailIcon, ShoppingCartIcon } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { COLLECTION_LABELS, NETWORK_LABELS, type Nft } from '@/api/contracts'
import { announce } from '@/components/common/announce'
import { EthAmount } from '@/components/common/EthAmount'
import { FavoriteButton } from '@/components/common/FavoriteButton'
import { formatHandle, nftAlt } from '@/components/common/nft-display'
import { QuantityStepper } from '@/components/common/QuantityStepper'
import { Container } from '@/components/layout/Container'
import { LinkedinIcon, TwitterIcon } from '@/components/layout/SocialIcons'
import { useAddToCart } from '@/features/cart/use-cart'
import { compareEth, mulEth } from '@/lib/money'
import { cn } from '@/lib/utils'

import { EditionSelector } from './components/EditionSelector'
import { NftGallery } from './components/NftGallery'
import { NftInfoTabs } from './components/NftInfoTabs'
import { RelatedNfts } from './components/RelatedNfts'
import { nftDetailOptions } from './queries'
import { useNftPurchase, type NftPurchase } from './use-nft-purchase'

/** O Figma mostra sempre 4 miniaturas: completa a coluna repetindo as variantes disponíveis. */
const GALLERY_SIZE = 4

function galleryImages(nft: Nft): string[] {
  const unique = [...new Set([nft.imageUrl, ...nft.gallery])]
  return Array.from({ length: GALLERY_SIZE }, (_, index) => unique[index % unique.length]!)
}

export function NftDetailPage({ slug }: { slug: string }) {
  const { data: nft } = useSuspenseQuery(nftDetailOptions(slug))
  // `key` reinicia edição/quantidade ao navegar entre NFTs relacionados.
  return <NftDetail key={nft.id} nft={nft} />
}

function NftDetail({ nft }: { nft: Nft }) {
  const purchase = useNftPurchase(nft)
  const addToCart = useAddToCart()
  const navigate = useNavigate()
  const images = galleryImages(nft)

  useEffect(() => {
    document.title = `${nft.name} · Kurio`
  }, [nft.name])

  function handleAdd(goToCart: boolean) {
    const { edition, quantity } = purchase
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          const summary = `${quantity} × ${nft.name} (${edition.name})`
          announce(`${summary} adicionado ao carrinho`)
          if (goToCart) {
            void navigate({ to: '/cart' })
            return
          }
          toast.success('Adicionado ao carrinho', {
            description: summary,
            action: { label: 'Ver carrinho', onClick: () => void navigate({ to: '/cart' }) },
          })
        },
      },
    )
  }

  const actions: PurchaseActions = {
    purchase,
    pending: addToCart.isPending,
    onBuy: () => handleAdd(true),
    onAdd: () => handleAdd(false),
  }

  return (
    <article className="pb-[176px] md:pb-0">
      <Container className="px-0 sm:px-0 md:px-6 md:pt-8 xl:px-4">
        <Breadcrumb nft={nft} />
        <div className="md:mt-3 lg:grid lg:grid-cols-[573px_minmax(0,1fr)] lg:gap-8">
          {/* Mobile: área do hero com voltar/favoritar. Desktop: galeria com miniaturas. */}
          <div className="bg-card px-7 pt-6 pb-[52px] md:bg-transparent md:p-0">
            <MobileTopBar nft={nft} />
            <NftGallery images={images} alt={nftAlt(nft)} />
          </div>

          <div className="relative -mt-[30px] rounded-t-[32px] bg-background px-6 pt-8 md:mt-8 md:rounded-none md:px-0 md:pt-0 lg:mt-0">
            <NftSummary nft={nft} purchase={purchase} />
            <div className="mt-5 hidden md:block">
              <DesktopPurchaseRow {...actions} nft={nft} />
            </div>
            <TokenInfo nft={nft} />
            <ShareRow nft={nft} />
          </div>
        </div>
      </Container>

      <Container>
        <NftInfoTabs nft={nft} />
        <RelatedNfts slug={nft.slug} />
      </Container>

      <MobileBuyBar {...actions} />
    </article>
  )
}

interface PurchaseActions {
  purchase: NftPurchase
  pending: boolean
  onBuy: () => void
  onAdd: () => void
}

function Breadcrumb({ nft }: { nft: Nft }) {
  return (
    <nav aria-label="Trilha de navegação" className="hidden md:block">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-text-primary">
        <li>
          <Link to="/" className="hover:text-text-accent">
            Início
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li>
          <Link to="/" search={{ collection: [nft.collection] }} className="hover:text-text-accent">
            {COLLECTION_LABELS[nft.collection]}
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li aria-current="page" className="font-normal text-text-secondary">
          {nft.name}
        </li>
      </ol>
    </nav>
  )
}

function MobileTopBar({ nft }: { nft: Nft }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  return (
    <div className="mb-2 flex items-center justify-between md:hidden">
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}
        className="inline-flex size-[35px] items-center justify-center rounded-full border border-border-soft bg-background/40 text-text-primary"
      >
        <ChevronLeftIcon aria-hidden className="size-5" />
      </button>
      <FavoriteButton
        nftId={nft.id}
        nftName={nft.name}
        className="size-[35px] border-border-soft bg-background/40"
      />
    </div>
  )
}

function NftSummary({ nft, purchase }: { nft: Nft; purchase: NftPurchase }) {
  const { edition, quantity, totalEth } = purchase
  const compareAt =
    nft.compareAtPriceEth && compareEth(edition.priceEth, nft.priceEth) === 0
      ? mulEth(nft.compareAtPriceEth, quantity)
      : null

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-lg leading-7 font-bold text-text-primary md:text-[32px] md:leading-[37px]">
          {nft.name}
        </h1>
        <span className="inline-flex h-[27px] shrink-0 items-center gap-1 rounded-full border border-brand px-2.5 text-sm font-bold text-text-primary md:hidden">
          <HeartIcon aria-hidden className="size-3.5 fill-brand text-brand" />
          {nft.likes}
          <span className="sr-only">curtidas</span>
        </span>
      </div>

      <div className="mt-3 hidden items-center justify-between gap-4 border-b border-border pb-3 md:flex">
        <p className="flex items-baseline gap-3">
          <span className="sr-only">Preço: </span>
          <EthAmount value={totalEth} className="text-xl font-bold text-text-accent" />
          {compareAt && compareEth(compareAt, totalEth) > 0 && (
            <s className="text-text-secondary">
              <span className="sr-only">Preço original: </span>
              <EthAmount value={compareAt} />
            </s>
          )}
          {quantity > 1 && (
            <span className="text-xs text-text-secondary">
              ({quantity} × <EthAmount value={edition.priceEth} />)
            </span>
          )}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-text-primary">
          <HeartIcon aria-hidden className="size-4 fill-brand text-brand" />
          {nft.likes} colecionadores curtiram
        </p>
      </div>

      <p className="mt-2 text-sm text-text-secondary">
        por <span className="font-medium text-text-primary">{nft.creator.name}</span> ·{' '}
        {formatHandle(nft.creator.handle)}
      </p>
      <ul aria-label="Coleção e rede" className="mt-3 flex flex-wrap gap-2">
        <li>
          <Link
            to="/"
            search={{ collection: [nft.collection] }}
            className="inline-flex h-6 items-center rounded-full border border-border-soft bg-card px-2.5 text-xs text-text-secondary hover:border-brand hover:text-text-primary"
          >
            {COLLECTION_LABELS[nft.collection]}
          </Link>
        </li>
        <li>
          <Link
            to="/"
            search={{ network: [nft.network] }}
            className="inline-flex h-6 items-center rounded-full border border-border-soft bg-card px-2.5 text-xs text-text-secondary hover:border-brand hover:text-text-primary"
          >
            {NETWORK_LABELS[nft.network]}
          </Link>
        </li>
      </ul>

      <h2 className="mt-5 hidden text-sm font-bold text-text-primary md:block">Sobre este NFT:</h2>
      <p className="mt-3 line-clamp-4 text-sm leading-[22px] text-text-secondary md:text-[15px]">
        {nft.description}
      </p>

      <div className="mt-4">
        <EditionSelector
          editions={nft.editions}
          value={edition.id}
          onChange={purchase.selectEdition}
        />
        <p className="mt-2 text-xs text-text-secondary md:hidden" aria-live="polite">
          {purchase.helperText}
        </p>
      </div>
    </div>
  )
}

function DesktopPurchaseRow({
  nft,
  purchase,
  pending,
  onBuy,
  onAdd,
}: PurchaseActions & { nft: Nft }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <QuantityStepper
        value={purchase.quantity}
        onChange={purchase.setQuantity}
        max={purchase.maxQuantity}
        disabled={purchase.soldOut}
        helperText={purchase.helperText}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBuy}
          disabled={purchase.soldOut || pending}
          className="h-10 w-[130px] rounded-[4px] bg-brand text-sm font-bold tracking-[0.06em] text-ink transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {purchase.soldOut ? 'ESGOTADA' : 'COMPRAR'}
        </button>
        <FavoriteButton nftId={nft.id} nftName={nft.name} variant="labeled" className="w-[130px]" />
        <button
          type="button"
          onClick={onAdd}
          disabled={purchase.soldOut || pending}
          aria-label="Adicionar ao carrinho"
          title="Adicionar ao carrinho"
          className="inline-flex size-10 items-center justify-center rounded-[4px] border border-brand text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCartIcon aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  )
}

function TokenInfo({ nft }: { nft: Nft }) {
  return (
    <dl className="mt-5 space-y-3 text-sm leading-5 text-text-secondary md:text-[15px]">
      <div className="flex gap-1.5">
        <dt>ID do token:</dt>
        <dd>#{nft.id}</dd>
      </div>
      <div className="flex gap-1.5">
        <dt>Coleção:</dt>
        <dd>{COLLECTION_LABELS[nft.collection]}</dd>
      </div>
      {nft.attributes.length > 0 && (
        <div className="flex gap-1.5">
          <dt>Atributos:</dt>
          <dd>{nft.attributes.map((a) => a.value).join(', ')}</dd>
        </div>
      )}
    </dl>
  )
}

function ShareRow({ nft }: { nft: Nft }) {
  const url = typeof window === 'undefined' ? '' : window.location.href
  const text = `${nft.name} na Kurio`
  const icon =
    'inline-flex size-6 items-center justify-center rounded text-text-primary transition-colors hover:text-text-accent'
  return (
    <div className="mt-4 hidden items-center gap-2 md:flex">
      <span className="text-sm font-bold text-text-primary">Compartilhar este NFT:</span>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no LinkedIn (abre em nova aba)"
        className={icon}
      >
        <LinkedinIcon className="size-4" />
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`}
        aria-label="Compartilhar por e-mail"
        className={icon}
      >
        <MailIcon aria-hidden className="size-4" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no Twitter (abre em nova aba)"
        className={icon}
      >
        <TwitterIcon className="size-4" />
      </a>
    </div>
  )
}

/** Buy Bar fixa do Figma mobile: quantidade, total, "Comprar NFT" e carrinho. */
function MobileBuyBar({ purchase, pending, onBuy, onAdd }: PurchaseActions) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] bg-card px-6 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.4)] md:hidden">
      <div className="flex items-center justify-between gap-4">
        <QuantityStepper
          value={purchase.quantity}
          onChange={purchase.setQuantity}
          max={purchase.maxQuantity}
          disabled={purchase.soldOut}
          size="sm"
          showLabel
        />
        <p>
          <span className="sr-only">Total: </span>
          <EthAmount value={purchase.totalEth} className="text-xl font-bold text-text-accent" />
        </p>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onBuy}
          disabled={purchase.soldOut || pending}
          className={cn(
            'h-[60px] flex-1 rounded-full bg-gradient-to-b from-[#e3a76f] to-brand text-base font-bold text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {purchase.soldOut ? 'Edição esgotada' : 'Comprar NFT'}
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={purchase.soldOut || pending}
          aria-label="Adicionar ao carrinho"
          className="inline-flex size-[60px] items-center justify-center rounded-full border border-border-soft bg-surface-dark/60 text-brand disabled:opacity-50"
        >
          <ShoppingCartIcon aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  )
}

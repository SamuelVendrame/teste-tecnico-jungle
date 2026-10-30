import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { useState } from 'react'

import type { Nft } from '@/api/contracts'
import { NftImage } from '@/components/common/NftImage'
import { nftAlt } from '@/components/common/nft-display'
import { cn } from '@/lib/utils'

import { scrollToCatalog } from '../scroll-to-catalog'

/**
 * Primeiro destaque, renderizado antes de a API responder: é a imagem de LCP da
 * home. Corresponde ao primeiro item de `featured.hero` da seed; se a seed mudar,
 * o carrossel só troca a imagem quando os dados chegam.
 */
const HERO_PLACEHOLDER = {
  src: '/images/nft-emerald-ape.webp',
  alt: 'Arte em destaque da Kurio',
}

interface HeroProps {
  slides: Nft[] | undefined
  loading: boolean
}

/** Pontos do carrossel: botões reais, com estado anunciado. */
function Dots({
  count,
  active,
  onSelect,
  className,
}: {
  count: number
  active: number
  onSelect: (index: number) => void
  className?: string
}) {
  if (count < 2) return null
  return (
    <div role="group" aria-label="Destaques" className={cn('flex items-center', className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Mostrar destaque ${i + 1} de ${count}`}
          aria-current={i === active ? 'true' : undefined}
          className="group flex size-6 items-center justify-center"
        >
          <span
            className={cn(
              'block size-[7px] rounded-full transition-colors',
              i === active ? 'bg-brand' : 'bg-brand/40 group-hover:bg-brand/70',
            )}
          />
        </button>
      ))}
    </div>
  )
}

/** Hero desktop/tablet do Figma (título, texto, EXPLORAR e arte em destaque). */
export function DesktopHero({ slides, loading }: HeroProps) {
  const [active, setActive] = useState(0)
  const current = slides?.[active] ?? slides?.[0]

  return (
    <section aria-labelledby="hero-title" className="hidden md:block">
      <div className="mt-8 grid min-h-[450px] grid-cols-[1fr_minmax(0,360px)] items-center gap-8 lg:grid-cols-[600px_450px] lg:justify-between lg:pl-10">
        <div className="relative flex h-full flex-col justify-center py-6">
          <p className="text-sm font-medium tracking-[0.06em] text-text-primary">
            Bem-vindo à Kurio
          </p>
          <h1
            id="hero-title"
            className="mt-2 text-2xl leading-10 font-bold tracking-[0.02em] text-text-primary uppercase lg:text-[43px] lg:leading-[70px]"
          >
            Seja dono do futuro
            <br /> da arte digital
          </h1>
          <p className="mt-1 max-w-[557px] text-sm leading-6 text-text-secondary">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital
            rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <button
            type="button"
            onClick={scrollToCatalog}
            className="mt-8 h-10 w-[140px] rounded-[4px] bg-brand text-[15px] font-bold tracking-[0.04em] text-ink transition-colors hover:bg-brand/90"
          >
            EXPLORAR
          </button>
          <Dots
            count={slides?.length ?? 0}
            active={active}
            onSelect={setActive}
            className="absolute right-0 bottom-6 lg:bottom-12"
          />
        </div>
        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] bg-card">
          {loading || !current ? (
            <NftImage
              src={HERO_PLACEHOLDER.src}
              alt={HERO_PLACEHOLDER.alt}
              width={450}
              height={450}
              priority
              sizes="(max-width: 1023px) 360px, 450px"
              className="size-full rounded-[24px] object-cover"
            />
          ) : (
            <Link
              to="/nft/$slug"
              params={{ slug: current.slug }}
              aria-label={`Ver ${current.name}`}
              className="block size-full rounded-[24px]"
            >
              <NftImage
                src={current.imageUrl}
                alt={nftAlt(current)}
                width={450}
                height={450}
                priority
                sizes="(max-width: 1023px) 360px, 450px"
                className="size-full object-cover"
              />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

/** Banner do hero mobile (366x190 no Figma) com duas artes sobrepostas. */
export function MobileHero({ slides, loading }: HeroProps) {
  const [active, setActive] = useState(0)
  const count = slides?.length ?? 0
  const main = slides?.[active]
  const secondary = count > 1 ? slides?.[(active + 1) % count] : undefined

  return (
    <section aria-labelledby="hero-title-mobile" className="md:hidden">
      <div className="relative mt-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#3a2417] via-[#2a1912] to-[#1d120d] px-4 pt-3 pb-2">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-8 -left-20 size-[248px] rounded-full bg-[#4a2c1b]/50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -top-3 left-[73px] size-[248px] rounded-full bg-[#4a2c1b]/35"
        />
        <div className="relative flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-xs font-medium text-text-primary">Bem-vindo à Kurio</p>
            <h1
              id="hero-title-mobile"
              className="mt-1.5 text-lg leading-[29px] font-bold text-text-primary uppercase"
            >
              Seja dono da cultura digital
            </h1>
            <p className="mt-1 text-[13px] leading-[18px] text-text-secondary">
              Descubra NFTs selecionados de criadores do mundo todo.
            </p>
            <button
              type="button"
              onClick={scrollToCatalog}
              className="mt-2 inline-flex w-fit items-center gap-2 text-xs font-bold tracking-[0.06em] text-text-accent"
            >
              EXPLORAR <ArrowRightIcon aria-hidden className="size-4" />
            </button>
          </div>
          <div className="relative mt-1 h-[146px] w-[138px] shrink-0">
            {loading || !main ? (
              <NftImage
                src={HERO_PLACEHOLDER.src}
                alt={HERO_PLACEHOLDER.alt}
                width={138}
                height={138}
                priority
                sizes="138px"
                className="size-[138px] rounded-[16px] object-cover"
              />
            ) : (
              <>
                <Link
                  to="/nft/$slug"
                  params={{ slug: main.slug }}
                  aria-label={`Ver ${main.name}`}
                  className="block size-[138px] overflow-hidden rounded-[16px]"
                >
                  <NftImage
                    src={main.imageUrl}
                    alt={nftAlt(main)}
                    width={138}
                    height={138}
                    priority
                    sizes="138px"
                    className="size-full object-cover"
                  />
                </Link>
                {secondary && (
                  <NftImage
                    src={secondary.imageUrl}
                    alt=""
                    width={58}
                    height={58}
                    sizes="58px"
                    className="pointer-events-none absolute top-[88px] left-[14px] size-[58px] rounded-[12px] border-2 border-[#2a1912] object-cover"
                  />
                )}
              </>
            )}
          </div>
        </div>
        <Dots
          count={count}
          active={active}
          onSelect={setActive}
          className="relative justify-center"
        />
      </div>
    </section>
  )
}

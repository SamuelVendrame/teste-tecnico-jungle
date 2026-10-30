import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'

import { scrollToCatalog } from '../scroll-to-catalog'

/**
 * Dois cards promocionais do Figma. O CTA "Explorar" aplica um recorte real do
 * catálogo (novos lançamentos / arte digital) e rola até ele.
 */
export function PromoCards() {
  return (
    <section aria-label="Destaques do mercado" className="mt-24 grid gap-6 lg:grid-cols-2 lg:gap-7">
      <PromoCard
        title="Lançamentos gênesis de edição limitada"
        text="Colecione edições escassas diretamente dos criadores antes da revelação pública."
        image="/images/nft-emerald-ape-400.webp"
        link={{ search: { tab: 'new' } }}
      />
      <PromoCard
        title="Arte digital selecionada e muito mais"
        text="Explore novos artistas, coleções verificadas e obras digitais que definem a cultura."
        image="/images/nft-neon-vessel-400.webp"
        link={{ search: { collection: ['arte-digital'] } }}
      />
    </section>
  )
}

function PromoCard({
  title,
  text,
  image,
  link,
}: {
  title: string
  text: string
  image: string
  link: { search: { tab?: 'new'; collection?: ['arte-digital'] } }
}) {
  return (
    <article className="relative grid min-h-[250px] grid-cols-[minmax(0,49%)_1fr] overflow-hidden rounded-[8px] bg-card">
      <img
        src={image}
        alt=""
        width={292}
        height={250}
        loading="lazy"
        decoding="async"
        className="h-full w-full rounded-[16px] object-cover"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[110px] -left-[190px] size-[256px] rounded-full border border-brand/70"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[124px] -left-[199px] size-[256px] rounded-full border border-brand/40"
      />
      <div className="flex flex-col items-end justify-center gap-3 px-4 py-6 text-right sm:px-7">
        <h3 className="max-w-[260px] text-base leading-6 font-bold text-text-primary sm:text-lg">
          {title}
        </h3>
        <p className="max-w-[263px] text-xs leading-[22px] text-text-secondary sm:text-sm sm:leading-6">
          {text}
        </p>
        <Link
          to="/"
          search={link.search}
          resetScroll={false}
          onClick={() => requestAnimationFrame(scrollToCatalog)}
          className="mt-1 inline-flex h-10 w-[140px] items-center justify-center gap-1 rounded-[4px] bg-brand text-[15px] font-medium text-ink transition-colors hover:bg-brand/90"
        >
          Explorar <ArrowRightIcon aria-hidden className="size-[18px]" />
          <span className="sr-only">: {title}</span>
        </Link>
      </div>
    </article>
  )
}

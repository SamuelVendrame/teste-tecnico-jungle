import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { announce } from '@/components/common/announce'
import { Container } from '@/components/layout/Container'

import { BlogSection } from './components/BlogSection'
import { CatalogSection } from './components/CatalogSection'
import { DesktopHero, MobileHero } from './components/HeroCarousel'
import { MobileSearchBar } from './components/MobileSearchBar'
import { PromoCards } from './components/PromoCards'
import { catalogListOptions, featuredOptions } from './queries'
import { useCatalogSearch } from './use-catalog-search'

/**
 * Página inicial: destaques + catálogo. O estado do catálogo vive na URL; a
 * consulta usa `keepPreviousData` para manter os cards anteriores (esmaecidos,
 * com "Atualizando…") enquanto a nova combinação carrega.
 */
export function HomePage() {
  const catalog = useCatalogSearch()
  const list = useQuery({
    ...catalogListOptions(catalog.search),
    placeholderData: keepPreviousData,
  })
  const featured = useQuery(featuredOptions())

  useEffect(() => {
    document.title = 'Kurio · Marketplace de NFTs'
  }, [])

  // Anuncia o resultado quando a consulta da combinação atual termina.
  const total = list.isPlaceholderData ? undefined : list.data?.total
  useEffect(() => {
    if (total === undefined) return
    announce(
      total === 0
        ? 'Nenhum NFT encontrado'
        : `${total} ${total === 1 ? 'resultado encontrado' : 'resultados encontrados'}`,
    )
  }, [total, list.dataUpdatedAt])

  return (
    <Container className="pt-10 md:pt-0">
      <MobileSearchBar {...catalog} facets={list.data?.facets} total={list.data?.total} />
      <MobileHero slides={featured.data?.hero} loading={featured.isLoading} />
      <DesktopHero slides={featured.data?.hero} loading={featured.isLoading} />
      <CatalogSection
        {...catalog}
        query={list}
        spotlight={featured.data?.spotlight}
        spotlightLoading={featured.isLoading}
      />
      <PromoCards />
      <BlogSection />
    </Container>
  )
}

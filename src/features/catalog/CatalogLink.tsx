import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import type { ComponentProps, MouseEvent } from 'react'

import { CATALOG_SECTION_ID, scrollToCatalog } from './scroll-to-catalog'

type Props = Omit<ComponentProps<typeof Link>, 'to' | 'hash' | 'search' | 'onClick'>

/**
 * Link "Mercado": o catálogo da página inicial (`/#catalogo`) com filtros e página zerados.
 *
 * Fora da home, é um link comum e o router rola até o hash ao chegar. Na home, o router
 * não rola de novo quando a URL já é a mesma (e restaura a posição salva, que pode ser o
 * topo), então o clique rola até o catálogo por conta própria.
 */
export function CatalogLink(props: Props) {
  const navigate = useNavigate()
  const location = useRouterState({ select: (state) => state.location })

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (location.pathname !== '/') return
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    const hash = location.hash.replace(/^#/, '')
    const atCatalog = hash === CATALOG_SECTION_ID && Object.keys(location.search).length === 0
    if (atCatalog) {
      scrollToCatalog()
      return
    }
    void navigate({ to: '/', search: {}, hash: CATALOG_SECTION_ID }).then(() =>
      requestAnimationFrame(scrollToCatalog),
    )
  }

  return <Link to="/" hash={CATALOG_SECTION_ID} onClick={onClick} {...props} />
}

import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { CATALOG_DEFAULTS, catalogSearchSchema } from '@/features/catalog/catalog-search'
import { HomePage } from '@/features/catalog/HomePage'
import { catalogListOptions, featuredOptions } from '@/features/catalog/queries'

export const Route = createFileRoute('/')({
  // Busca, filtros, ordenação, aba e página vivem na URL (refresh e histórico
  // restauram o estado). Valores padrão ficam fora da URL.
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams(CATALOG_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps, cause }) => {
    const work = Promise.allSettled([
      queryClient.ensureQueryData(catalogListOptions(deps)),
      queryClient.ensureQueryData(featuredOptions()),
    ])
    // Preload (hover/foco em um link para "/"): espera o cache encher para que
    // a navegação seguinte seja instantânea. Na entrada e nas mudanças de
    // filtro a página renderiza na hora; erros e carregamento ficam com o
    // useQuery da página (skeleton, keepPreviousData, "Tentar novamente").
    if (cause === 'preload') return work.then(() => undefined)
    return undefined
  },
  component: HomePage,
})

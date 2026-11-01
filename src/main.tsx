import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { MOCKS_ENABLED, markMocksFailed, markMocksReady } from '@/app/mocks-ready'
import { queryClient } from '@/app/query-client'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

/**
 * Os mocks (MSW + Socket.IO simulado) ficam ligados por padrão, inclusive no
 * build de demonstração; só `VITE_ENABLE_MSW=false` os desliga. O worker sobe em
 * paralelo com a primeira renderização: a UI pinta com skeletons e as
 * requisições esperam `mocksReady` (ver src/app/mocks-ready.ts).
 */
if (MOCKS_ENABLED) {
  import('@/mocks/browser')
    .then(({ startMocks }) => startMocks())
    .then(markMocksReady)
    .catch((error: unknown) => {
      // Worker não registrado ou não interceptando esta aba: o Axios passa a recusar as
      // requisições com motivo e o shell mostra o aviso (MocksUnavailableBanner).
      console.error('[mocks] a API simulada não está ativa nesta aba', error)
      markMocksFailed(error instanceof Error ? error.message : String(error))
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

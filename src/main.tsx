import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import { MOCKS_ENABLED, markMocksReady } from '@/app/mocks-ready'
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
    .catch((error: unknown) => console.error('[mocks] falha ao iniciar o MSW', error))
    .finally(markMocksReady)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

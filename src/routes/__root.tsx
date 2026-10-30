import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'

import { Toaster } from '@/components/ui/sonner'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="bottom-right" />
    </>
  )
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-text-secondary">O endereço que você acessou não existe.</p>
      <a href="/" className="text-text-accent underline underline-offset-4">
        Voltar ao início
      </a>
    </main>
  )
}

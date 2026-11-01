import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'

import { LiveRegion } from '@/components/common/LiveRegion'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { MocksUnavailableBanner } from '@/components/layout/MocksUnavailableBanner'
import { RouteError, RouteNotFound } from '@/components/layout/RouteStates'
import { MAIN_CONTENT_ID, SkipLink } from '@/components/layout/SkipLink'
import { TAB_BAR_SPACER, useTabBarVisible } from '@/components/layout/tab-bar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DevPanel } from '@/features/dev-panel/DevPanel'
import { SessionLifecycle } from '@/features/session/session-lifecycle'
import { useRealtime } from '@/realtime/use-realtime'
import { cn } from '@/lib/utils'

export interface RouterContext {
  queryClient: QueryClient
}

/** Toasts na fonte e na cor da marca (o Sonner usa fonte própria por padrão). */
const TOAST_OPTIONS = {
  style: { fontFamily: "'Roboto Mono', ui-monospace, monospace" },
  actionButtonStyle: { background: 'var(--kurio-primary)', color: 'var(--kurio-ink)' },
}

const AUTH_ROUTE = /^\/(login|register)(\/|$)/

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: RouteNotFound,
  errorComponent: RouteError,
})

/**
 * Shell: header (>= 768px), conteúdo, footer e Tab Bar (< 768px).
 * As páginas renderizam dentro de <main>; não declare outro <main> nelas.
 */
function RootLayout() {
  const tabBarVisible = useTabBarVisible()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // Login e cadastro ocupam a tela inteira no mobile (Figma): sem footer nem newsletter.
  const authRoute = AUTH_ROUTE.test(pathname)
  // Socket.IO (eventos nft.updated / order.updated) vive no ciclo de vida do shell.
  useRealtime()
  return (
    <TooltipProvider delayDuration={200}>
      <SkipLink />
      <div className={cn('flex min-h-dvh flex-col', tabBarVisible && TAB_BAR_SPACER)}>
        <MocksUnavailableBanner />
        <Header />
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
        <Footer className={cn(authRoute && 'hidden md:block')} />
      </div>
      <MobileTabBar />
      <SessionLifecycle />
      <DevPanel />
      <LiveRegion />
      <Toaster position="bottom-right" toastOptions={TOAST_OPTIONS} />
    </TooltipProvider>
  )
}

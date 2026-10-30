import { Suspense, lazy } from 'react'

const DevPanelContent = lazy(() => import('./DevPanelContent'))

/**
 * Painel de cenários do build de demonstração. Só existe quando a camada de mocks está ativa;
 * o conteúdo é carregado sob demanda para não pesar no bundle principal.
 */
export function DevPanel() {
  if (import.meta.env.VITE_ENABLE_MSW !== 'true') return null
  return (
    <Suspense fallback={null}>
      <DevPanelContent />
    </Suspense>
  )
}

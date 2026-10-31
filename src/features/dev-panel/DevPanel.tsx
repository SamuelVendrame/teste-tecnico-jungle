import { Suspense, lazy, useEffect, useState } from 'react'

const DevPanelContent = lazy(() => import('./DevPanelContent'))

/** Resolve depois do `load` da página, no primeiro momento ocioso. */
function afterPageLoad(callback: () => void): () => void {
  let cancelled = false
  const run = () => {
    if (!cancelled) callback()
  }
  const idle = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 })
    else setTimeout(run, 200)
  }
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
  return () => {
    cancelled = true
    window.removeEventListener('load', idle)
  }
}

/**
 * Painel de cenários do build de demonstração. Só existe quando a camada de mocks está ativa;
 * o conteúdo é carregado sob demanda, depois que a página terminou de carregar, para não
 * pesar no bundle principal nem disputar a rede com o conteúdo da primeira tela.
 */
export function DevPanel() {
  const enabled = import.meta.env.VITE_ENABLE_MSW !== 'false'
  const [ready, setReady] = useState(false)
  useEffect(() => (enabled ? afterPageLoad(() => setReady(true)) : undefined), [enabled])
  if (!enabled || !ready) return null
  return (
    <Suspense fallback={null}>
      <DevPanelContent />
    </Suspense>
  )
}

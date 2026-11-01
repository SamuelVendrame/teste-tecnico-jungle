import { useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

/** Tentativas depois da navegação: as seções abaixo carregam dados e mudam de altura. */
const RETRY_AT_MS = [50, 400, 1000]

/**
 * Rola até a seção do hash (`/profile#pedidos`, `/profile#favoritos`) depois que a página
 * monta. O router rola ao chegar, mas o skeleton das seções ainda não tem a altura final e
 * a restauração de rolagem pode trazer a página de volta ao topo; por isso a rolagem é
 * refeita algumas vezes, até o usuário rolar por conta própria.
 */
export function useScrollToSection() {
  const hash = useRouterState({ select: (state) => state.location.hash })

  useEffect(() => {
    if (!hash) return
    let cancelled = false
    const cancel = () => {
      cancelled = true
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scroll = () => {
      if (cancelled) return
      document
        .getElementById(hash)
        ?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
    }
    const timers = RETRY_AT_MS.map((ms) => setTimeout(scroll, ms))
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchmove', cancel, { passive: true })
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchmove', cancel)
    }
  }, [hash])
}

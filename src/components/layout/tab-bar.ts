import { useRouterState } from '@tanstack/react-router'

/** Rotas com barra de ação própria (detalhe) ou fluxo focado (auth, checkout). */
const HIDDEN_ON = [/^\/nft\//, /^\/login/, /^\/register/, /^\/checkout/]

export function useTabBarVisible(): boolean {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return !HIDDEN_ON.some((pattern) => pattern.test(pathname))
}

/** Altura reservada no fim da página para a Tab Bar fixa (mobile). */
export const TAB_BAR_SPACER = 'pb-[126px] md:pb-0'

import { useQuery } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { authApi } from '@/api/endpoints'
import { queryKeys } from '@/lib/query-keys'

import { SessionExpiredDialog } from './SessionExpiredDialog'
import { sessionStore, useSession } from './session-store'

/** Rotas que exigem sessão: ao expirar, o usuário vai direto para /login com `returnTo`. */
const PRIVATE_PATH_PREFIXES = ['/checkout', '/profile', '/wallets', '/orders', '/favorites']
const AUTH_PATHS = ['/login', '/register']

function isPrivatePath(pathname: string) {
  return PRIVATE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Mantém a sessão coerente durante a navegação:
 * - valida o token persistido com GET /auth/session ao iniciar;
 * - ao expirar (401 vira `status === 'expired'` no interceptor) leva a rota privada para /login
 *   guardando o destino, ou mostra o diálogo em páginas públicas.
 */
export function SessionLifecycle() {
  const { status } = useSession()
  const router = useRouter()
  const { pathname, href } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, href: s.location.href }),
  })

  const current = useQuery({
    queryKey: queryKeys.session.current(),
    queryFn: ({ signal }) => authApi.session({ signal }),
    enabled: status === 'authenticated',
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const fresh = current.data?.user
  useEffect(() => {
    if (!fresh) return
    const known = sessionStore.getState().user
    // Não sobrescreve um usuário mais novo (ex.: perfil editado nesta aba).
    if (!known || known.id !== fresh.id || fresh.version > known.version) {
      sessionStore.updateUser(fresh)
    }
  }, [fresh])

  const onPrivateRoute = isPrivatePath(pathname)
  const onAuthPage = AUTH_PATHS.includes(pathname)

  useEffect(() => {
    if (status !== 'expired' || !onPrivateRoute) return
    sessionStore.setReturnTo(href)
    toast.info('Sua sessão expirou. Entre para continuar de onde parou.')
    void router.navigate({ to: '/login', search: { returnTo: href }, replace: true })
  }, [status, onPrivateRoute, href, router])

  return <SessionExpiredDialog open={status === 'expired' && !onPrivateRoute && !onAuthPage} />
}

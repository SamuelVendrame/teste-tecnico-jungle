const AUTH_PATHS = ['/login', '/register']

/**
 * Valida um `returnTo` vindo de URL/estado. Só aceita caminhos da mesma origem
 * (evita open redirect) e nunca devolve rotas de autenticação (evita laço).
 */
export function resolveReturnTo(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return '/'
  if (candidate.includes('\\')) return '/'
  try {
    const url = new URL(candidate, window.location.origin)
    if (url.origin !== window.location.origin) return '/'
    if (AUTH_PATHS.includes(url.pathname)) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}

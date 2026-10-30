import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'

import { ErrorState } from '@/components/common/ErrorState'

import { Container } from './Container'

/** Rota inexistente (notFoundComponent da raiz). */
export function RouteNotFound() {
  return (
    <section className="mx-auto flex min-h-[60dvh] max-w-7xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-text-secondary">O endereço que você acessou não existe.</p>
      <Link to="/" className="text-text-accent underline underline-offset-4">
        Voltar ao início
      </Link>
    </section>
  )
}

/** Erro de rota com "Tentar novamente" (reexecuta loaders e queries). */
export function RouteError({
  reset,
  title = 'Não foi possível abrir esta página',
}: {
  reset: () => void
  title?: string
}) {
  const router = useRouter()
  const queryReset = useQueryErrorResetBoundary()
  return (
    <Container className="py-16">
      <ErrorState
        title={title}
        onRetry={() => {
          queryReset.reset()
          reset()
          void router.invalidate()
        }}
      />
    </Container>
  )
}

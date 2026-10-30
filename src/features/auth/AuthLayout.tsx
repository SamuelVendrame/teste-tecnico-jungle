import { Link } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { SocialButtons } from './SocialButtons'

type Mode = 'login' | 'register'

interface Props {
  mode: Mode
  returnTo?: string
  children: ReactNode
}

const COPY: Record<Mode, { mobileTitle: string; description: string }> = {
  login: {
    mobileTitle: 'Entrar',
    description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
  },
  register: {
    mobileTitle: 'Criar perfil de colecionador',
    description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
  },
}

/** Fundo estático que imita o conteúdo do marketplace atrás do modal (apenas desktop). O header e o footer reais vêm do shell. */
function MarketplaceBackdrop() {
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none absolute inset-0 hidden overflow-hidden bg-ink md:block"
    >
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_20%,#38220f_0%,transparent_70%),radial-gradient(40%_40%_at_10%_80%,#2a1810_0%,transparent_70%)]" />
      <div className="relative mx-auto mt-16 grid max-w-[1200px] grid-cols-[1fr_450px] gap-10">
        <div className="pt-16">
          <p className="text-xs text-text-primary">Bem-vindo à Kurio</p>
          <p className="mt-4 text-[43px] leading-[70px] font-bold text-text-primary">
            SEJA DONO DO FUTURO DA ARTE DIGITAL
          </p>
        </div>
        <div className="h-[450px] rounded-xl bg-gradient-to-br from-[#d9d3b6] to-[#5a3a22]" />
      </div>
      <div className="relative mx-auto mt-16 grid max-w-[1200px] grid-cols-3 gap-6 px-[360px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[300px] rounded-md bg-surface-card" />
        ))}
      </div>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
    </div>
  )
}

/**
 * Estrutura compartilhada de /login e /register: modal centrado sobre o marketplace desfocado
 * em telas >= md, página inteira nas telas menores.
 */
export function AuthLayout({ mode, returnTo, children }: Props) {
  const copy = COPY[mode]
  const switchTarget = mode === 'login' ? '/register' : '/login'

  return (
    <div className="relative min-h-[calc(100dvh-68px)] bg-background">
      <MarketplaceBackdrop />
      <div className="relative flex min-h-[calc(100dvh-68px)] flex-col md:items-center md:justify-center md:p-6">
        <section
          aria-labelledby="auth-title"
          className={cn(
            'relative mx-auto flex w-full max-w-[414px] flex-1 flex-col px-7 pt-[110px] pb-10',
            'md:max-w-[500px] md:flex-none md:border-b-[10px] md:border-brand md:bg-surface-card md:px-[80px] md:pt-[44px] md:pb-12 md:shadow-2xl',
          )}
        >
          <Link
            to="/"
            aria-label="Fechar e voltar ao início"
            className="absolute top-4 right-4 hidden rounded-xs p-1 text-brand hover:text-text-accent md:block"
          >
            <XIcon className="size-5" />
          </Link>

          <Link
            to="/"
            className="text-center text-[32px] leading-none font-bold tracking-[0.15em] text-text-primary md:hidden"
          >
            KURIO
          </Link>

          <h1
            id="auth-title"
            className="mt-24 text-center text-lg font-bold text-text-primary md:sr-only"
          >
            {copy.mobileTitle}
          </h1>

          <nav
            aria-label="Entrar ou criar conta"
            className="hidden items-center justify-center gap-3 text-lg font-bold md:flex"
          >
            <Link
              to="/login"
              search={{ returnTo }}
              aria-current={mode === 'login' ? 'page' : undefined}
              className={mode === 'login' ? 'text-text-accent' : 'text-text-primary'}
            >
              Entrar
            </Link>
            <span aria-hidden="true" className="h-5 w-px bg-brand" />
            <Link
              to="/register"
              search={{ returnTo }}
              aria-current={mode === 'register' ? 'page' : undefined}
              className={mode === 'register' ? 'text-text-accent' : 'text-text-primary'}
            >
              Criar conta
            </Link>
          </nav>

          <p className="mt-9 hidden text-center text-xs leading-4 text-text-primary md:-mx-[30px] md:block">
            {copy.description}
          </p>

          <div className="mt-8 md:mt-6">{children}</div>

          <div className="mt-8 md:mt-6">
            <SocialButtons />
          </div>

          <p className="mt-10 text-center text-sm text-text-secondary md:hidden">
            {mode === 'login' ? 'Novo na Kurio? ' : 'Já tem uma conta? '}
            <Link
              to={switchTarget}
              search={{ returnTo }}
              className="underline underline-offset-4 hover:text-text-primary"
            >
              {mode === 'login' ? 'Crie uma conta' : 'Entre'}
            </Link>
          </p>
        </section>
      </div>
    </div>
  )
}

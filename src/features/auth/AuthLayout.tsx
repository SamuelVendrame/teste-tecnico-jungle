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

const BACKDROP_CARDS = [
  'nft-golden-beat',
  'nft-neon-vessel',
  'nft-emerald-ape',
  'nft-sage-nomad',
  'nft-golden-beat',
  'nft-neon-vessel',
] as const

/**
 * Fundo estático que imita o marketplace atrás do modal (apenas desktop), como no Figma:
 * visível sob um véu leve, sem desfoque. O fim esmaece no fundo da página para não criar
 * emenda com o footer real, que vem do shell junto com o header.
 */
function MarketplaceBackdrop() {
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
    >
      <div className="mx-auto w-full max-w-[1232px] px-6 [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] xl:px-4">
        <div className="grid grid-cols-[1fr_minmax(0,450px)] gap-10 pt-3">
          <div className="pt-[66px] pl-12">
            <p className="text-sm tracking-[0.08em] text-text-primary">Bem-vindo à Kurio</p>
            <p className="mt-4 text-[43px] leading-[70px] font-bold tracking-[0.04em] whitespace-nowrap text-text-primary">
              SEJA DONO DO FUTURO
              <br />
              DA ARTE DIGITAL
            </p>
            <span className="mt-12 inline-flex h-10 w-[140px] items-center justify-center rounded-[4px] bg-brand text-[15px] font-bold text-ink">
              EXPLORAR
            </span>
          </div>
          <img
            src="/images/nft-emerald-ape.webp"
            alt=""
            className="aspect-square w-full rounded-[18px] object-cover"
          />
        </div>
        <div className="mt-12 grid grid-cols-[310px_1fr] gap-12">
          <div className="h-[780px] rounded-[4px] bg-surface-card" />
          <div className="grid grid-cols-3 gap-x-8 gap-y-14">
            {BACKDROP_CARDS.map((image, index) => (
              <div key={index} className="rounded-[4px] bg-surface-card p-4">
                <img
                  src={`/images/${image}-400.webp`}
                  alt=""
                  className="aspect-square w-full rounded-[14px] object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-black/25 from-60% to-transparent" />
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
    <div className="relative min-h-dvh bg-background md:min-h-[1240px]">
      <MarketplaceBackdrop />
      <div className="relative flex min-h-dvh flex-col md:min-h-0 md:items-center md:px-6 md:pt-[92px] md:pb-24">
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

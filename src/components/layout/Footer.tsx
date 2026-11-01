import { Link } from '@tanstack/react-router'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { COLLECTION_LABELS, type CollectionId } from '@/api/contracts'
import { ComingSoonLink } from '@/components/common/ComingSoonLink'
import { cn } from '@/lib/utils'

import { Container } from './Container'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from './SocialIcons'

const FEATURES = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
] as const

const FOOTER_COLLECTIONS: CollectionId[] = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'utilidade',
]

const SOCIAL = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'Twitter', Icon: TwitterIcon },
  { label: 'LinkedIn', Icon: LinkedinIcon },
  { label: 'YouTube', Icon: YoutubeIcon },
] as const

const linkClass =
  'text-sm leading-[30px] text-text-primary transition-colors hover:text-text-accent'

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn('mt-16 md:mt-24', className)}>
      <Container>
        <div className="overflow-hidden rounded-[4px] bg-card">
          {/* Destaques + newsletter */}
          <div className="grid gap-8 px-6 pt-8 pb-6 md:grid-cols-2 md:px-8 lg:grid-cols-[1fr_1fr_1.05fr_1.2fr] lg:gap-0 lg:pr-6 lg:pl-10">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.letter}
                className={cn(
                  'hidden md:block lg:px-4',
                  index > 0 && 'lg:border-l lg:border-brand',
                  index === 0 && 'lg:pl-0',
                )}
              >
                <span
                  aria-hidden
                  className="flex size-[74px] items-center justify-center rounded-full bg-brand text-2xl font-bold text-ink"
                >
                  {feature.letter}
                </span>
                <h2 className="mt-5 text-lg font-bold text-text-primary">{feature.title}</h2>
                <p className="mt-2 max-w-[220px] text-sm leading-[22px] text-text-secondary">
                  {feature.text}
                </p>
              </div>
            ))}
            <Newsletter />
          </div>

          {/* Faixa de contato */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 bg-surface-dark px-6 py-6 text-sm text-text-primary min-[360px]:grid-cols-2 md:px-8 lg:grid-cols-4 lg:py-7">
            <p className="font-bold tracking-[0.12em]">KURIO</p>
            <p className="max-w-[230px] leading-[22px]">
              Feito para colecionadores, criadores e cultura
            </p>
            <a href="mailto:contato@email.com" className="hover:text-text-accent">
              contato@email.com
            </a>
            <a href="tel:+551140028922" className="hover:text-text-accent">
              +55 11 4002 8922
            </a>
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 px-6 py-8 min-[360px]:grid-cols-2 md:px-8 lg:grid-cols-4">
            <nav aria-labelledby="footer-perfil">
              <h2 id="footer-perfil" className="mb-2 text-lg font-bold text-text-primary">
                Meu perfil
              </h2>
              <ul>
                <li>
                  <Link to="/profile" className={linkClass}>
                    Meu perfil
                  </Link>
                </li>
                {['Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'].map(
                  (label) => (
                    <li key={label}>
                      <ComingSoonLink className={linkClass}>{label}</ComingSoonLink>
                    </li>
                  ),
                )}
              </ul>
            </nav>
            <nav aria-labelledby="footer-ajuda">
              <h2 id="footer-ajuda" className="mb-2 text-lg font-bold text-text-primary">
                Central de ajuda
              </h2>
              <ul>
                {[
                  'Central de ajuda',
                  'Como comprar NFTs',
                  'Carteira e segurança',
                  'Política do mercado',
                  'Denunciar item',
                ].map((label) => (
                  <li key={label}>
                    <ComingSoonLink className={linkClass}>{label}</ComingSoonLink>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-labelledby="footer-colecoes">
              <h2 id="footer-colecoes" className="mb-2 text-lg font-bold text-text-primary">
                Coleções
              </h2>
              <ul>
                {FOOTER_COLLECTIONS.map((id) => (
                  <li key={id}>
                    <Link to="/" search={{ collection: [id] }} className={linkClass}>
                      {COLLECTION_LABELS[id]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <h2 className="mb-3 text-lg font-bold text-text-primary">Redes sociais</h2>
              <ul className="flex flex-wrap gap-2">
                {SOCIAL.map(({ label, Icon }) => (
                  <li key={label}>
                    <ComingSoonLink
                      label={label}
                      className="flex size-8 items-center justify-center rounded-[4px] border border-brand text-brand transition-colors hover:bg-brand/10"
                    >
                      <Icon className="size-[18px]" />
                    </ComingSoonLink>
                  </li>
                ))}
              </ul>
              <h2 className="mt-7 mb-3 text-lg font-bold text-text-primary">
                Carteiras compatíveis
              </h2>
              <p className="inline-flex flex-wrap items-center gap-x-2 rounded-[4px] border border-border-soft bg-surface-dark px-2.5 py-1.5 text-[9px] font-bold tracking-[0.1em] text-text-accent">
                <span>METAMASK</span>
                <span aria-hidden>•</span>
                <span>WALLETCONNECT</span>
                <span aria-hidden>•</span>
                <span>COINBASE</span>
              </p>
            </div>
          </div>
        </div>
        <p className="py-4 text-center text-sm text-text-primary">
          © 2026 Kurio. Propriedade digital para todos.
        </p>
      </Container>
    </footer>
  )
}

const emailSchema = z.string().trim().email()

/**
 * Newsletter demonstrativa: valida o e-mail e confirma no toast que nada foi
 * cadastrado (não existe endpoint de newsletter no contrato).
 */
function Newsletter() {
  const inputId = useId()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!emailSchema.safeParse(email).success) {
      setError(email.trim() ? 'Informe um e-mail válido.' : 'Informe seu e-mail.')
      return
    }
    setError(null)
    setEmail('')
    toast.success('E-mail válido!', {
      description:
        'A newsletter ainda não está disponível nesta demonstração: nenhum cadastro foi feito.',
    })
  }

  return (
    <div className="min-w-0 md:col-span-2 lg:col-span-1 lg:border-l lg:border-brand lg:pl-4">
      <h2 className="text-lg leading-4 font-bold text-text-primary">
        Antecipe-se ao próximo lançamento
      </h2>
      <form noValidate onSubmit={handleSubmit} className="mt-4">
        <label htmlFor={inputId} className="sr-only">
          Seu e-mail
        </label>
        <div className="flex h-10 overflow-hidden rounded-[4px]">
          <input
            id={inputId}
            type="email"
            inputMode="email"
            autoComplete="email"
            size={1}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (error) setError(null)
            }}
            placeholder="digite seu e-mail..."
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-w-0 flex-1 bg-surface-dark px-3 text-sm text-text-primary placeholder:text-text-secondary/80 focus-visible:outline-offset-[-2px]"
          />
          <button
            type="submit"
            className="bg-brand px-3 text-lg font-bold text-ink transition-colors hover:bg-brand/90 focus-visible:outline-offset-[-2px]"
          >
            Enviar
          </button>
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-2 text-xs text-[#ff8a80]">
            {error}
          </p>
        )}
      </form>
      <p className="mt-4 text-[13px] leading-[22px] text-text-secondary">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </div>
  )
}

import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogInIcon, ShoppingCartIcon } from 'lucide-react'
import { toast } from 'sonner'

import { ComingSoonLink } from '@/components/common/ComingSoonLink'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cartItemCount, useCart } from '@/features/cart/use-cart'
import { useSession } from '@/features/session/session-store'
import { useLogout } from '@/features/session/use-auth'
import { cn } from '@/lib/utils'

import { Container } from './Container'
import { HeaderSearch } from './HeaderSearch'

const navItem =
  'relative flex h-full items-center px-1 text-sm font-normal lg:text-[15px] text-text-primary transition-colors hover:text-text-accent'

const navActive =
  'text-text-accent after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-full after:bg-brand'

type NavSection = 'inicio' | 'mercado' | null

/** Item ativo do menu como no Figma: auth fica em Início; o fluxo de compra, em Mercado. */
function activeSection(pathname: string): NavSection {
  if (pathname === '/' || /^\/(login|register)(\/|$)/.test(pathname)) return 'inicio'
  if (/^\/(nft|cart|checkout|orders)(\/|$)/.test(pathname)) return 'mercado'
  return null
}

/** Header desktop/tablet (>= 768px). No mobile a navegação fica na Tab Bar. */
export function Header() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const active = activeSection(pathname)
  return (
    <header className="hidden md:block">
      <Container className="pt-6">
        <div className="relative flex h-[45px] items-center justify-between border-b border-border">
          <Link
            to="/"
            aria-label="Kurio, página inicial"
            className="text-sm font-bold tracking-[0.12em] text-text-primary"
          >
            KURIO
          </Link>

          <nav
            aria-label="Principal"
            className="flex h-full flex-1 justify-center lg:absolute lg:top-0 lg:left-1/2 lg:-translate-x-1/2"
          >
            <ul className="flex h-full items-stretch gap-3 lg:gap-8">
              <li className="h-full">
                <Link
                  to="/"
                  className={cn(navItem, active === 'inicio' && navActive)}
                  aria-current={active === 'inicio' ? 'page' : undefined}
                >
                  Início
                </Link>
              </li>
              <li className="h-full">
                <Link
                  to="/"
                  hash="catalogo"
                  className={cn(navItem, active === 'mercado' && navActive)}
                  aria-current={active === 'mercado' ? 'page' : undefined}
                >
                  Mercado
                </Link>
              </li>
              {['Criadores', 'Aprenda'].map((label) => (
                <li key={label} className="h-full">
                  <ComingSoonLink className={cn(navItem, 'hover:text-text-primary/80')}>
                    {label}
                  </ComingSoonLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2 lg:gap-5">
            <HeaderSearch />
            <CartLink />
            <AccountArea />
          </div>
        </div>
      </Container>
    </header>
  )
}

function CartLink() {
  const { data } = useCart()
  const count = cartItemCount(data)
  return (
    <Link
      to="/cart"
      aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'}
      className="relative inline-flex size-9 items-center justify-center rounded-full text-text-primary transition-colors hover:text-text-accent"
    >
      <ShoppingCartIcon aria-hidden className="size-5" />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] leading-none font-bold text-ink"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function AccountArea() {
  const session = useSession()
  const href = useRouterState({ select: (state) => state.location.href })

  if (session.status !== 'authenticated' || !session.user) {
    return (
      <Link
        to="/login"
        search={{ returnTo: href }}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-[4px] bg-brand px-2.5 text-[15px] font-medium text-ink transition-colors hover:bg-brand/90"
      >
        <LogInIcon aria-hidden className="size-[18px]" />
        Entrar
      </Link>
    )
  }

  return <UserMenu name={session.user.name} avatarUrl={session.user.avatarUrl} />
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

function UserMenu({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const logout = useLogout()
  const navigate = useNavigate()

  function handleLogout() {
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success('Você saiu da sua conta')
        void navigate({ to: '/' })
      },
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu da conta de ${name}`}
        className="rounded-full ring-offset-2 ring-offset-background"
      >
        <Avatar className="size-[34px] border border-brand">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback className="bg-surface-dark text-xs font-bold text-text-accent">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-border-soft bg-card">
        <DropdownMenuLabel className="truncate text-text-secondary">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">Perfil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/wallets">Carteiras</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" hash="pedidos">
            Pedidos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} disabled={logout.isPending}>
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

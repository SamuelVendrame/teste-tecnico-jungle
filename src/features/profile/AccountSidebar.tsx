import { Link } from '@tanstack/react-router'
import {
  DownloadIcon,
  HeartIcon,
  LogOutIcon,
  MapPinIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UserIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { ComingSoonLink } from '@/components/common/ComingSoonLink'
import { useLogout } from '@/features/session/use-auth'
import { cn } from '@/lib/utils'

type SidebarItem = 'profile' | 'wallets'

const itemClass =
  'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 border-b-[3px] border-transparent px-2 py-2 text-center text-xs leading-tight text-text-accent transition-colors hover:bg-surface-dark/60 lg:h-[45px] lg:min-h-0 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:border-b-0 lg:border-l-[6px] lg:px-4 lg:text-left lg:text-sm'
const activeClass = 'border-brand font-bold text-text-primary lg:bg-surface-dark/40'

/** Itens do Figma fora do escopo da entrega: visíveis só no desktop, como "em breve". */
const COMING_SOON: Array<{ label: string; icon: ReactNode }> = [
  { label: 'Atividade', icon: <ShoppingCartIcon /> },
  { label: 'Lista de interesse', icon: <HeartIcon /> },
  { label: 'Ofertas', icon: <TrendingUpIcon /> },
  { label: 'Arquivos baixados', icon: <DownloadIcon /> },
  { label: 'Suporte', icon: <TriangleAlertIcon /> },
]

/**
 * Navegação da conta (Figma "Account Sidebar", 310px). Abaixo de `lg` vira uma
 * barra horizontal só com as seções existentes e "Sair".
 */
export function AccountSidebar({ current }: { current: SidebarItem }) {
  const logout = useLogout()

  return (
    <nav aria-label="Conta" className="self-start overflow-hidden rounded-lg bg-card">
      <p className="hidden px-[10px] pt-3 pb-1 text-lg font-bold text-text-primary lg:block">
        Meu perfil
      </p>
      <ul className="flex lg:flex-col [&_svg]:size-[18px] [&_svg]:shrink-0">
        <li className="flex flex-1 lg:block">
          <Link
            to="/profile"
            aria-current={current === 'profile' ? 'page' : undefined}
            className={cn(itemClass, 'w-full', current === 'profile' && activeClass)}
          >
            <UserIcon aria-hidden />
            Dados do perfil
          </Link>
        </li>
        <li className="flex flex-1 lg:block">
          <Link
            to="/wallets"
            aria-current={current === 'wallets' ? 'page' : undefined}
            className={cn(itemClass, 'w-full', current === 'wallets' && activeClass)}
          >
            <MapPinIcon aria-hidden />
            Carteiras
          </Link>
        </li>
        {COMING_SOON.map((item) => (
          <li key={item.label} className="hidden lg:block">
            <ComingSoonLink className={cn(itemClass, 'w-full opacity-80')}>
              <span aria-hidden className="contents">
                {item.icon}
              </span>
              {item.label}
            </ComingSoonLink>
          </li>
        ))}
        <li className="flex flex-1 lg:block lg:border-t lg:border-border-soft">
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className={cn(itemClass, 'w-full font-bold')}
          >
            <LogOutIcon aria-hidden />
            Sair
          </button>
        </li>
      </ul>
    </nav>
  )
}

import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { HeartIcon, HouseIcon, ScanLineIcon, ShoppingCartIcon, UserIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cartItemCount, useCart } from '@/features/cart/use-cart'
import { scrollToCatalog } from '@/features/catalog/scroll-to-catalog'
import { useSession } from '@/features/session/session-store'
import { cn } from '@/lib/utils'

import { useTabBarVisible } from './tab-bar'

const item =
  'relative flex size-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-text-accent data-[status=active]:text-brand'

/**
 * Tab Bar do Figma mobile: Início, Favoritos, ação central (explorar),
 * Carrinho e Perfil. O recorte côncavo no topo é feito com mask-image.
 */
export function MobileTabBar() {
  const visible = useTabBarVisible()
  const session = useSession()
  const { data: cart } = useCart()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const authenticated = session.status === 'authenticated'
  const count = cartItemCount(cart)

  if (!visible) return null

  async function explore() {
    if (pathname !== '/') await navigate({ to: '/' })
    requestAnimationFrame(scrollToCatalog)
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 h-[126px] md:hidden"
    >
      <div
        className="absolute inset-x-0 top-[31px] bottom-0 rounded-t-[32px] bg-card shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
        style={{
          maskImage: 'radial-gradient(circle 42px at 50% 0, transparent 41px, #000 42px)',
          WebkitMaskImage: 'radial-gradient(circle 42px at 50% 0, transparent 41px, #000 42px)',
        }}
      />
      <ul className="relative grid h-full grid-cols-5 items-end px-4 pb-[34px]">
        <TabItem>
          <Link
            to="/"
            activeOptions={{ exact: true, includeSearch: false }}
            className={item}
            aria-label="Início"
          >
            <HouseIcon aria-hidden className="size-5 fill-current" />
          </Link>
        </TabItem>
        <TabItem>
          {authenticated ? (
            <Link
              to="/profile"
              hash="favoritos"
              activeOptions={{ includeHash: true }}
              className={item}
              aria-label="Favoritos"
            >
              <HeartIcon aria-hidden className="size-5 fill-current" />
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ returnTo: '/profile#favoritos' }}
              className={item}
              aria-label="Favoritos (requer login)"
            >
              <HeartIcon aria-hidden className="size-5 fill-current" />
            </Link>
          )}
        </TabItem>
        <li className="flex justify-center">
          <button
            type="button"
            onClick={explore}
            aria-label="Explorar catálogo"
            className="absolute top-0 left-1/2 flex size-[65px] -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-b from-[#e3a76f] to-brand text-ink shadow-lg shadow-black/40"
          >
            <ScanLineIcon aria-hidden className="size-7" strokeWidth={2.2} />
          </button>
        </li>
        <TabItem>
          <Link
            to="/cart"
            className={item}
            aria-label={
              count > 0 ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho'
            }
          >
            <ShoppingCartIcon aria-hidden className="size-5" />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-ink"
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        </TabItem>
        <TabItem>
          {authenticated ? (
            <Link to="/profile" className={item} aria-label="Perfil">
              <UserIcon aria-hidden className="size-5 fill-current" />
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ returnTo: '/profile' }}
              className={item}
              aria-label="Perfil (requer login)"
            >
              <UserIcon aria-hidden className="size-5 fill-current" />
            </Link>
          )}
        </TabItem>
      </ul>
    </nav>
  )
}

function TabItem({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn('flex justify-center', className)}>{children}</li>
}

import { Container } from '@/components/layout/Container'

import { AccountSidebar } from './AccountSidebar'
import { ChangePasswordForm } from './ChangePasswordForm'
import { FavoritesSection } from './FavoritesSection'
import { OrdersSection } from './OrdersSection'
import { ProfileForm } from './ProfileForm'
import { ProfileHeaderCard } from './ProfileHeaderCard'
import { useProfile } from './use-profile'

/** Perfil do colecionador: resumo, dados, senha, favoritos e pedidos. */
export function ProfilePage() {
  const user = useProfile()

  return (
    <Container className="py-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-7">
        <AccountSidebar current="profile" />
        <div className="min-w-0 space-y-8">
          <h1 className="text-lg font-bold text-text-primary">Perfil do colecionador</h1>
          <ProfileHeaderCard user={user} />
          <ProfileForm key={user.id} user={user} />
          <ChangePasswordForm />
          <FavoritesSection />
          <OrdersSection />
        </div>
      </div>
    </Container>
  )
}

/** Skeleton com as mesmas dimensões da página (sem deslocamento de layout). */
export function ProfileSkeleton() {
  return (
    <Container className="py-6 lg:py-8">
      <div role="status" aria-label="Carregando perfil">
        <span className="sr-only">Carregando perfil…</span>
        <div aria-hidden className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-7">
          <div className="skeleton h-[45px] w-full rounded-lg lg:h-[407px]" />
          <div className="space-y-8">
            <div className="skeleton h-7 w-64" />
            <div className="skeleton h-[104px] w-full rounded-lg" />
            <div className="skeleton h-[430px] w-full rounded-lg" />
            <div className="skeleton h-[320px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    </Container>
  )
}

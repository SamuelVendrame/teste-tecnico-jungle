import type { User } from '@/api/contracts'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { initials, memberSince } from './profile-utils'

/** Resumo do perfil salvo (não acompanha o que está sendo digitado). */
export function ProfileHeaderCard({ user }: { user: User }) {
  return (
    <section
      aria-label="Resumo do perfil"
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 sm:gap-5 sm:p-5"
    >
      <Avatar className="size-16 border-2 border-brand sm:size-[72px]">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={`Avatar de ${user.name}`} />}
        <AvatarFallback className="bg-surface-dark text-lg font-bold text-text-accent">
          {initials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold text-text-primary" data-testid="profile-name">
          {user.name}
        </p>
        <p className="truncate text-sm text-text-accent">@{user.username}</p>
        <p className="mt-1 text-xs text-text-secondary">
          Membro desde {memberSince(user.createdAt)}
        </p>
      </div>
    </section>
  )
}

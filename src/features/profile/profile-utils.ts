import type { User } from '@/api/contracts'

/** Iniciais para o fallback do avatar (até duas letras). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** "outubro de 2026" */
export function memberSince(createdAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(createdAt),
  )
}

export interface ProfileFormValues {
  name: string
  username: string
  bio: string
  avatarUrl: string | null
}

export function toFormValues(user: User): ProfileFormValues {
  return {
    name: user.name,
    username: user.username,
    bio: user.bio ?? '',
    avatarUrl: user.avatarUrl,
  }
}

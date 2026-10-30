/**
 * Store de sessão: fonte única do token e do usuário autenticado.
 *
 * - Persistido em localStorage (`kurio:session`) para sobreviver a refresh.
 * - O carrinho de visitante tem um id próprio (`kurio:guest-cart`) que é
 *   enviado no header X-Cart-Id até o login; depois do login o carrinho do
 *   visitante é mesclado no do usuário (POST /cart/merge).
 * - `bindTokenStore` conecta este store ao cliente Axios sem import circular.
 * - Troca de usuário / logout: `clearPrivateState` é chamado por quem fizer
 *   logout e deve limpar cache privado do Query e assinaturas de socket.
 */
import { useSyncExternalStore } from 'react'

import { bindTokenStore } from '@/api/client'
import type { Session, User } from '@/api/contracts'

const SESSION_KEY = 'kurio:session'
const GUEST_CART_KEY = 'kurio:guest-cart'

export type SessionStatus = 'anonymous' | 'authenticated' | 'expired'

export interface SessionState {
  status: SessionStatus
  user: User | null
  token: string | null
  expiresAt: string | null
  /** Rota para onde voltar após autenticar (login exigido no meio de um fluxo). */
  returnTo: string | null
}

type Listener = () => void

function readPersisted(): Pick<SessionState, 'user' | 'token' | 'expiresAt'> {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return { user: null, token: null, expiresAt: null }
    const parsed = JSON.parse(raw) as { user: User; token: string; expiresAt: string }
    return parsed
  } catch {
    return { user: null, token: null, expiresAt: null }
  }
}

function initialState(): SessionState {
  const persisted = readPersisted()
  const expired = persisted.expiresAt ? Date.parse(persisted.expiresAt) <= Date.now() : false
  return {
    status: persisted.token ? (expired ? 'expired' : 'authenticated') : 'anonymous',
    user: persisted.user,
    token: expired ? null : persisted.token,
    expiresAt: persisted.expiresAt,
    returnTo: null,
  }
}

let state: SessionState = initialState()
const listeners = new Set<Listener>()

function setState(patch: Partial<SessionState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const sessionStore = {
  getState: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  setSession(session: Session) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ user: session.user, token: session.token, expiresAt: session.expiresAt }),
    )
    setState({
      status: 'authenticated',
      user: session.user,
      token: session.token,
      expiresAt: session.expiresAt,
    })
  },

  updateUser(user: User) {
    const persisted = readPersisted()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...persisted, user }))
    setState({ user })
  },

  /** Sessão expirou (401). Mantém `user` para mostrar "sua sessão expirou" e `returnTo`. */
  markExpired() {
    if (state.status === 'anonymous') return
    localStorage.removeItem(SESSION_KEY)
    setState({ status: 'expired', token: null })
  },

  clear() {
    localStorage.removeItem(SESSION_KEY)
    setState({ status: 'anonymous', user: null, token: null, expiresAt: null, returnTo: null })
  },

  setReturnTo(returnTo: string | null) {
    setState({ returnTo })
  },

  getGuestCartId(): string {
    let id = localStorage.getItem(GUEST_CART_KEY)
    if (!id) {
      id = `guest_${crypto.randomUUID()}`
      localStorage.setItem(GUEST_CART_KEY, id)
    }
    return id
  },

  resetGuestCartId() {
    localStorage.removeItem(GUEST_CART_KEY)
  },
}

bindTokenStore({
  getToken: () => state.token,
  getGuestCartId: () => (state.token ? null : sessionStore.getGuestCartId()),
  onUnauthorized: () => sessionStore.markExpired(),
})

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState)
}

export function isAuthenticated(): boolean {
  return state.status === 'authenticated' && !!state.token
}

/**
 * Hooks de autenticação e ciclo de vida da sessão.
 *
 * - Login/cadastro: grava a sessão, mescla o carrinho de visitante no do usuário
 *   e navega para `returnTo` (somente caminho da mesma origem) ou "/".
 * - Logout: encerra no servidor (falha ignorada), limpa a sessão, todo o cache
 *   privado do Query e o estado de checkout persistido (rascunho com dados
 *   pessoais, tentativa e pedido pendente), volta para "/" e avisa com um toast.
 */
import { useMutation, useQueryClient, type Query, type QueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { Cart, LoginInput, RegisterInput, Session } from '@/api/contracts'
import { authApi, cartApi } from '@/api/endpoints'
import { resolveReturnTo } from '@/features/auth/return-to'
import { clearPrivateStorage } from '@/features/checkout/checkout-storage'
import { resetWalletConnections } from '@/features/wallets/wallet-connection-store'
import { PUBLIC_QUERY_ROOTS, queryKeys } from '@/lib/query-keys'

import { sessionStore } from './session-store'

/** Mesma chave do session-store (não exposta por ele); só lemos, nunca criamos o id aqui. */
const GUEST_CART_KEY = 'kurio:guest-cart'

function isPrivateQuery(query: Query): boolean {
  return !(PUBLIC_QUERY_ROOTS as readonly unknown[]).includes(query.queryKey[0])
}

/** Remove do cache tudo que não é público, cancelando consultas em andamento. */
export function clearPrivateQueries(queryClient: QueryClient) {
  void queryClient.cancelQueries({ predicate: isPrivateQuery })
  queryClient.removeQueries({ predicate: isPrivateQuery })
}

function readGuestCartId(): string | null {
  try {
    return localStorage.getItem(GUEST_CART_KEY)
  } catch {
    return null
  }
}

/**
 * A mescla descarta edições esgotadas e limita quantidades ao estoque/limite por
 * pedido (ver `mergeGuestCart` no mock). Algum item do visitante sumiu ou encolheu?
 */
function lostInMerge(guest: Cart, merged: Cart): boolean {
  return guest.items.some((g) => {
    const kept = merged.items.find((m) => m.id === g.id)
    return !kept || kept.quantity < g.quantity
  })
}

/** Conclui um login/cadastro: troca de usuário sem rastros, grava a sessão e mescla o carrinho. */
async function establishSession(queryClient: QueryClient, session: Session) {
  // Lido antes da limpeza: serve para avisar o que a mescla não conseguiu manter.
  const guestCart = queryClient.getQueryData<Cart>(queryKeys.cart('guest'))
  // Nada do usuário anterior (ou do visitante) pode sobreviver à nova sessão. O
  // checkout persistido do PRÓPRIO usuário fica (sessão expirada no meio da compra).
  clearPrivateQueries(queryClient)
  clearPrivateStorage(session.user.id)
  resetWalletConnections()
  sessionStore.setSession(session)
  sessionStore.setReturnTo(null)

  const guestCartId = readGuestCartId()
  if (!guestCartId) return
  try {
    const merged = await cartApi.merge(guestCartId)
    sessionStore.resetGuestCartId()
    queryClient.setQueryData(queryKeys.cart(session.user.id), merged)
    queryClient.removeQueries({ queryKey: queryKeys.cart('guest') })
    if (guestCart && lostInMerge(guestCart, merged)) {
      toast.warning(
        'Alguns itens do carrinho de visitante não estão mais disponíveis na quantidade escolhida e foram ajustados.',
      )
    }
  } catch {
    // Mantém o id do visitante para uma nova tentativa no próximo login.
    toast.warning('Não foi possível sincronizar o carrinho de visitante.')
  }
}

interface SignInOptions {
  /** `returnTo` da URL; cai para o valor guardado no store quando ausente. */
  returnTo?: string
}

function useSignIn<TInput>(
  options: SignInOptions,
  authenticate: (input: TInput) => Promise<Session>,
) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (input: TInput) => {
      const target = resolveReturnTo(options.returnTo ?? sessionStore.getState().returnTo)
      const session = await authenticate(input)
      await establishSession(queryClient, session)
      return { session, target }
    },
    onSuccess: ({ target }) => {
      router.history.replace(target)
    },
  })
}

export function useLogin(options: SignInOptions = {}) {
  return useSignIn(options, (input: LoginInput) => authApi.login(input))
}

export function useRegister(options: SignInOptions = {}) {
  return useSignIn(options, (input: RegisterInput) => authApi.register(input))
}

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } catch {
        // O servidor pode já ter invalidado o token; o cliente encerra de qualquer forma.
      }
    },
    onSettled: () => {
      sessionStore.clear()
      clearPrivateQueries(queryClient)
      clearPrivateStorage()
      resetWalletConnections()
      router.history.replace('/')
      toast.success('Você saiu da sua conta')
    },
  })
}

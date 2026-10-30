/**
 * Hooks de autenticação (implementação completa na etapa seguinte).
 * As assinaturas abaixo são o contrato consumido pelo shell e pelas páginas.
 */
import { useMutation } from '@tanstack/react-query'

import type { LoginInput, RegisterInput } from '@/api/contracts'
import { authApi } from '@/api/endpoints'

import { sessionStore } from './session-store'

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (session) => sessionStore.setSession(session),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: (session) => sessionStore.setSession(session),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => sessionStore.clear(),
  })
}

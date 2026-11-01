import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { isApiClientError } from '@/api/client'

export type FormAlertKind = 'invalid-credentials' | 'unavailable' | 'email-taken' | 'unknown'

/** Erro de nível de formulário (não associado a um campo) a ser exibido em um alerta. */
export interface FormAlert {
  kind: FormAlertKind
  message: string
  /** Quando true a UI oferece "Tentar novamente". */
  retryable: boolean
}

export const EMAIL_TAKEN_MESSAGE = 'Este e-mail já está cadastrado'

interface Options<T extends FieldValues> {
  /** Campo que recebe detalhes de servidor cuja chave não existe no formulário. */
  fallbackField?: Path<T>
  /** Campos conhecidos do formulário; chaves fora desta lista usam `fallbackField`. */
  fields?: readonly string[]
}

/**
 * Traduz um erro da API em erros de campo (via `setError`) e/ou em um alerta de formulário.
 * Retorna o alerta a exibir, ou `null` quando tudo foi mapeado para campos.
 */
export function applyApiErrorToForm<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  options: Options<T> = {},
): FormAlert | null {
  if (!isApiClientError(error)) {
    return { kind: 'unknown', message: 'Algo deu errado. Tente novamente.', retryable: true }
  }
  if (error.canceled) return null

  if (error.code === 'EMAIL_TAKEN') {
    setError(
      'email' as Path<T>,
      { type: 'server', message: EMAIL_TAKEN_MESSAGE },
      { shouldFocus: true },
    )
    return { kind: 'email-taken', message: EMAIL_TAKEN_MESSAGE, retryable: false }
  }

  if (error.code === 'INVALID_CREDENTIALS') {
    return { kind: 'invalid-credentials', message: 'E-mail ou senha inválidos', retryable: false }
  }

  if (error.details && Object.keys(error.details).length > 0) {
    let mapped = 0
    for (const [key, messages] of Object.entries(error.details)) {
      const known = !options.fields || options.fields.includes(key)
      const target = known ? (key as Path<T>) : options.fallbackField
      const message = messages[0]
      if (!target || !message) continue
      setError(target, { type: 'server', message }, { shouldFocus: mapped === 0 })
      mapped += 1
    }
    if (mapped > 0) return null
  }

  if (error.meta?.mocks === 'unavailable') {
    return { kind: 'unavailable', message: error.message, retryable: false }
  }

  if (error.code === 'SERVICE_UNAVAILABLE' || error.status === 0 || error.isTransient) {
    return {
      kind: 'unavailable',
      message: 'Serviço indisponível no momento. Verifique sua conexão e tente novamente.',
      retryable: true,
    }
  }

  return { kind: 'unknown', message: error.message, retryable: false }
}

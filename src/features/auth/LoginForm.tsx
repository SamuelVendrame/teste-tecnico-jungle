import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { loginInput, type LoginInput } from '@/api/contracts'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useLogin } from '@/features/session/use-auth'
import { applyApiErrorToForm, type FormAlert } from '@/lib/form-errors'

import { AuthField, PasswordField } from './AuthField'
import { FormAlertBox, SubmitButton } from './AuthFormParts'
import { FILL_CREDENTIALS_EVENT, type FillCredentialsDetail } from './fill-credentials-event'

const FIELDS = ['email', 'password'] as const

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const login = useLogin({ returnTo })
  const [formAlert, setFormAlert] = useState<FormAlert | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInput),
    defaultValues: { email: '', password: '' },
  })

  // O painel de cenários dispara este evento para preencher as credenciais de demonstração.
  useEffect(() => {
    function onFill(event: Event) {
      const { email, password } = (event as CustomEvent<FillCredentialsDetail>).detail
      setValue('email', email, { shouldDirty: true })
      setValue('password', password, { shouldDirty: true })
      clearErrors()
      setFormAlert(null)
    }
    window.addEventListener(FILL_CREDENTIALS_EVENT, onFill)
    return () => window.removeEventListener(FILL_CREDENTIALS_EVENT, onFill)
  }, [setValue, clearErrors])

  const onSubmit = handleSubmit(async (values) => {
    setFormAlert(null)
    try {
      await login.mutateAsync(values)
    } catch (error) {
      setFormAlert(applyApiErrorToForm<LoginInput>(error, setError, { fields: FIELDS }))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <FormAlertBox alert={formAlert} onRetry={() => void onSubmit()} />
      <AuthField
        label="E-mail"
        type="email"
        autoComplete="email"
        placeholder="contato@email.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <PasswordField
        label="Senha"
        autoComplete="current-password"
        placeholder="Senha"
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="flex justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-disabled="true"
                onClick={() => toast.info('Recuperação de senha em breve.')}
                className="rounded-xs text-xs text-text-accent underline-offset-4 hover:underline"
              >
                Esqueceu a senha?
              </button>
            </TooltipTrigger>
            <TooltipContent>Em breve</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="pt-3 md:pt-1">
        <SubmitButton pending={login.isPending} idleLabel="Entrar" pendingLabel="Entrando..." />
      </div>
    </form>
  )
}

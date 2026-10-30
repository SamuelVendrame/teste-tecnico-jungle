import { zodResolver } from '@hookform/resolvers/zod'
import { CheckIcon, CircleIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { registerInput } from '@/api/contracts'
import { Link } from '@tanstack/react-router'
import { useRegister } from '@/features/session/use-auth'
import { applyApiErrorToForm, type FormAlert } from '@/lib/form-errors'
import { cn } from '@/lib/utils'

import { AuthField, PasswordField } from './AuthField'
import { FormAlertBox, SubmitButton } from './AuthFormParts'

/** O contrato da API não conhece a confirmação de senha: ela existe só no formulário. */
const registerForm = registerInput
  .extend({ confirmPassword: z.string().min(1, 'Confirme a senha') })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
type RegisterFormValues = z.infer<typeof registerForm>

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const

const REQUIREMENTS = [
  { label: 'Mínimo de 8 caracteres', test: (v: string) => v.length >= 8 },
  { label: 'Ao menos uma letra', test: (v: string) => /[A-Za-z]/.test(v) },
  { label: 'Ao menos um número', test: (v: string) => /\d/.test(v) },
]

function PasswordRequirements({ value }: { value: string }) {
  return (
    <ul className="grid gap-0.5">
      {REQUIREMENTS.map((r) => {
        const ok = r.test(value)
        return (
          <li key={r.label} className={cn('flex items-center gap-1.5', ok && 'text-text-accent')}>
            {ok ? (
              <CheckIcon className="size-3" aria-hidden="true" />
            ) : (
              <CircleIcon className="size-3" aria-hidden="true" />
            )}
            {r.label}
            <span className="sr-only">{ok ? ' (atendido)' : ' (pendente)'}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function RegisterForm({ returnTo }: { returnTo?: string }) {
  const registerUser = useRegister({ returnTo })
  const [formAlert, setFormAlert] = useState<FormAlert | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerForm),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormAlert(null)
    try {
      await registerUser.mutateAsync({ name, email, password })
    } catch (error) {
      setFormAlert(
        applyApiErrorToForm<RegisterFormValues>(error, setError, {
          fields: FIELDS,
          fallbackField: 'email',
        }),
      )
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <FormAlertBox alert={formAlert} onRetry={() => void onSubmit()} />
      <AuthField
        label="Nome completo"
        autoComplete="name"
        placeholder="Nome completo"
        error={errors.name?.message}
        {...register('name')}
      />
      <AuthField
        label="E-mail"
        type="email"
        autoComplete="email"
        placeholder="Digite seu e-mail"
        error={errors.email?.message}
        errorAction={
          formAlert?.kind === 'email-taken' ? (
            <Link
              to="/login"
              search={{ returnTo }}
              className="font-bold text-text-accent underline underline-offset-4"
            >
              Entrar
            </Link>
          ) : null
        }
        {...register('email')}
      />
      <PasswordField
        label="Senha"
        autoComplete="new-password"
        placeholder="Senha"
        hint={<PasswordRequirements value={password ?? ''} />}
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordField
        label="Confirmar senha"
        autoComplete="new-password"
        placeholder="Confirmar senha"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <div className="pt-3 md:pt-1">
        <SubmitButton
          pending={registerUser.isPending}
          idleLabel="Criar perfil"
          pendingLabel="Criando perfil..."
        />
      </div>
    </form>
  )
}

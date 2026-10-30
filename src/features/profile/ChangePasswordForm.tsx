import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { changePasswordInput, type ChangePasswordInput } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { FormAlertBox } from '@/features/auth/AuthFormParts'
import { applyApiErrorToForm, type FormAlert } from '@/lib/form-errors'

import { Field, PasswordInput } from './ProfileField'
import { useChangePassword } from './use-profile'

const EMPTY: ChangePasswordInput = { currentPassword: '', newPassword: '', confirmPassword: '' }
const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const

export function ChangePasswordForm() {
  const change = useChangePassword()
  const [alert, setAlert] = useState<FormAlert | null>(null)
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordInput),
    defaultValues: EMPTY,
  })
  const { register, handleSubmit, setError, reset, formState } = form
  const { errors } = formState

  const onSubmit = handleSubmit((values) => {
    setAlert(null)
    change.mutate(values, {
      onSuccess: () => {
        reset(EMPTY)
        toast.success('Senha alterada')
      },
      onError: (error) => {
        setAlert(
          applyApiErrorToForm(error, setError, {
            fields: FIELDS,
            fallbackField: 'currentPassword',
          }),
        )
      },
    })
  })

  const pending = change.isPending

  return (
    <section
      aria-labelledby="password-form-title"
      className="rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="password-form-title" className="text-base font-bold text-text-primary">
        Alterar senha
      </h2>
      <form onSubmit={onSubmit} noValidate aria-busy={pending} className="mt-6 space-y-6">
        <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
          <Field
            label="Senha atual"
            required
            error={errors.currentPassword?.message}
            className="md:col-span-2 md:max-w-[calc(50%-14px)]"
          >
            {(control) => (
              <PasswordInput
                {...control}
                {...register('currentPassword')}
                autoComplete="current-password"
              />
            )}
          </Field>
          <Field
            label="Nova senha"
            required
            error={errors.newPassword?.message}
            hint="Mínimo de 8 caracteres, com ao menos uma letra e um número."
          >
            {(control) => (
              <PasswordInput
                {...control}
                {...register('newPassword')}
                autoComplete="new-password"
              />
            )}
          </Field>
          <Field label="Confirmar nova senha" required error={errors.confirmPassword?.message}>
            {(control) => (
              <PasswordInput
                {...control}
                {...register('confirmPassword')}
                autoComplete="new-password"
              />
            )}
          </Field>
        </div>

        <FormAlertBox alert={alert} onRetry={() => void onSubmit()} />

        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="h-10 rounded-sm px-8 font-bold"
        >
          {pending ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Alterando…
            </>
          ) : (
            'Alterar senha'
          )}
        </Button>
      </form>
    </section>
  )
}

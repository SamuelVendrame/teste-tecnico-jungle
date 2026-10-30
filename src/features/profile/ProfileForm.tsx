import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { updateProfileInput, type User } from '@/api/contracts'
import { FormAlertBox } from '@/features/auth/AuthFormParts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { applyApiErrorToForm, type FormAlert } from '@/lib/form-errors'
import { cn } from '@/lib/utils'

import { AvatarPicker } from './AvatarPicker'
import { Field, fieldControlClass } from './ProfileField'
import { toFormValues, type ProfileFormValues } from './profile-utils'
import { useUpdateProfile } from './use-profile'

const BIO_MAX = 160
const FIELDS = ['name', 'username', 'bio', 'avatarUrl'] as const

/** Mesmo contrato da API, com `bio` como string no formulário (vazia vira null ao enviar). */
const profileFormSchema = updateProfileInput.extend({
  bio: z.string().trim().max(BIO_MAX, `Máximo de ${BIO_MAX} caracteres`),
})

export function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const [alert, setAlert] = useState<FormAlert | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toFormValues(user),
  })
  const { register, handleSubmit, setValue, setError, reset, watch, formState } = form
  const { errors, isDirty } = formState
  const bioLength = watch('bio').length
  const avatarUrl = watch('avatarUrl')
  const name = watch('name')

  const onSubmit = handleSubmit((values) => {
    setAlert(null)
    update.mutate(
      { ...values, bio: values.bio.trim() === '' ? null : values.bio.trim() },
      {
        onSuccess: (saved) => {
          reset(toFormValues(saved))
          toast.success('Perfil atualizado')
          // O botão volta a ficar desabilitado e perderia o foco: devolve-o ao título da seção.
          const active = document.activeElement
          if (!active || active === document.body || active === submitRef.current) {
            headingRef.current?.focus({ preventScroll: true })
          }
        },
        onError: (error) => {
          setAlert(applyApiErrorToForm(error, setError, { fields: FIELDS, fallbackField: 'name' }))
        },
      },
    )
  })

  const pending = update.isPending

  return (
    <section
      aria-labelledby="profile-form-title"
      className="rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2
        id="profile-form-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-base font-bold text-text-primary outline-none"
      >
        Dados do perfil
      </h2>
      <form onSubmit={onSubmit} noValidate aria-busy={pending} className="mt-6 space-y-6">
        <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
          <Field label="Nome de exibição" required error={errors.name?.message}>
            {(control) => (
              <Input
                {...control}
                {...register('name')}
                autoComplete="name"
                className={fieldControlClass}
              />
            )}
          </Field>
          <Field
            label="Nome de usuário"
            required
            error={errors.username?.message}
            hint="Letras minúsculas, números e _ (3 a 24 caracteres)."
          >
            {(control) => (
              <Input
                {...control}
                {...register('username')}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className={fieldControlClass}
              />
            )}
          </Field>
          <Field label="E-mail" hint="O e-mail da conta não pode ser alterado.">
            {(control) => (
              <Input
                {...control}
                value={user.email}
                readOnly
                className={cn(fieldControlClass, 'text-text-secondary')}
              />
            )}
          </Field>
          <AvatarPicker
            name={name}
            value={avatarUrl}
            serverError={errors.avatarUrl?.message}
            onChange={(dataUrl) => setValue('avatarUrl', dataUrl, { shouldDirty: true })}
          />
        </div>

        <Field
          label="Bio"
          error={errors.bio?.message}
          hint={
            <span className={cn('tabular-nums', bioLength > BIO_MAX && 'text-destructive')}>
              {bioLength}/{BIO_MAX} caracteres
            </span>
          }
        >
          {(control) => (
            <Textarea
              {...control}
              {...register('bio')}
              rows={3}
              placeholder="Conte um pouco sobre você e sua coleção"
              className="min-h-22 rounded-sm border-border-soft px-4 text-sm text-text-primary shadow-none placeholder:text-brand-secondary focus-visible:border-brand"
            />
          )}
        </Field>

        <FormAlertBox alert={alert} onRetry={() => void onSubmit()} />

        <Button
          ref={submitRef}
          type="submit"
          disabled={!isDirty || pending}
          aria-busy={pending}
          className="h-10 rounded-sm px-8 font-bold"
        >
          {pending ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Salvando…
            </>
          ) : (
            'Salvar alterações'
          )}
        </Button>
      </form>
    </section>
  )
}

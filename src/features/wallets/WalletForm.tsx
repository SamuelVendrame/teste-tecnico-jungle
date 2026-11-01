import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { NETWORK_LABELS, type Wallet, type WalletInput } from '@/api/contracts'
import { isApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormAlertBox } from '@/features/auth/AuthFormParts'
import { Field, fieldControlClass } from '@/features/profile/ProfileField'
import { applyApiErrorToForm, type FormAlert } from '@/lib/form-errors'
import { cn } from '@/lib/utils'

import { useSaveWallet } from './use-wallets'
import {
  ADDRESS_HINTS,
  ADDRESS_PLACEHOLDERS,
  ENS_SUFFIXES,
  KIND_ARTICLE,
  NETWORKS,
  PROVIDERS,
  PROVIDER_LABELS,
  walletFormSchema,
  type WalletFormValues,
  type WalletKind,
} from './wallet-meta'

const FIELDS = [
  'label',
  'provider',
  'network',
  'address',
  'kind',
  'displayName',
  'profileName',
  'secondaryRef',
  'referralCode',
  'email',
  'ensSuffix',
  'ensName',
] as const

const selectTriggerClass = cn(fieldControlClass, 'w-full data-[size=default]:h-10')

export function emptyWalletValues(
  kind: WalletKind,
  seed: Partial<WalletInput> = {},
): WalletFormValues {
  const base: Omit<WalletFormValues, 'kind'> = {
    label: '',
    provider: 'metamask',
    network: 'ethereum',
    address: '',
    displayName: '',
    profileName: '',
    secondaryRef: '',
    referralCode: '',
    email: '',
    ensSuffix: '.eth',
    ensName: '',
  }
  // O slot nunca muda pelo formulário: `kind` vem do slot, não da semente.
  return { ...base, ...seed, kind }
}

interface WalletFormProps {
  kind: WalletKind
  /** Carteira do slot (edição) ou undefined (cadastro). */
  wallet: Wallet | undefined
  /** Valores iniciais do cadastro (ex.: "Igual à carteira principal"). */
  seed?: Partial<WalletInput>
  onSaved?: (wallet: Wallet) => void
  onCancel?: () => void
  className?: string
}

/**
 * Formulário de carteira do Figma (inline na página de carteiras), com os campos do
 * perfil do colecionador. O mesmo conjunto de campos aparece no pagamento, pré-preenchido
 * pela carteira escolhida.
 */
export function WalletForm({ kind, wallet, seed, onSaved, onCancel, className }: WalletFormProps) {
  const save = useSaveWallet()
  const [alert, setAlert] = useState<FormAlert | null>(null)
  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: wallet
      ? { ...emptyWalletValues(kind), ...wallet, kind }
      : emptyWalletValues(kind, seed),
  })
  const { register, control, handleSubmit, setError, trigger, getValues, watch, formState } = form
  const { errors } = formState
  const network = watch('network')
  const pending = save.isPending

  const onSubmit = handleSubmit((values) => {
    setAlert(null)
    save.mutate(
      { walletId: wallet?.id, input: { ...values, kind } },
      {
        onSuccess: (saved) => {
          toast.success(
            wallet
              ? `Carteira ${KIND_ARTICLE[kind]} atualizada`
              : `Carteira ${KIND_ARTICLE[kind]} cadastrada`,
          )
          onSaved?.(saved)
        },
        onError: (error) => {
          if (isApiClientError(error) && error.code === 'WALLET_LIMIT') {
            toast.error(error.message)
            return
          }
          setAlert(applyApiErrorToForm(error, setError, { fields: FIELDS, fallbackField: 'label' }))
        },
      },
    )
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      aria-label={`${wallet ? 'Editar' : 'Cadastrar'} carteira ${KIND_ARTICLE[kind]}`}
      className={cn('grid gap-x-7 gap-y-5 md:grid-cols-2', className)}
    >
      <Field label="Nome de exibição" required error={errors.displayName?.message}>
        {(c) => (
          <Input
            {...c}
            {...register('displayName')}
            autoComplete="name"
            className={fieldControlClass}
          />
        )}
      </Field>
      <Field label="Apelido da carteira" required error={errors.label?.message}>
        {(c) => (
          <Input
            {...c}
            {...register('label')}
            autoComplete="off"
            placeholder="Ex.: Minha MetaMask"
            className={fieldControlClass}
          />
        )}
      </Field>

      <Field label="Rede" required error={errors.network?.message}>
        {(c) => (
          <Controller
            control={control}
            name="network"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  if (getValues('address')) void trigger('address')
                }}
              >
                <SelectTrigger
                  id={c.id}
                  aria-describedby={c['aria-describedby']}
                  aria-invalid={c['aria-invalid']}
                  onBlur={field.onBlur}
                  className={selectTriggerClass}
                >
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent className="border-border-soft bg-popover">
                  {NETWORKS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {NETWORK_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Nome do perfil" required error={errors.profileName?.message}>
        {(c) => (
          <Input
            {...c}
            {...register('profileName')}
            autoComplete="nickname"
            className={fieldControlClass}
          />
        )}
      </Field>

      <Field
        label="Endereço da carteira"
        required
        error={errors.address?.message}
        hint={ADDRESS_HINTS[network]}
      >
        {(c) => (
          <Input
            {...c}
            {...register('address')}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={ADDRESS_PLACEHOLDERS[network]}
            className={fieldControlClass}
          />
        )}
      </Field>
      <Field label="ENS ou carteira secundária" error={errors.secondaryRef?.message}>
        {(c) => (
          <Input
            {...c}
            {...register('secondaryRef')}
            autoComplete="off"
            placeholder="ENS ou carteira secundária (opcional)"
            className={fieldControlClass}
          />
        )}
      </Field>

      <Field label="Tipo de carteira" required error={errors.provider?.message}>
        {(c) => (
          <Controller
            control={control}
            name="provider"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id={c.id}
                  aria-describedby={c['aria-describedby']}
                  aria-invalid={c['aria-invalid']}
                  onBlur={field.onBlur}
                  className={selectTriggerClass}
                >
                  <SelectValue placeholder="Selecione uma carteira" />
                </SelectTrigger>
                <SelectContent className="border-border-soft bg-popover">
                  {PROVIDERS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {PROVIDER_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>
      <Field label="Código de indicação" required error={errors.referralCode?.message}>
        {(c) => (
          <Input
            {...c}
            {...register('referralCode')}
            autoComplete="off"
            autoCapitalize="characters"
            className={fieldControlClass}
          />
        )}
      </Field>

      <Field label="E-mail" required error={errors.email?.message}>
        {(c) => (
          <Input
            {...c}
            {...register('email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            className={fieldControlClass}
          />
        )}
      </Field>
      <Field label="Nome ENS" required error={errors.ensName?.message}>
        {(c) => (
          <div className="flex gap-2">
            <Controller
              control={control}
              name="ensSuffix"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    aria-label="Sufixo ENS"
                    className={cn(selectTriggerClass, 'w-[88px] shrink-0 px-3')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border-soft bg-popover">
                    {ENS_SUFFIXES.map((suffix) => (
                      <SelectItem key={suffix} value={suffix}>
                        {suffix}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Input
              {...c}
              {...register('ensName')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={cn(fieldControlClass, 'min-w-0 flex-1')}
            />
          </div>
        )}
      </Field>

      <div className="md:col-span-2">
        <FormAlertBox alert={alert} onRetry={() => void onSubmit()} />
      </div>

      <div className="flex flex-wrap gap-3 md:col-span-2">
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="h-10 rounded-sm px-5 font-bold"
        >
          {pending ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Salvando…
            </>
          ) : (
            'Salvar carteira'
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
            className="h-10 rounded-sm border-border-soft text-text-primary"
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}

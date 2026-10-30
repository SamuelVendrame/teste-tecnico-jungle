import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { NETWORK_LABELS, type Wallet } from '@/api/contracts'
import { isApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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

import { ProviderMark } from './ProviderMark'
import { useSaveWallet } from './use-wallets'
import {
  ADDRESS_HINTS,
  ADDRESS_PLACEHOLDERS,
  KIND_ARTICLE,
  KIND_LABELS,
  NETWORKS,
  PROVIDERS,
  walletActionId,
  walletFormSchema,
  type WalletFormValues,
  type WalletKind,
} from './wallet-meta'

const FIELDS = ['label', 'provider', 'network', 'address', 'kind'] as const

interface WalletDialogProps {
  open: boolean
  kind: WalletKind
  /** Carteira existente do slot (edição) ou undefined (cadastro). */
  wallet: Wallet | undefined
  onOpenChange: (open: boolean) => void
}

/**
 * Cadastro/edição de carteira. O Radix prende o foco, fecha com Escape e devolve o
 * foco ao botão do slot (que pode ter mudado de "Cadastrar" para "Editar").
 */
export function WalletDialog({ open, kind, wallet, onOpenChange }: WalletDialogProps) {
  const editing = wallet !== undefined
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto rounded-lg border-border-soft bg-card p-5 sm:max-w-[520px] sm:p-6"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          requestAnimationFrame(() => document.getElementById(walletActionId(kind))?.focus())
        }}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 text-lg leading-tight text-text-primary">
            {editing ? 'Editar' : 'Cadastrar'} {KIND_LABELS[kind].toLowerCase()}
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Ela fica disponível no pagamento e para receber NFTs comprados.
          </DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Fechar"
            className="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
          >
            <XIcon aria-hidden />
          </Button>
        </DialogClose>
        <WalletForm kind={kind} wallet={wallet} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function WalletForm({
  kind,
  wallet,
  onDone,
}: {
  kind: WalletKind
  wallet: Wallet | undefined
  onDone: () => void
}) {
  const save = useSaveWallet()
  const [alert, setAlert] = useState<FormAlert | null>(null)
  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: {
      kind,
      label: wallet?.label ?? '',
      provider: wallet?.provider ?? 'metamask',
      network: wallet?.network ?? 'ethereum',
      address: wallet?.address ?? '',
    },
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
        onSuccess: () => {
          toast.success(
            wallet
              ? `Carteira ${KIND_ARTICLE[kind]} atualizada`
              : `Carteira ${KIND_ARTICLE[kind]} cadastrada`,
          )
          onDone()
        },
        onError: (error) => {
          if (isApiClientError(error) && error.code === 'WALLET_LIMIT') {
            toast.error(error.message)
            onDone()
            return
          }
          setAlert(applyApiErrorToForm(error, setError, { fields: FIELDS, fallbackField: 'label' }))
        },
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="space-y-5">
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

      <Field label="Provedor" required group error={errors.provider?.message}>
        {(c) => (
          <Controller
            control={control}
            name="provider"
            render={({ field }) => (
              <RadioGroup
                id={c.id}
                aria-labelledby={c['aria-labelledby']}
                aria-describedby={c['aria-describedby']}
                aria-invalid={c['aria-invalid']}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                className="grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {PROVIDERS.map((provider) => {
                  const itemId = `${c.id}-${provider}`
                  return (
                    <label
                      key={provider}
                      htmlFor={itemId}
                      className={cn(
                        'flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-border-soft px-3 text-xs text-text-primary transition-colors',
                        'has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-surface-dark/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                      )}
                    >
                      <RadioGroupItem id={itemId} value={provider} />
                      <ProviderMark provider={provider} />
                    </label>
                  )
                })}
              </RadioGroup>
            )}
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
                  className={cn(fieldControlClass, 'w-full data-[size=default]:h-10')}
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

      <FormAlertBox alert={alert} onRetry={() => void onSubmit()} />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <DialogClose asChild>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-10 rounded-sm border-border-soft text-text-primary"
          >
            Cancelar
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="h-10 rounded-sm px-6 font-bold"
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
      </div>
    </form>
  )
}

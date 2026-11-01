import { Controller, type UseFormReturn } from 'react-hook-form'

import type { CollectorInfo, NetworkId, Wallet } from '@/api/contracts'
import { NETWORK_LABELS } from '@/api/contracts'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/features/profile/ProfileField'
import { ENS_SUFFIXES, PROVIDER_LABELS } from '@/features/wallets/wallet-meta'
import { cn } from '@/lib/utils'

export const checkoutInputClass =
  'h-[50px] rounded-[10px] border-border-soft bg-transparent px-4 text-sm text-text-primary shadow-none placeholder:text-brand-secondary md:h-10 md:rounded-[2px] md:border-brand dark:bg-transparent focus-visible:border-text-accent focus-visible:ring-0'

const selectTriggerClass = cn(
  checkoutInputClass,
  'w-full data-[size=default]:h-[50px] md:data-[size=default]:h-10',
)
const readOnlyClass = cn(checkoutInputClass, 'text-text-secondary')

interface CollectorFieldsProps {
  form: UseFormReturn<CollectorInfo>
  network: NetworkId | null
  onNetworkChange: (network: NetworkId) => void
  networkDisabled?: boolean
  /** Carteira escolhida em "Carteira e rede": endereço e tipo vêm dela (só leitura). */
  wallet: Wallet | undefined
  /** Carteiras cadastradas: com duas, "Usar outra carteira?" alterna entre elas. */
  wallets: Wallet[] | undefined
  onSelectWallet: (walletId: string) => void
  /** Tentativa de pedido em aberto: o reenvio usa o payload original, então nada pode mudar. */
  locked?: boolean
  className?: string
}

/**
 * "Perfil do colecionador" do Figma: os mesmos campos do cadastro de carteira,
 * pré-preenchidos pela carteira escolhida, mais "Usar outra carteira?" e a observação.
 * Rede é a seleção de rede do pedido; endereço e tipo acompanham a carteira.
 */
export function CollectorFields({
  form,
  network,
  onNetworkChange,
  networkDisabled = false,
  wallet,
  wallets,
  onSelectWallet,
  locked = false,
  className,
}: CollectorFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form
  const other = wallets?.find((w) => w.id !== wallet?.id)
  const usingOther = wallet?.kind === 'secondary'

  return (
    <section aria-labelledby="collector-title" className={className}>
      <h2 id="collector-title" className="text-base font-bold text-text-primary">
        Perfil do colecionador
      </h2>
      {locked && (
        <p className="mt-2 text-xs text-text-secondary" id="collector-locked">
          Formulário travado: há uma tentativa de pedido em aberto. "Tentar novamente" reenvia o
          pedido exatamente como foi enviado.
        </p>
      )}
      <fieldset
        disabled={locked}
        aria-describedby={locked ? 'collector-locked' : undefined}
        className="contents"
      >
        <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2">
          <Field label="Nome de exibição" required error={errors.displayName?.message}>
            {(c) => (
              <Input
                {...c}
                {...register('displayName')}
                autoComplete="name"
                className={checkoutInputClass}
              />
            )}
          </Field>
          <Field
            label="Nome de usuário"
            required
            hint={<span className="sr-only">Vem da sua conta; altere no perfil.</span>}
          >
            {(c) => <Input {...c} {...register('username')} readOnly className={readOnlyClass} />}
          </Field>

          <Field label="Rede" required>
            {(c) => (
              <Select
                value={network ?? undefined}
                onValueChange={(v) => onNetworkChange(v as NetworkId)}
                disabled={networkDisabled}
              >
                <SelectTrigger id={c.id} aria-required className={selectTriggerClass}>
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NETWORK_LABELS) as NetworkId[]).map((id) => (
                    <SelectItem key={id} value={id}>
                      {NETWORK_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Nome do perfil" required error={errors.profileName?.message}>
            {(c) => (
              <Input
                {...c}
                {...register('profileName')}
                autoComplete="nickname"
                className={checkoutInputClass}
              />
            )}
          </Field>

          <Field
            label="Endereço da carteira"
            required
            hint={wallet ? undefined : 'Escolha uma carteira em "Carteira e rede".'}
          >
            {(c) => (
              <Input
                {...c}
                value={wallet?.address ?? ''}
                readOnly
                placeholder="Endereço 0x da carteira"
                className={readOnlyClass}
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
                className={checkoutInputClass}
              />
            )}
          </Field>

          <Field label="Tipo de carteira" required>
            {(c) => (
              <Input
                {...c}
                value={wallet ? PROVIDER_LABELS[wallet.provider] : ''}
                readOnly
                placeholder="Selecione uma carteira"
                className={readOnlyClass}
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
                className={checkoutInputClass}
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
                className={checkoutInputClass}
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
                        className={cn(selectTriggerClass, 'w-[92px] shrink-0 px-3')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                  className={cn(checkoutInputClass, 'min-w-0 flex-1')}
                />
              </div>
            )}
          </Field>
        </div>

        {other && (
          <label className="mt-5 flex w-fit cursor-pointer items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              role="switch"
              checked={usingOther}
              disabled={networkDisabled}
              onChange={(event) => {
                const target = event.target.checked
                  ? wallets?.find((w) => w.kind === 'secondary')
                  : wallets?.find((w) => w.kind === 'primary')
                if (target) onSelectWallet(target.id)
              }}
              className="size-4 appearance-none rounded-full border border-brand checked:border-[5px] checked:border-brand"
            />
            Usar outra carteira?
            <span className="sr-only"> (alterna entre a carteira principal e a secundária)</span>
          </label>
        )}

        <div className="mt-5 md:max-w-[350px]">
          <Field label="Observação do colecionador" error={errors.note?.message}>
            {(c) => (
              <Textarea
                {...c}
                {...register('note')}
                rows={6}
                placeholder="Observação do colecionador (opcional)"
                className={cn(
                  checkoutInputClass,
                  'h-auto min-h-[150px] resize-y py-3 md:rounded-[2px]',
                )}
              />
            )}
          </Field>
        </div>
      </fieldset>
    </section>
  )
}

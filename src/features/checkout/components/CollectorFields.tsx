import { useId, type ComponentProps, type ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { CollectorInfo, NetworkId } from '@/api/contracts'
import { NETWORK_LABELS } from '@/api/contracts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const checkoutInputClass =
  'h-[50px] rounded-[10px] border-border-soft bg-transparent px-4 text-sm text-text-primary shadow-none placeholder:text-brand-secondary md:h-10 md:rounded-[2px] md:border-brand dark:bg-transparent focus-visible:border-text-accent focus-visible:ring-0'

interface FieldShellProps {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

function FieldShell({ id, label, required, error, hint, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-[15px] font-normal text-text-primary">
        {label}
        {required && (
          <span aria-hidden className="text-text-accent">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function TextField({
  label,
  error,
  hint,
  ...props
}: ComponentProps<typeof Input> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <FieldShell id={id} label={label} required error={error} hint={hint}>
      <Input
        id={id}
        aria-required
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={checkoutInputClass}
        {...props}
      />
    </FieldShell>
  )
}

interface CollectorFieldsProps {
  form: UseFormReturn<CollectorInfo>
  network: NetworkId | null
  onNetworkChange: (network: NetworkId) => void
  networkDisabled?: boolean
  className?: string
}

/** Passo 1 (dados do colecionador) + rede, na coluna esquerda como no Figma. */
export function CollectorFields({
  form,
  network,
  onNetworkChange,
  networkDisabled = false,
  className,
}: CollectorFieldsProps) {
  const networkId = useId()
  const {
    register,
    formState: { errors },
  } = form
  const documentField = register('document', {
    // Aceita "123.456.789-09" digitado/colado: guarda só os dígitos.
    setValueAs: (v: string) => v.replace(/\D/g, ''),
  })

  return (
    <section aria-labelledby="collector-title" className={className}>
      <h2 id="collector-title" className="text-base font-bold text-text-primary">
        Perfil do colecionador
      </h2>
      <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2">
        <TextField
          label="Nome completo"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="CPF ou CNPJ"
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          placeholder="Somente números"
          hint="11 dígitos (CPF) ou 14 dígitos (CNPJ)."
          error={errors.document?.message}
          {...documentField}
        />
        <FieldShell id={networkId} label="Rede" required>
          <Select
            value={network ?? undefined}
            onValueChange={(v) => onNetworkChange(v as NetworkId)}
            disabled={networkDisabled}
          >
            <SelectTrigger
              id={networkId}
              aria-required
              className={cn(
                checkoutInputClass,
                'w-full data-[size=default]:h-[50px] md:data-[size=default]:h-10',
              )}
            >
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
        </FieldShell>
      </div>
    </section>
  )
}

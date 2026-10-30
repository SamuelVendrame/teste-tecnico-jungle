import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export const authInputClass =
  'h-[50px] rounded-[10px] border-border-soft bg-transparent px-4 text-sm text-text-primary shadow-none placeholder:text-brand-secondary md:h-10 md:rounded-sm md:px-4 dark:bg-transparent focus-visible:border-brand focus-visible:ring-0'

interface FieldProps extends ComponentProps<typeof Input> {
  label: string
  error?: string
  /** Conteúdo extra abaixo do erro (ex.: link "Entrar" em e-mail já cadastrado). */
  errorAction?: ReactNode
  /** Texto de apoio (requisitos) associado ao campo via aria-describedby. */
  hint?: ReactNode
}

/** Campo com rótulo (visível só para leitores de tela, como no layout) e erro associado. */
export function AuthField({
  label,
  error,
  errorAction,
  hint,
  className,
  id,
  ...props
}: FieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="sr-only">
        {label}
      </Label>
      <Input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(authInputClass, className)}
        {...props}
      />
      {hint ? (
        <div id={hintId} className="text-xs text-text-secondary">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="flex flex-wrap items-center gap-x-2 text-xs text-destructive">
          <span>{error}</span>
          {errorAction}
        </p>
      ) : null}
    </div>
  )
}

/** Campo de senha com alternância mostrar/ocultar (aria-pressed). */
export function PasswordField({ className, ...props }: FieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <AuthField
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-12', className)}
      />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-0 right-0 flex h-[50px] w-12 items-center justify-center rounded-r-md text-brand-secondary hover:text-text-primary focus-visible:text-text-primary md:h-10"
      >
        {visible ? <EyeIcon className="size-[18px]" /> : <EyeOffIcon className="size-[18px]" />}
      </button>
    </div>
  )
}

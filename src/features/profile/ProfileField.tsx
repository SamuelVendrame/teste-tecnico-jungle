import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Campo de formulário do Figma: 40px, borda marrom, fundo transparente. */
export const fieldControlClass =
  'h-10 rounded-sm border-border-soft bg-transparent px-4 text-sm text-text-primary shadow-none placeholder:text-brand-secondary focus-visible:border-brand md:text-sm dark:bg-transparent'

export interface FieldControlProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
  'aria-labelledby': string
}

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  required?: boolean
  /** Controles sem `<input>` (radiogroup) rotulam por `aria-labelledby`, sem `htmlFor`. */
  group?: boolean
  className?: string
  children: (control: FieldControlProps) => ReactNode
}

/**
 * Rótulo visível + controle + dica + erro, ligados por ids.
 * `aria-describedby` aponta para dica e erro; `aria-invalid` só quando há erro.
 */
export function Field({ label, error, hint, required, group, className, children }: FieldProps) {
  const id = useId()
  const labelId = `${id}-label`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const labelContent = (
    <>
      {label}
      {required ? (
        <span aria-hidden className="text-text-accent">
          *
        </span>
      ) : null}
    </>
  )

  return (
    <div className={cn('space-y-2', className)}>
      {group ? (
        <span id={labelId} className="flex items-center gap-1 text-sm text-text-primary">
          {labelContent}
        </span>
      ) : (
        <Label id={labelId} htmlFor={id} className="gap-1 text-sm font-normal text-text-primary">
          {labelContent}
        </Label>
      )}
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
        'aria-labelledby': labelId,
      })}
      {hint ? (
        <div id={hintId} className="text-xs text-text-secondary">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Input de senha com alternância mostrar/ocultar (`aria-pressed`). */
export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(fieldControlClass, 'pr-12', className)}
      />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-0 right-0 flex h-10 w-12 items-center justify-center rounded-r-sm text-brand-secondary hover:text-text-primary focus-visible:text-text-primary"
      >
        {visible ? <EyeIcon className="size-[18px]" /> : <EyeOffIcon className="size-[18px]" />}
      </button>
    </div>
  )
}

import { AlertCircleIcon, Loader2Icon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { FormAlert } from '@/lib/form-errors'

/** Alerta de nível de formulário (credenciais inválidas, serviço indisponível...). */
export function FormAlertBox({ alert, onRetry }: { alert: FormAlert | null; onRetry: () => void }) {
  if (!alert || alert.kind === 'email-taken') return null
  return (
    <Alert variant="destructive" className="border-destructive/50">
      <AlertCircleIcon />
      <AlertDescription className="text-destructive">
        <p>{alert.message}</p>
        {alert.retryable ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-2">
            Tentar novamente
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

interface SubmitProps {
  pending: boolean
  idleLabel: string
  pendingLabel: string
}

/** Botão primário do formulário: desabilitado e com spinner durante o envio. */
export function SubmitButton({ pending, idleLabel, pendingLabel }: SubmitProps) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="h-[60px] w-full rounded-xl bg-brand text-base font-bold text-primary-foreground hover:bg-brand/90 md:h-[45px] md:rounded-sm md:text-sm"
    >
      {pending ? (
        <>
          <Loader2Icon className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        idleLabel
      )}
    </Button>
  )
}

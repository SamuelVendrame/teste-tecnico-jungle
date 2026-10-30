import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { sessionStore } from './session-store'
import { clearPrivateQueries } from './use-auth'

interface Props {
  open: boolean
}

/** Aviso de sessão expirada em páginas públicas. Em rotas privadas o redirecionamento é direto. */
export function SessionExpiredDialog({ open }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const href = useRouterState({ select: (s) => s.location.href })

  function continueBrowsing() {
    sessionStore.clear()
    clearPrivateQueries(queryClient)
  }

  function signInAgain() {
    sessionStore.setReturnTo(href)
    void router.navigate({ to: '/login', search: { returnTo: href } })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && continueBrowsing()}>
      <DialogContent showCloseButton={false} className="border-border-soft bg-surface-card">
        <DialogHeader>
          <DialogTitle>Sua sessão expirou</DialogTitle>
          <DialogDescription>
            Por segurança, você precisa entrar novamente. Seu carrinho e o que você estava fazendo
            continuam esperando por você.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={continueBrowsing}>
            Continuar navegando
          </Button>
          <Button onClick={signInAgain}>Entrar novamente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

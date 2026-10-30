import { useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { CheckIcon, CopyIcon, FlaskConicalIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { FILL_CREDENTIALS_EVENT } from '@/features/auth/fill-credentials-event'
import { sessionStore, useSession } from '@/features/session/session-store'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import {
  SCENARIO_PRESETS,
  getScenario,
  resetMockDb,
  setScenario,
  type ScenarioName,
} from '@/mocks/scenarios'

const DEMO_CREDENTIALS = [
  { label: 'Ana', email: 'ana@kurio.dev', password: 'Senha123' },
  { label: 'Bruno', email: 'bruno@kurio.dev', password: 'Senha123' },
] as const

/** `getScenario()` pode devolver o cenário inteiro ou só o nome; aceitamos os dois. */
function currentScenarioName(): ScenarioName {
  const value: unknown = getScenario()
  return (
    typeof value === 'string' ? value : (value as { name: ScenarioName }).name
  ) as ScenarioName
}

async function mockControl(path: string, body?: unknown) {
  const res = await fetch(`/__mock${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`/__mock${path} respondeu ${res.status}`)
}

/**
 * Posição no mobile sem cobrir ações: acima da Tab Bar (126px) ou da barra de compra do
 * detalhe; no checkout (botão fixo no rodapé) e nas telas cheias de login/cadastro, no topo,
 * longe do formulário. Em >= md fica sempre no canto inferior esquerdo.
 */
function triggerPosition(pathname: string): string {
  if (pathname.startsWith('/nft/')) return 'bottom-[188px] left-4'
  if (pathname.startsWith('/checkout')) return 'top-3 right-4'
  if (/^\/(login|register)/.test(pathname)) return 'top-4 left-4'
  return 'bottom-[138px] left-4'
}

export default function DevPanelContent() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<ScenarioName>(currentScenarioName)
  const [selected, setSelected] = useState<ScenarioName>(active)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<null | 'apply' | 'reset' | 'expire'>(null)
  const queryClient = useQueryClient()
  const { status } = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onLogin = pathname === '/login'

  const shareUrl = `${window.location.origin}/?scenario=${selected}&reset=1`

  async function apply() {
    setBusy('apply')
    try {
      await setScenario(selected)
      setActive(selected)
      toast.success(`Cenário aplicado: ${SCENARIO_PRESETS[selected].label}`)
    } catch {
      toast.error('Não foi possível aplicar o cenário.')
    } finally {
      setBusy(null)
    }
  }

  async function reset() {
    setBusy('reset')
    try {
      await mockControl('/reset')
      await resetMockDb()
      // Os dados voltam ao estado conhecido: tokens e cache anteriores deixam de valer.
      sessionStore.clear()
      sessionStore.resetGuestCartId()
      toast.success('Dados restaurados. Recarregando...')
      window.location.reload()
    } catch {
      toast.error('Não foi possível resetar os dados.')
      setBusy(null)
    }
  }

  async function expireSession() {
    setBusy('expire')
    try {
      await mockControl('/session/expire')
      toast.success('Sessão expirada no servidor.')
      // Revalida já, para a expiração aparecer sem esperar a próxima requisição.
      await queryClient.invalidateQueries({ queryKey: queryKeys.session.current() })
    } catch {
      toast.error('Não foi possível expirar a sessão.')
    } finally {
      setBusy(null)
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  function fill(email: string, password: string) {
    window.dispatchEvent(new CustomEvent(FILL_CREDENTIALS_EVENT, { detail: { email, password } }))
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Cenários de demonstração"
          title="Cenários de demonstração"
          className={cn(
            'fixed z-30 size-10 rounded-full border-border-soft bg-surface-card/90 p-0 text-text-accent shadow-lg backdrop-blur-sm',
            triggerPosition(pathname),
            'md:top-auto md:right-auto md:bottom-4 md:left-4',
          )}
        >
          <FlaskConicalIcon aria-hidden className="size-[18px]" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-full gap-0 border-border-soft bg-surface-card sm:max-w-md"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Cenários de demonstração</SheetTitle>
          <SheetDescription>
            Cenário atual:{' '}
            <strong className="text-text-accent">{SCENARIO_PRESETS[active].label}</strong>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <section aria-labelledby="dev-scenarios" className="space-y-3">
            <h3 id="dev-scenarios" className="text-sm font-bold">
              Escolher cenário
            </h3>
            <RadioGroup
              value={selected}
              onValueChange={(v) => setSelected(v as ScenarioName)}
              aria-labelledby="dev-scenarios"
            >
              {Object.values(SCENARIO_PRESETS).map((s) => (
                <div key={s.name} className="flex items-start gap-3">
                  <RadioGroupItem value={s.name} id={`scenario-${s.name}`} className="mt-0.5" />
                  <Label htmlFor={`scenario-${s.name}`} className="grid gap-0.5 font-normal">
                    <span className="font-bold">{s.label}</span>
                    <span className="text-xs text-text-secondary">{s.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="flex gap-2">
              <Button onClick={apply} disabled={busy !== null} size="sm">
                Aplicar
              </Button>
              <Button onClick={reset} disabled={busy !== null} size="sm" variant="outline">
                Resetar dados
              </Button>
            </div>
          </section>

          <section aria-labelledby="dev-url" className="space-y-2">
            <h3 id="dev-url" className="text-sm font-bold">
              URL do cenário
            </h3>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                aria-labelledby="dev-url"
                onFocus={(e) => e.currentTarget.select()}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={copyUrl}
                aria-label="Copiar URL"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </div>
          </section>

          <section aria-labelledby="dev-creds" className="space-y-2">
            <h3 id="dev-creds" className="text-sm font-bold">
              Credenciais de demonstração
            </h3>
            <ul className="space-y-2">
              {DEMO_CREDENTIALS.map((c) => (
                <li
                  key={c.email}
                  className="flex items-center justify-between gap-2 rounded-md border border-border-soft p-2 text-xs"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{c.email}</span>
                    <span className="text-text-secondary">{c.password}</span>
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={!onLogin}
                    onClick={() => fill(c.email, c.password)}
                    aria-label={`Preencher login de ${c.label}`}
                  >
                    Preencher
                  </Button>
                </li>
              ))}
            </ul>
            {!onLogin ? (
              <p className="text-xs text-text-secondary">
                O preenchimento só funciona na página de login.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="dev-session" className="space-y-2">
            <h3 id="dev-session" className="text-sm font-bold">
              Sessão
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={expireSession}
              disabled={busy !== null || status !== 'authenticated'}
            >
              Expirar sessão
            </Button>
            {status !== 'authenticated' ? (
              <p className="text-xs text-text-secondary">
                Entre em uma conta para expirar a sessão.
              </p>
            ) : null}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

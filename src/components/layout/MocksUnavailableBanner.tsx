import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react'

import { useMocksStatus } from '@/app/mocks-ready'
import { Button } from '@/components/ui/button'

/**
 * Aviso fixo quando a API simulada (MSW) não está interceptando esta aba. Sem ela
 * nada carrega, então o aviso explica o que fazer em vez de deixar cada tela em
 * "Algo deu errado". Casos conhecidos: "Bypass for network" ligado nas DevTools,
 * janela anônima com service worker bloqueado, ou aba que ficou sem controle do worker.
 */
export function MocksUnavailableBanner() {
  const status = useMocksStatus()
  if (status.state !== 'failed') return null
  return (
    <div
      role="alert"
      className="border-b border-brand bg-surface-dark px-4 py-3 text-sm text-text-primary"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2">
        <TriangleAlertIcon aria-hidden className="size-5 shrink-0 text-text-accent" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            A API simulada não está ativa nesta aba, então nada vai carregar.
          </p>
          <p className="text-text-secondary">
            Recarregue a página. Se continuar, desmarque “Bypass for network” em DevTools →
            Application → Service Workers, ou abra a app numa janela normal (não anônima).
          </p>
          <p className="mt-1 text-xs text-text-secondary">Detalhe: {status.reason}</p>
        </div>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-[4px] font-bold"
        >
          <RotateCwIcon aria-hidden />
          Recarregar página
        </Button>
      </div>
    </div>
  )
}

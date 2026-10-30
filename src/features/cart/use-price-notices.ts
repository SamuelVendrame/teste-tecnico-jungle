/**
 * Consome os avisos de tempo real de preço/disponibilidade (gerados por
 * `src/realtime/apply-events.ts` quando um NFT do carrinho muda) e os
 * transforma em toast + banner na página atual.
 *
 * O cache do carrinho já foi corrigido e ['quote'] já foi invalidado pela
 * camada de tempo real; `onUpdate` permite à página forçar o refetch da
 * cotação visível (garante o resumo novo mesmo se a query estiver inativa).
 */
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { dismissNotice, useRealtimeNotices, type RealtimeNotice } from '@/realtime/use-realtime'

const MAX_VISIBLE = 4
/** Avisos criados um pouco antes de montar (navegação em curso) ainda viram toast. */
const TOAST_GRACE_MS = 2_000

export function usePriceNotices(onUpdate?: () => void) {
  const notices = useRealtimeNotices()
  const [recent, setRecent] = useState<RealtimeNotice[]>([])
  const [mountedAt] = useState(() => Date.now())
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  })

  useEffect(() => {
    const relevant = notices.filter((n) => n.kind === 'nft-price' || n.kind === 'nft-availability')
    if (relevant.length === 0) return
    for (const notice of relevant) {
      if (notice.at >= mountedAt - TOAST_GRACE_MS) {
        toast.info(notice.message, { id: notice.id })
      }
      dismissNotice(notice.id)
    }
    setRecent((prev) => [...prev, ...relevant].slice(-MAX_VISIBLE))
    onUpdateRef.current?.()
  }, [notices, mountedAt])

  return { notices: recent, clear: () => setRecent([]) }
}

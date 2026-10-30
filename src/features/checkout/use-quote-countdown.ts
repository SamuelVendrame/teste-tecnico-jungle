import { useEffect, useRef, useState } from 'react'

/**
 * Segundos restantes até `expiresAt` (atualiza a cada 1 s). Ao chegar a zero
 * chama `onExpire` uma única vez por cotação: o checkout refaz a cotação em vez
 * de deixar o usuário confirmar com uma que o servidor rejeitaria.
 */
export function useQuoteCountdown(expiresAt: string | undefined, onExpire: () => void) {
  const [now, setNow] = useState(() => Date.now())
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  })
  const firedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [expiresAt])

  const remaining = expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)) : null

  useEffect(() => {
    if (remaining === 0 && expiresAt && firedFor.current !== expiresAt) {
      firedFor.current = expiresAt
      onExpireRef.current()
    }
  }, [remaining, expiresAt])

  return remaining
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

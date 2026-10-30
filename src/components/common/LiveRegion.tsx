import { useEffect, useState } from 'react'

import { subscribeAnnouncements } from './announce'

/**
 * Região aria-live visualmente oculta. Recebe mensagens via `announce()`.
 * A mensagem é limpa antes de ser regravada para que anúncios repetidos
 * (ex.: "9 resultados encontrados" duas vezes) sejam lidos de novo.
 */
export function LiveRegion() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    let frame = 0
    const unsubscribe = subscribeAnnouncements((next) => {
      setMessage('')
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setMessage(next))
    })
    return () => {
      cancelAnimationFrame(frame)
      unsubscribe()
    }
  }, [])

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}

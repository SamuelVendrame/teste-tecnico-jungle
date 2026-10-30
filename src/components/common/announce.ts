/**
 * Anúncios para leitores de tela (região aria-live única, montada no shell).
 * Use para resultados assíncronos: "N resultados encontrados", favorito salvo,
 * item adicionado ao carrinho etc.
 */
type Listener = (message: string) => void

const listeners = new Set<Listener>()

export function announce(message: string) {
  listeners.forEach((listener) => listener(message))
}

export function subscribeAnnouncements(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

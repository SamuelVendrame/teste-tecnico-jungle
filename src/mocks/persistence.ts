/**
 * Persistência local da camada de mocks. Tudo passa por aqui para que:
 * - fora do navegador (Node, smoke test) a persistência vire no-op;
 * - quota excedida ou storage bloqueado nunca derrube um handler.
 */

export const STORAGE_KEYS = {
  db: 'kurio:mockdb',
  scenario: 'kurio:scenario',
  scenarioRuntime: 'kurio:scenario-runtime',
} as const

/** Incremente ao mudar o shape do banco: dados antigos são descartados e o seed é recriado. */
export const DB_SCHEMA_VERSION = 2 // 2: NFT ganhou `rating` (avaliações)

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return null
    }
    return localStorage
  } catch {
    return null
  }
}

export function readRaw(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeRaw(key: string, value: string): boolean {
  try {
    const s = storage()
    if (!s) return false
    s.setItem(key, value)
    return true
  } catch (error) {
    console.warn(`[mocks] não foi possível persistir ${key}`, error)
    return false
  }
}

export function removeRaw(key: string): void {
  try {
    storage()?.removeItem(key)
  } catch {
    // storage indisponível: nada a remover
  }
}

export function readJson<T>(key: string): T | null {
  const raw = readRaw(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  return writeRaw(key, JSON.stringify(value))
}

/** Escuta alterações feitas por outra aba (evento `storage`). No-op fora do navegador. */
export function onExternalChange(key: string, listener: (raw: string | null) => void): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  window.addEventListener('storage', (event) => {
    if (event.key === key) listener(event.newValue)
  })
}

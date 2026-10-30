/**
 * Utilitários puros da camada de mocks: PRNG com semente, SHA-256 via Web Crypto,
 * serialização estável (base de hashes determinísticos) e geração de ids.
 */

/** PRNG mulberry32: mesma semente, mesma sequência. Nunca usamos Math.random. */
export function createPrng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    /** Inteiro uniforme em [min, max]. */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)]
      if (item === undefined) throw new Error('pick() em lista vazia')
      return item
    },
  }
}
export type Prng = ReturnType<typeof createPrng>

const encoder = new TextEncoder()

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Hash de senha: SHA-256 de `salt:senha`. O salt é o id do usuário. Nunca guardamos em claro. */
export function hashPassword(userId: string, password: string): Promise<string> {
  return sha256Hex(`${userId}:${password}`)
}

/** JSON com chaves ordenadas, para que o mesmo conteúdo gere sempre o mesmo hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function clone<T>(value: T): T {
  return structuredClone(value)
}

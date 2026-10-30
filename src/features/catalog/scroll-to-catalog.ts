export const CATALOG_SECTION_ID = 'catalogo'
export const CATALOG_HEADING_ID = 'catalogo-titulo'

/**
 * Rola até o catálogo e move o foco para o título dele (usuários de teclado e
 * leitor de tela continuam a partir dos resultados). Sem animação quando o
 * usuário prefere movimento reduzido.
 */
export function scrollToCatalog() {
  const section = document.getElementById(CATALOG_SECTION_ID)
  if (!section) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  document.getElementById(CATALOG_HEADING_ID)?.focus({ preventScroll: true })
}

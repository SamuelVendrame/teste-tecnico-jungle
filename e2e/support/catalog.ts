/**
 * Helpers do catálogo compartilhados entre os specs. Escondem a diferença entre
 * desktop (busca no header, filtros na sidebar) e mobile (busca na própria
 * página, filtros e ordenação dentro do Sheet).
 */
import type { Locator, Page } from '@playwright/test'

import { expect, parseEth } from '../fixtures'

/** Lista de resultados: o aria-label traz o total ("45 NFTs, página 1 de 5"). */
export function resultsList(page: Page): Locator {
  // CSS em vez de getByRole: com o Sheet aberto o Radix marca o resto da página como aria-hidden.
  return page.locator('ul[aria-label*="NFTs, página"]')
}

export function cards(page: Page): Locator {
  return resultsList(page).locator('article')
}

/** Espera a lista terminar de (re)carregar e devolve o texto de contagem. */
export async function settledCount(page: Page): Promise<string> {
  const list = resultsList(page)
  await expect(list).toBeVisible()
  await expect(list).not.toHaveAttribute('aria-busy', 'true')
  return (await list.getAttribute('aria-label')) ?? ''
}

export async function cardNames(page: Page): Promise<string[]> {
  await settledCount(page)
  return cards(page).locator('h3').allTextContents()
}

export async function cardPrices(page: Page): Promise<number[]> {
  await settledCount(page)
  // O primeiro <data> de cada card é o preço atual (o segundo, quando há, é o riscado).
  const texts = await cards(page).locator('p > data').allTextContents()
  return texts.map((text) => parseEth(text))
}

/** Busca por texto: ícone no header (desktop) ou campo da página (mobile). */
export async function searchFor(page: Page, isMobile: boolean, text: string) {
  if (isMobile) {
    await page.getByRole('searchbox', { name: 'Explorar coleções' }).fill(text)
    return
  }
  await page.getByRole('button', { name: 'Buscar NFTs' }).click()
  await page.getByRole('searchbox', { name: /Buscar NFTs por nome/ }).fill(text)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
}

/** Abre os filtros: no mobile o Sheet; no desktop a sidebar já está visível. */
export async function openFilters(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.getByRole('complementary', { name: 'Filtros do catálogo' })
  await page.getByRole('button', { name: 'Abrir filtros' }).click()
  const sheet = page.getByRole('dialog', { name: 'Filtros' })
  await expect(sheet).toBeVisible()
  return sheet
}

export async function closeFilters(page: Page, isMobile: boolean) {
  if (!isMobile) return
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeHidden()
}

/** Ordena pelo Select (na toolbar no desktop, no Sheet no mobile). */
export async function sortBy(page: Page, isMobile: boolean, label: string) {
  const scope = isMobile ? await openFilters(page, true) : page
  await scope.getByRole('combobox', { name: 'Ordenar por:' }).click()
  await page.getByRole('option', { name: label }).click()
  await closeFilters(page, isMobile)
}

/**
 * Search params da URL atual. O TanStack Router serializa arrays e números como
 * JSON (`collection=["arte-3d"]`, `page=2`), então cada valor é decodificado.
 */
export function urlState(page: Page): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  new URL(page.url()).searchParams.forEach((value, key) => {
    try {
      out[key] = JSON.parse(value)
    } catch {
      out[key] = value
    }
  })
  return out
}

/** Botão de filtro (coleção ou rede) dentro do escopo devolvido por openFilters. */
export function filterOption(scope: Locator | Page, label: string): Locator {
  return scope.getByRole('button', { name: new RegExp(`^${label}(?!\\w)`) })
}

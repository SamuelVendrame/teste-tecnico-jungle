import type { Locator, Page } from '@playwright/test'

import { expect, loginViaApi, mockControl, resetMocks, test, waitForSocket } from './fixtures'
import { cards, settledCount } from './support/catalog'
import {
  EMERALD,
  SAGE,
  cartLine,
  cartSummary,
  lineTotal,
  seedCart,
  settledTotals,
  totalsValue,
  type SeedNft,
} from './support/cart'
import {
  confirmButton,
  expectOrderHeld,
  fillCollector,
  holdOrdersPending,
  orderCounts,
  orderIdFromUrl,
  readLines,
  readTotals,
  releaseHeldOrders,
  reviewSection,
  selectAndConnectWallet,
  settledQuoteTotal,
  trackOrderPosts,
} from './support/checkout'

/**
 * Tempo real: todos os eventos passam pelo socket.io-client da página. Mudanças
 * de dados usam `/__mock/nfts/:id/update` (o mock grava e emite `nft.updated`);
 * duplicatas, versões antigas e eventos de outro usuário são injetados crus com
 * `/__mock/socket/emit` para provar que o CLIENTE os descarta.
 */

interface ApiNft {
  id: string
  version: number
  priceEth: string
  editions: { id: string; priceEth: string; available: number }[]
}

async function fetchNft(page: Page, nft: SeedNft): Promise<ApiNft> {
  return page.evaluate(async (slug) => {
    const res = await fetch(`/api/nfts/${slug}`)
    return (await res.json()) as ApiNft
  }, nft.slug)
}

/** Payload válido de `nft.updated` (contrato `nftUpdatedEvent`) com um novo preço. */
function nftUpdated(nft: ApiNft, opts: { eventId: string; version: number; priceEth: string }) {
  return {
    type: 'nft.updated',
    eventId: opts.eventId,
    emittedAt: new Date().toISOString(),
    resource: { kind: 'nft', id: nft.id },
    version: opts.version,
    payload: {
      priceEth: opts.priceEth,
      compareAtPriceEth: null,
      editions: nft.editions.map((e) => ({ ...e, priceEth: opts.priceEth })),
    },
  }
}

async function emit(page: Page, event: { type: string } & Record<string, unknown>) {
  const { delivered } = await mockControl<{ delivered: number }>(page, 'socket/emit', {
    event: event.type,
    payload: event,
  })
  expect(delivered).toBeGreaterThanOrEqual(1)
}

/** Marca a página: se ela recarregar, a marca some (prova de atualização sem reload). */
async function markPage(page: Page) {
  await page.evaluate(() => {
    ;(window as unknown as { __noReload?: boolean }).__noReload = true
  })
}

async function expectNotReloaded(page: Page) {
  expect(
    await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
  ).toBe(true)
}

function catalogCardPrice(page: Page, name: string): Locator {
  return cards(page)
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .locator('p > data')
    .first()
}

test.describe('Tempo real: alteração durante a compra', () => {
  test('alteração de preço durante o checkout exige revisão e o pedido usa o preço novo', async ({
    page,
  }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await seedCart(page, [{ nft: EMERALD }])
    await page.goto('/checkout')
    await fillCollector(page)
    await selectAndConnectWallet(page)
    expect(await settledQuoteTotal(page)).toBe('1.1921')
    await waitForSocket(page, { userId: 'usr_ana' })
    await markPage(page)

    // O mock grava o preço novo e emite nft.updated pelo socket.
    await mockControl(page, `nfts/${EMERALD.id}/update`, { priceEth: '1.75' })

    // A cotação revisada ficou velha: o checkout trava e pede nova revisão.
    const dialog = page.getByRole('dialog', { name: 'A cotação mudou' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Novo total')).toBeVisible()
    await expect(dialog.locator('data')).toHaveAttribute('value', '1.7521')
    await dialog.getByRole('button', { name: 'Revisar e confirmar' }).click()
    await expect(dialog).toBeHidden()

    const banner = page.getByRole('status').filter({ hasText: 'Preços atualizados' })
    await expect(banner).toContainText(
      `O preço de ${EMERALD.name} (${EMERALD.edition}) mudou de 1.19 ETH para 1.75 ETH.`,
    )
    expect(await settledQuoteTotal(page)).toBe('1.7521')
    const reviewedLines = await readLines(reviewSection(page).locator('ul').first())
    expect(reviewedLines).toEqual([{ name: EMERALD.name, quantity: '1', totalEth: '1.75' }])
    await expectNotReloaded(page)

    await expect(confirmButton(page)).toBeEnabled()
    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible()

    // O recibo é o snapshot com o preço novo.
    const receipt = page.getByRole('article')
    expect(await readLines(receipt.locator('ul').first())).toEqual(reviewedLines)
    expect((await readTotals(receipt.locator('dl[aria-busy]'))).Total).toBe('1.7521')
  })

  test('no carrinho, a alteração de preço atualiza o resumo ao vivo', async ({ page }) => {
    await resetMocks(page)
    await seedCart(page, [{ nft: EMERALD }, { nft: SAGE }])
    await page.goto('/cart')
    const summary = cartSummary(page)
    await expect(cartLine(page, SAGE)).toBeVisible()
    await settledTotals(summary)
    await expect(totalsValue(summary, 'Subtotal')).toHaveText('3.64 ETH')
    await waitForSocket(page)
    await markPage(page)

    await mockControl(page, `nfts/${EMERALD.id}/update`, { priceEth: '1.75' })

    await expect(page.getByRole('status').filter({ hasText: 'Preços atualizados' })).toContainText(
      `O preço de ${EMERALD.name} (${EMERALD.edition}) mudou de 1.19 ETH para 1.75 ETH.`,
    )
    await expect(lineTotal(cartLine(page, EMERALD))).toHaveText('1.75 ETH')
    await settledTotals(summary)
    await expect(totalsValue(summary, 'Subtotal')).toHaveText('4.2 ETH')
    await expect(totalsValue(summary, 'Total')).toHaveText('4.2021 ETH')
    await expectNotReloaded(page)
  })
})

test.describe('Tempo real: robustez', () => {
  test('eventos duplicados e com versão antiga são descartados no catálogo', async ({ page }) => {
    await resetMocks(page)
    await settledCount(page)
    await waitForSocket(page)
    const emerald = await fetchNft(page, EMERALD)
    const sage = await fetchNft(page, SAGE)
    const emeraldPrice = catalogCardPrice(page, EMERALD.name)
    const sagePrice = catalogCardPrice(page, SAGE.name)
    await expect(emeraldPrice).toHaveText('1.19 ETH')
    await expect(sagePrice).toHaveText('2.45 ETH')

    // Versão bem à frente (+5): aplicado.
    const first = nftUpdated(emerald, {
      eventId: 'e2e-evt-emerald-1',
      version: emerald.version + 5,
      priceEth: '3.33',
    })
    await emit(page, first)
    await expect(emeraldPrice).toHaveText('3.33 ETH')

    // Mesmo eventId de novo (com outro preço e versão maior): duplicata, ignorada.
    await emit(
      page,
      nftUpdated(emerald, {
        eventId: first.eventId,
        version: emerald.version + 6,
        priceEth: '4.44',
      }),
    )
    // Sentinela: os eventos chegam em ordem; quando este aparece, o anterior já foi tratado.
    await emit(
      page,
      nftUpdated(sage, { eventId: 'e2e-evt-sage-1', version: sage.version + 1, priceEth: '2.50' }),
    )
    await expect(sagePrice).toHaveText('2.5 ETH')
    await expect(emeraldPrice).toHaveText('3.33 ETH')

    // Versão menor que a aceita (v+2 < v+5): ignorada, o preço não regride.
    await emit(
      page,
      nftUpdated(emerald, {
        eventId: 'e2e-evt-emerald-old',
        version: emerald.version + 2,
        priceEth: '0.55',
      }),
    )
    await emit(
      page,
      nftUpdated(sage, { eventId: 'e2e-evt-sage-2', version: sage.version + 2, priceEth: '2.60' }),
    )
    await expect(sagePrice).toHaveText('2.6 ETH')
    await expect(emeraldPrice).toHaveText('3.33 ETH')
  })

  test('evento duplicado não gera um segundo aviso no carrinho', async ({ page }) => {
    await resetMocks(page)
    await seedCart(page, [{ nft: EMERALD }, { nft: SAGE }])
    await page.goto('/cart')
    await expect(cartLine(page, SAGE)).toBeVisible()
    await settledTotals(cartSummary(page))
    await waitForSocket(page)
    const emerald = await fetchNft(page, EMERALD)
    const sage = await fetchNft(page, SAGE)

    const event = nftUpdated(emerald, {
      eventId: 'e2e-evt-cart-1',
      version: emerald.version + 5,
      priceEth: '1.50',
    })
    const message = `O preço de ${EMERALD.name} (${EMERALD.edition}) mudou de 1.19 ETH para 1.5 ETH.`
    const banner = page.getByRole('status').filter({ hasText: 'Preços atualizados' })

    await emit(page, event)
    await expect(banner.getByRole('listitem')).toHaveText([message])

    await emit(page, event)
    // Sentinela em outro item: quando o aviso dele aparece, a duplicata já foi descartada.
    await emit(
      page,
      nftUpdated(sage, { eventId: 'e2e-evt-cart-2', version: sage.version + 1, priceEth: '2.50' }),
    )
    await expect(banner.getByRole('listitem')).toHaveText([
      message,
      `O preço de ${SAGE.name} (${SAGE.edition}) mudou de 2.45 ETH para 2.5 ETH.`,
    ])
    await expect(page.getByText(message)).toHaveCount(2) // banner + um único toast
  })

  test('order.updated de outro usuário é ignorado; só a resolução real confirma', async ({
    page,
  }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await seedCart(page, [{ nft: EMERALD }])
    await page.goto('/checkout')
    await fillCollector(page)
    await selectAndConnectWallet(page)
    await settledQuoteTotal(page)
    await waitForSocket(page, { userId: 'usr_ana' })
    await holdOrdersPending(page)

    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const orderId = orderIdFromUrl(page)
    const pendingTitle = page.getByRole('heading', { name: 'Aguardando confirmação da rede…' })
    await expect(pendingTitle).toBeVisible()
    await expect.poll(async () => (await orderCounts(page)).pendingOrders).toBe(1)
    await expectOrderHeld(page, orderId)

    await emit(page, {
      type: 'order.updated',
      eventId: 'e2e-evt-order-bruno',
      emittedAt: new Date().toISOString(),
      resource: { kind: 'order', id: orderId },
      userId: 'usr_bruno',
      version: 99,
      payload: {
        status: 'confirmed',
        txHash: `0x${'ab'.repeat(32)}`,
        explorerUrl: `https://etherscan.io/tx/0x${'ab'.repeat(32)}`,
        declineReason: null,
      },
    })
    await page.waitForTimeout(500)
    await expect(pendingTitle).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toHaveCount(0)

    await mockControl(page, `orders/${orderId}/resolve`, { status: 'confirmed' })
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible()
    // O hash exibido é o do servidor, não o do evento forjado.
    await expect(page.locator('[title^="0x"]')).not.toHaveAttribute('title', `0x${'ab'.repeat(32)}`)
  })

  test('reconexão do socket reconcilia com o REST a mudança perdida, sem reload', async ({
    page,
  }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await settledCount(page)
    await waitForSocket(page, { userId: 'usr_ana' })
    const emeraldPrice = catalogCardPrice(page, EMERALD.name)
    await expect(emeraldPrice).toHaveText('1.19 ETH')
    await markPage(page)

    // Derruba o socket e, antes de o cliente reconectar (backoff >= 250 ms), muda o
    // preço no servidor: o `nft.updated` sai sem nenhuma conexão e se perde.
    const offline = await page.evaluate(async (id) => {
      const post = (url: string, body: unknown) =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then((res) => res.json() as Promise<Record<string, unknown>>)
      const { closed } = await post('/__mock/socket/disconnect', {})
      await post(`/__mock/nfts/${id}/update`, { priceEth: '2.22' })
      const state = (await fetch('/__mock/socket/state').then((res) => res.json())) as {
        connected: number
      }
      return { closed: closed as number, connectedAfterUpdate: state.connected }
    }, EMERALD.id)
    expect(offline.closed).toBeGreaterThanOrEqual(1)
    // Ninguém estava conectado quando o evento foi emitido: ele não foi entregue.
    expect(offline.connectedAfterUpdate).toBe(0)

    // O cliente reconecta sozinho e invalida as queries ativas (['nfts'] etc.).
    await waitForSocket(page, { userId: 'usr_ana' })
    await expect(emeraldPrice).toHaveText('2.22 ETH')
    await expectNotReloaded(page)
  })

  test('queda do socket com pedido pendente: o reload recupera o pedido sem duplicar', async ({
    page,
  }) => {
    await resetMocks(page)
    await loginViaApi(page, 'ana')
    await seedCart(page, [{ nft: EMERALD }])
    await page.goto('/checkout')
    await fillCollector(page)
    await selectAndConnectWallet(page)
    await settledQuoteTotal(page)
    await waitForSocket(page, { userId: 'usr_ana' })
    await holdOrdersPending(page)
    const posts = trackOrderPosts(page)

    await confirmButton(page).click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const orderId = orderIdFromUrl(page)
    const pendingTitle = page.getByRole('heading', { name: 'Aguardando confirmação da rede…' })
    await expect(pendingTitle).toBeVisible()
    await expect.poll(async () => (await orderCounts(page)).pendingOrders).toBe(1)
    await expectOrderHeld(page, orderId)

    const { closed } = await mockControl<{ closed: number }>(page, 'socket/disconnect', {})
    expect(closed).toBeGreaterThanOrEqual(1)

    // Recarrega com o pedido ainda pendente: o estado vem do REST.
    await page.reload()
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`))
    await expect(pendingTitle).toBeVisible()
    await waitForSocket(page, { userId: 'usr_ana' })

    // O mock resolve o pedido (relógio da API avançado além do adiamento).
    await releaseHeldOrders(page)
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible()

    expect(posts).toHaveLength(1)
    expect((await orderCounts(page)).orders).toBe(2)
    await page.goto('/profile#pedidos')
    const orders = page.getByRole('region', { name: 'Pedidos' })
    await expect(orders.getByRole('link', { name: /^Ver pedido / })).toHaveCount(2)
    await expect(orders.getByRole('link', { name: `Ver pedido ${orderId}` })).toBeVisible()
    await waitForSocket(page, { userId: 'usr_ana' })
  })
})

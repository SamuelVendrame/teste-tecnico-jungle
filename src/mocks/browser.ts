/**
 * Ponto de entrada da camada de mocks no navegador.
 * Stub inicial: só garante o build até os handlers REST e Socket.IO entrarem.
 */
import { setupWorker } from 'msw/browser'

export const worker = setupWorker()

export async function startMocks() {
  await worker.start({ onUnhandledRequest: 'bypass' })
}

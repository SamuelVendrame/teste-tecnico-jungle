#!/usr/bin/env node
/**
 * Regressão visual no ambiente de referência: a imagem oficial do Playwright
 * (Linux, Chromium e fontes fixos), na mesma versão do lockfile.
 *
 * Screenshots dependem da renderização de fonte do sistema operacional; uma
 * baseline gerada no Windows não bate no Linux nem no macOS. Rodando sempre no
 * mesmo container, as baselines de `e2e/__screenshots__` valem em qualquer
 * máquina com Docker.
 *
 *   npm run test:visual           compara com as baselines
 *   npm run test:visual:update    regera as baselines
 *
 * O node_modules do container é um tmpfs (instalado a cada execução com `npm ci`):
 * não reaproveita nem suja o node_modules do host, que pode ser de outro SO.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
const version = lock.packages['node_modules/@playwright/test'].version
const image = `mcr.microsoft.com/playwright:v${version}-noble`

const update = process.argv.includes('--update')
const extra = process.argv.slice(2).filter((arg) => arg !== '--update')
const testCmd = [
  'npx playwright test e2e/visual.spec.ts',
  update ? '--update-snapshots=all' : '',
  ...extra,
]
  .filter(Boolean)
  .join(' ')

const args = [
  'run',
  '--rm',
  '--ipc=host',
  '-v',
  `${process.cwd()}:/work`,
  '--tmpfs',
  '/work/node_modules:exec,mode=1777',
  '-w',
  '/work',
  '-e',
  'PW_VISUAL=1',
  '-e',
  'HOME=/tmp',
]
// Linux/macOS: arquivos gerados (baselines, relatórios) ficam com o dono do host, não root.
if (typeof process.getuid === 'function')
  args.push('--user', `${process.getuid()}:${process.getgid()}`)
args.push(image, 'bash', '-c', `npm ci --no-audit --no-fund --loglevel=error && ${testCmd}`)

console.log(`> ${image}\n> ${testCmd}`)
const result = spawnSync('docker', args, { stdio: 'inherit' })
if (result.error) {
  console.error(`Não foi possível executar o Docker: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)

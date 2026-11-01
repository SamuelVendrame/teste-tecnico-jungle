/**
 * Auditoria Lighthouse reproduzível.
 *
 * Roda 3 medições por página e perfil contra o build de produção servido por
 * `vite preview` (porta 4173, mocks ativos), calcula a mediana por categoria e
 * salva relatórios HTML/JSON e um resumo em lighthouse/reports/.
 *
 * Uso: npm run build && npm run lighthouse
 * Variáveis: LH_BASE_URL (padrão http://localhost:4173), LH_RUNS (padrão 3)
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'

const require = createRequire(import.meta.url)
const BASE_URL = process.env.LH_BASE_URL ?? 'http://localhost:4173'
const RUNS = Number(process.env.LH_RUNS ?? 3)
const OUT_DIR = path.resolve('lighthouse/reports')
const CONFIG_PATH = path.resolve('lighthouse/config.json')

const PAGES = [
  { id: 'home', path: '/' },
  { id: 'nft-detail', path: '/nft/emerald-ape-042' },
]
const PROFILES = ['mobile', 'desktop']
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

function median(values) {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))

  let preview = null
  try {
    await fetch(BASE_URL)
  } catch {
    preview = spawn('npm', ['run', 'preview', '--', '--port', '4173', '--strictPort'], {
      shell: true,
      stdio: 'ignore',
      env: { ...process.env, VITE_ENABLE_MSW: 'true' },
    })
    await waitForServer(BASE_URL)
  }

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] })
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    runs: RUNS,
    tools: {
      lighthouse: require('lighthouse/package.json').version,
      node: process.version,
      chrome: chrome.process?.spawnargs?.[0] ?? 'chrome-launcher',
      platform: `${process.platform} ${process.arch}`,
    },
    results: [],
  }

  try {
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const url = `${BASE_URL}${page.path}`
        const scores = Object.fromEntries(CATEGORIES.map((c) => [c, []]))
        const metrics = { lcp: [], cls: [], tbt: [] }
        for (let run = 1; run <= RUNS; run++) {
          const result = await lighthouse(
            url,
            { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
            {
              ...config,
              settings: {
                ...config.settings,
                formFactor: profile,
                screenEmulation:
                  profile === 'desktop'
                    ? {
                        mobile: false,
                        width: 1440,
                        height: 900,
                        deviceScaleFactor: 1,
                        disabled: false,
                      }
                    : {
                        mobile: true,
                        width: 412,
                        height: 823,
                        deviceScaleFactor: 1.75,
                        disabled: false,
                      },
                throttling:
                  profile === 'desktop'
                    ? { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }
                    : config.settings.throttling,
              },
            },
          )
          const lhr = result.lhr
          // Versão real do Chrome usado (o launcher só conhece o executável).
          summary.tools.chrome =
            lhr.environment?.hostUserAgent?.match(/(?:Headless)?Chrome\/[\d.]+/)?.[0] ??
            summary.tools.chrome
          for (const c of CATEGORIES)
            scores[c].push(Math.round((lhr.categories[c]?.score ?? 0) * 100))
          metrics.lcp.push(lhr.audits['largest-contentful-paint'].numericValue)
          metrics.cls.push(lhr.audits['cumulative-layout-shift'].numericValue)
          metrics.tbt.push(lhr.audits['total-blocking-time'].numericValue)
          const base = path.join(OUT_DIR, `${page.id}-${profile}-run${run}`)
          await writeFile(`${base}.html`, result.report[0])
          await writeFile(`${base}.json`, result.report[1])
          console.log(
            `${page.id} ${profile} run ${run}:`,
            CATEGORIES.map((c) => `${c}=${scores[c].at(-1)}`).join(' '),
          )
        }
        summary.results.push({
          page: page.id,
          url,
          profile,
          median: Object.fromEntries(CATEGORIES.map((c) => [c, median(scores[c])])),
          runs: scores,
          metricsMedian: {
            lcpMs: Math.round(median(metrics.lcp)),
            cls: Number(median(metrics.cls).toFixed(3)),
            tbtMs: Math.round(median(metrics.tbt)),
          },
        })
      }
    }
  } finally {
    await chrome.kill()
    preview?.kill()
  }

  await writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  const md = [
    `# Lighthouse — resumo (${summary.generatedAt})`,
    '',
    `Lighthouse ${summary.tools.lighthouse} · ${summary.tools.chrome} · Node ${summary.tools.node} · ${summary.tools.platform} · ${RUNS} medições por página/perfil, mediana reportada.`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...summary.results.map(
      (r) =>
        `| ${r.page} | ${r.profile} | ${r.median.performance} | ${r.median.accessibility} | ${r.median['best-practices']} | ${r.median.seo} | ${r.metricsMedian.lcpMs} | ${r.metricsMedian.cls} | ${r.metricsMedian.tbtMs} |`,
    ),
    '',
  ].join('\n')
  await writeFile(path.join(OUT_DIR, 'SUMMARY.md'), md)
  console.log('\n' + md)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

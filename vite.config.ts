import path from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type HtmlTagDescriptor, type Plugin, type Rollup } from 'vite'

/** Arquivo de rota do TanStack Router -> regex do pathname (`nft.$slug` -> `^/nft/[^/]+/?$`). */
function routePattern(file: string): string {
  const segments = file
    .split('.')
    .filter((s) => s !== 'index')
    .map((s) => (s.startsWith('$') ? '[^/]+' : s))
  return `^/${segments.join('/')}/?$`.replace('//?$', '/?$')
}

/**
 * Antecipa os chunks que o navegador só descobriria em série, depois de executar o JS:
 *
 * - Mocks: `src/mocks/browser.ts` é importado dinamicamente pelo main.tsx e toda
 *   requisição de dados espera o MSW. Vai como `modulepreload` fixo no HTML.
 * - Rota atual: o component de cada rota é code-split. Um script inline lê o
 *   `location.pathname` e pré-carrega só o chunk da rota aberta (a SPA serve o
 *   mesmo index.html para todas).
 *
 * Em ambos, entram também os imports estáticos do chunk que o HTML ainda não carrega.
 */
function preloadCriticalChunks(): Plugin {
  return {
    name: 'kurio:preload-critical-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const chunks = Object.values(ctx.bundle ?? {}).filter(
          (item): item is Rollup.OutputChunk => item.type === 'chunk',
        )
        const byFile = new Map(chunks.map((c) => [c.fileName, c]))
        const closure = (start: Rollup.OutputChunk, skip: Set<string>) => {
          const out: string[] = []
          const visit = (c: Rollup.OutputChunk | undefined) => {
            if (!c || skip.has(c.fileName) || out.includes(c.fileName)) return
            out.push(c.fileName)
            c.imports.forEach((f) => visit(byFile.get(f)))
          }
          visit(start)
          return out
        }

        const entry = chunks.find((c) => c.isEntry)
        const loaded = new Set(entry ? closure(entry, new Set()) : [])
        const tags: HtmlTagDescriptor[] = []

        const mocks = chunks.find((c) => c.facadeModuleId?.endsWith('/src/mocks/browser.ts'))
        if (mocks) {
          for (const file of closure(mocks, loaded)) {
            loaded.add(file)
            tags.push({
              tag: 'link',
              attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
              injectTo: 'head',
            })
          }
        }

        const routes: Array<[string, string[]]> = []
        for (const c of chunks) {
          const match = c.facadeModuleId?.match(
            /\/src\/routes\/([^/]+)\.tsx\?tsr-split=component\b/,
          )
          if (match) routes.push([routePattern(match[1]), closure(c, loaded).map((f) => `/${f}`)])
        }
        if (routes.length > 0) {
          tags.push({
            tag: 'script',
            children:
              `(function(){var r=${JSON.stringify(routes)},p=location.pathname;` +
              'for(var i=0;i<r.length;i++)if(new RegExp(r[i][0]).test(p)){' +
              'r[i][1].forEach(function(h){var l=document.createElement("link");' +
              'l.rel="modulepreload";l.crossOrigin="";l.href=h;document.head.appendChild(l)});break}})()',
            injectTo: 'head',
          })
        }
        return tags
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // O skeleton (pendingComponent) mora no mesmo arquivo da página: separado do
      // component, ele arrastava a página inteira (e o react-hook-form) para o bundle
      // inicial. Juntos, os dois carregam no chunk da rota.
      codeSplittingOptions: {
        defaultBehavior: [
          ['component', 'pendingComponent'],
          ['errorComponent'],
          ['notFoundComponent'],
        ],
      },
    }),
    react(),
    tailwindcss(),
    preloadCriticalChunks(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Bibliotecas do shell num chunk só. Sem isso, cada hook do Router/Query
              // compartilhado com uma rota lazy vira um arquivo de poucos KB, e o
              // HTML pré-carregava ~20 deles, que em HTTP/1.1 (6 conexões) entram
              // em fila. Radix fica de fora: boa parte dele só é usada em rotas lazy.
              name: 'shell',
              test: /node_modules[\\/](react|react-dom|scheduler|@tanstack|axios|sonner|lucide-react|zod|clsx|tailwind-merge|class-variance-authority)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})

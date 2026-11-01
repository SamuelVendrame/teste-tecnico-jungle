# Auditoria Lighthouse

## Como reproduzir

```bash
npm run build
npm run lighthouse        # sobe o preview na 4173 se não houver um, roda 3x por página/perfil
```

- Configuração versionada em [`config.json`](./config.json) (throttling simulado padrão do Lighthouse: RTT 150 ms, 1,6 Mbps, CPU 4x no mobile; desktop com RTT 40 ms, 10 Mbps, CPU 1x).
- Páginas: `/` e `/nft/emerald-ape-042`. Perfis: mobile (412×823, DPR 1,75) e desktop (1440×900).
- Cenário dos mocks: `default` (latência simulada de 150 a 450 ms por requisição, como na demo).
- Saída (tudo versionado): `reports/<página>-<perfil>-run<n>.html|json`, `reports/summary.json` e `reports/SUMMARY.md` com a mediana por categoria, LCP, CLS e TBT.
- Ferramentas e ambiente ficam gravados em `summary.json` (versão do Lighthouse, Node, plataforma).

## Resultado (mediana de 3 medições)

Ver [`reports/SUMMARY.md`](./reports/SUMMARY.md). Resumo da última execução:

| Página | Perfil | Performance | Accessibility | Best Practices | SEO |
| --- | --- | ---: | ---: | ---: | ---: |
| Início | mobile | 76 | 100 | 100 | 100 |
| Início | desktop | 99 | 100 | 100 | 100 |
| Detalhe | mobile | 84 | 100 | 100 | 100 |
| Detalhe | desktop | 99 | 100 | 100 | 100 |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Três das quatro categorias batem a meta em todos os perfis; **Performance no perfil mobile fica abaixo** (76 e 84).

## Por que o mobile fica abaixo de 90

O único audit de performance reprovado é o **LCP** (4,4 a 5,2 s simulados). FCP (0,9 s), TBT (< 250 ms) e CLS (< 0,04) estão bons.

Causa, pelo detalhamento do próprio relatório (`lcp-breakdown-insight` em `reports/home-mobile-run1.json`):

1. **O elemento de LCP é a primeira imagem do catálogo** (175×175 px no mobile), maior que a arte do hero mobile (138 px, definida pelo Figma). O tempo de rede da imagem é desprezível (está pré-carregada e em cache, 15 KB); quase todo o LCP é "element render delay", ou seja, o tempo até o card existir no DOM.
2. O card só existe depois da cadeia: download e execução do JS pré-carregado pelo `index.html` (medido no `dist/` com gzip: ~240 KB sem os mocks, sendo o chunk `shell` 168 KB e o da app 47 KB, mais ~170 KB do chunk dos mocks; CPU 4x mais lento no perfil simulado) → registro do Service Worker do MSW (o Lighthouse limpa o storage a cada medição, então o worker é instalado do zero) → `GET /api/nfts` com a latência simulada do cenário padrão → render. Essa cadeia é inerente à proposta de rodar o backend inteiro dentro do navegador; num backend real o Service Worker não existiria.
3. Com throttling aplicado de verdade (`throttlingMethod: devtools`) o resultado é pior ainda (FCP 6,2 s), o que confirma que o peso do JS inicial é o fator dominante, não a modelagem do simulador.

O que já foi feito para reduzir o LCP (ver commit `perf:` no histórico):

- A app renderiza imediatamente com skeletons; o Axios e o socket esperam `mocksReady` em vez de o React esperar o worker.
- A arte do primeiro destaque é renderizada antes da API responder e pré-carregada no `index.html` (`<link rel="preload" as="image" fetchpriority="high">`).
- Os três primeiros cards do catálogo carregam com `fetchpriority="high"` e sem `loading="lazy"`.
- Imagens em WebP (800 e 400 px, ~50 KB e ~15 KB) em vez dos PNGs de 2 MB do Figma; fonte self-hosted só no subset latin; rotas com code splitting.
- O skeleton do detalhe passou a reservar a altura das abas e dos relacionados: CLS do footer no desktop caiu de 0,18 para 0.
- O `pendingComponent` das rotas carrega no mesmo chunk do `component` (`codeSplittingOptions` no `vite.config.ts`). Antes, o skeleton exportado do arquivo da página puxava a página inteira (e o `react-hook-form`) para o bundle inicial.
- As bibliotecas do shell (React, TanStack, Axios, Sonner, Lucide, Zod) ficam num chunk `shell`: o HTML deixou de pré-carregar ~20 arquivos de poucos KB, que em HTTP/1.1 (6 conexões no modelo do Lighthouse) entravam em fila.
- O chunk dos mocks e o da rota aberta são pré-carregados pelo HTML (plugin `preloadCriticalChunks` no `vite.config.ts`), em vez de só serem descobertos depois que o JS inicial executa.
- O painel de cenários de demonstração só carrega depois do `load`, sem disputar a rede com a primeira tela.

Efeito medido na mesma máquina (Windows, mediana de 3 medições antes e depois dos três últimos itens; os dois `summary.json` estão no histórico do git): LCP mobile caiu de 5,7 s para 5,2 s no início e de 5,1 s para 4,4 s no detalhe; Performance mobile do detalhe subiu de 81 para 84 e a do início foi de 78 para 76 (o ganho de LCP foi compensado por CLS 0,03 e TBT 247 ms, medidos com o navegador do desenvolvedor aberto na mesma máquina). A medição final inclui a aba de avaliações do detalhe. Não é suficiente para 90: o LCP continua preso à cadeia JS → Service Worker do MSW → API simulada descrita acima.

Próximos passos possíveis, não feitos: reduzir primitivas Radix no shell inicial e pré-renderizar a primeira página do catálogo em HTML estático no build (o que exigiria SSG e mudaria a arquitetura de SPA). Separar o `decimal.js` da formatação não encurta o caminho do LCP, porque os mocks, carregados no início, também dependem dele.

Nenhuma simplificação foi feita só para pontuar: a auditoria carrega as imagens, fontes e todas as funcionalidades da entrega, com os mocks e o socket ativos.

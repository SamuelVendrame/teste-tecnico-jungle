# Decisões tomadas durante a implementação

Registro cronológico. Cada item traz o motivo da escolha.

## Ferramental

- **Vite 8 + React 19 + TypeScript 7 (tsgo)** como base. Motivo: scaffold mais rápido, suporte nativo ao plugin do TanStack Router e à Vercel.
- **npm com package-lock.json** em vez de pnpm. Motivo: pnpm não estava instalado na máquina e o enunciado só exige lockfile.
- **MSW fixado em 2.15** (não 3.x). Motivo: `@mswjs/socket.io-binding@0.2.0` declara peer `msw@^2.10`. O MSW 3 saiu há pouco e o binding ainda não o suporta.
- **Tailwind v4** com `@tailwindcss/vite` e tokens via `@theme`. Motivo: sem `tailwind.config.js`, tokens do Figma viram variáveis CSS em `src/index.css`.
- **shadcn/ui estilo new-york**, tema único escuro mapeado sobre as cores do Figma. Não existe tema claro no layout, então `prefers-color-scheme` não é tratado.
- **oxlint** (veio no scaffold do Vite 8) em vez de ESLint. Motivo: zero configuração e muito mais rápido; cobre o requisito de "lint".
- **Prettier** para formatação.
- **Roteamento file-based** com `@tanstack/router-plugin` e `autoCodeSplitting`. Motivo: rotas tipadas geradas automaticamente, code splitting por rota ajuda no Lighthouse.
- **decimal.js** para valores em ETH. Motivo: enunciado exige strings decimais com precisão; `number` do JS perde precisão.
- **react-hook-form + zod** para formulários. Motivo: validação tipada compartilhada entre contrato da API e UI.

## Produto

- Fonte **Roboto Mono via Google Fonts self-hosted** (`@fontsource`), para não depender de rede externa no Lighthouse e no deploy.

## Testes e auditoria

- **Playwright roda contra o build de produção** (`vite preview` na 4173) com mocks ativos, não contra o dev server. Motivo: é o mesmo artefato do deploy; evita diferença entre dev e demo. Projetos `desktop` (1440) e `mobile` (Pixel 7, 390). `workers: 1` porque o estado do MSW vive no navegador e cada teste reseta via `?reset=1`.
- **Regressão visual** com `toHaveScreenshot`, `reducedMotion: 'reduce'`, animações desligadas e `maxDiffPixelRatio` 1%, baselines versionadas em `e2e/__screenshots__`, geradas e comparadas na imagem oficial do Playwright (`npm run test:visual`): a renderização de fonte muda entre sistemas operacionais, e uma baseline do Windows não bate no Linux nem no macOS.
- **Lighthouse via script Node** (`scripts/lighthouse.mjs`) com `lighthouse/config.json` versionado, 3 medições por página/perfil, mediana e relatórios HTML/JSON. Os relatórios HTML/JSON de cada medição são versionados junto com `SUMMARY.md` e `summary.json` (o enunciado pede a entrega dos relatórios; custo: ~18 MB no repositório, regenerados a cada `npm run lighthouse`).
- **Imagens dos NFTs convertidas para WebP** (800px e 400px) a partir dos PNGs de 1254px/2MB do Figma. Motivo: LCP e Performance ≥ 90. Isso é um desvio documentado de asset.

## Produto

- **Favoritos e Pedidos são seções de `/profile`** (`#favoritos`, `#pedidos`), não páginas próprias. Motivo: sem frame no Figma e sem tempo; o enunciado só exige que favoritos persistam e pedidos sejam consultáveis.
- **Avaliações com estrelas viraram "Atributos"** no detalhe. O contrato não tem rating; inventar dados fictícios de avaliação parecia pior do que trocar a aba.
- **Rede da cotação no carrinho = rede do primeiro item**; no checkout o usuário escolhe explicitamente.
- **Cotação é single-use** e tem `fingerprint`; o pedido envia o fingerprint revisado e a API recusa com `QUOTE_STALE` se algo mudou.
- **Idempotency-Key por tentativa de checkout**, guardada em sessionStorage e reutilizada em timeout/clique repetido; só gira após resposta definitiva.
- **Polling de 3s na página do pedido enquanto pendente**, além do socket. Rede de segurança para refresh e quedas.
- **Login desktop como modal sobre o marketplace** (como no Figma) usando o header real do shell atrás; mobile em página inteira.
- **Botão de carrinho extra no detalhe desktop**, espelhando a buy bar do mobile.
- **Consumo do carrinho após confirmação é "no máximo uma vez"**: `kurio:pending-order` é apagado antes do `POST /cart/consume`. Um refresh nessa janela de ~400 ms deixa o item no carrinho (inofensivo) em vez de arriscar subtrair duas vezes.

## Correções após revisão

- **Consumo do carrinho passou para o servidor simulado**: quando o pedido confirma, o mock remove as linhas compradas do carrinho do comprador antes de emitir `order.updated`; o cliente só invalida o cache. Substitui a decisão anterior de consumir pelo cliente ("no máximo uma vez"), que falhava se o usuário não estivesse na página do pedido.
- **Rascunho do checkout e pedido pendente são escopados por usuário** e apagados no logout. Motivo: revisão encontrou dados da Ana aparecendo no checkout do Bruno na mesma aba (item eliminatório).
- **Retry do TanStack Query corrigido**: o predicado checava `AxiosError`, mas o interceptor rejeita com `ApiClientError`; nunca havia retry. Agora `isTransient && !canceled`, 2 tentativas.
- **Mocks ligados por padrão** (`VITE_ENABLE_MSW` só desliga com `false`) e `.env.production` versionado. Motivo: build limpo na Vercel subiria sem mocks.
- **Conexão de carteira virou endpoint do mock** (`POST /wallets/:id/connect`, erro `WALLET_REFUSED`) em vez de `setTimeout` no componente.
- **Performance mobile ficou em 78/81** (meta 90). Causa e tentativas documentadas em `lighthouse/README.md`. Priorizei os fluxos; próximos passos possíveis: (separar decimal.js da formatação, enxugar Radix no shell).

# Decisões tomadas durante a implementação

Registro cronológico das escolhas que não estão óbvias no código, com o motivo de cada uma. Desvios do Figma e limitações conhecidas estão em `ARCHITECTURE.md`.

## Ferramental

- **Vite 8 + React 19 + TypeScript 7 (tsgo)** como base. Motivo: scaffold rápido, suporte nativo ao plugin do TanStack Router e à Vercel.
- **npm com package-lock.json** em vez de pnpm. O enunciado só exige lockfile.
- **MSW fixado em 2.15** (não 3.x). `@mswjs/socket.io-binding@0.2.0` declara peer `msw@^2.10`; o MSW 3 saiu há pouco e o binding ainda não o suporta.
- **Tailwind v4** com `@tailwindcss/vite` e tokens via `@theme`. Sem `tailwind.config.js`: os tokens do Figma viram variáveis CSS em `src/index.css`.
- **shadcn/ui estilo new-york**, tema único escuro mapeado sobre as cores do Figma. Não existe tema claro no layout, então `prefers-color-scheme` não é tratado.
- **oxlint** (veio no scaffold do Vite 8) em vez de ESLint. Zero configuração, muito mais rápido, cobre o requisito de lint.
- **Prettier** para formatação.
- **Roteamento file-based** com `@tanstack/router-plugin` e `autoCodeSplitting`. Rotas tipadas geradas automaticamente; code splitting por rota ajuda no Lighthouse.
- **decimal.js** para valores em ETH. O enunciado exige strings decimais com precisão; `number` do JS perde precisão.
- **react-hook-form + zod** para formulários. Validação tipada compartilhada entre o contrato da API e a UI.
- Fonte **Roboto Mono self-hosted** (`@fontsource`), para não depender de rede externa no Lighthouse nem no deploy.

## Testes e auditoria

- **Playwright roda contra o build de produção** (`vite preview` na 4173) com mocks ativos, não contra o dev server. É o mesmo artefato do deploy; evita diferença entre dev e demo. Projetos `desktop` (1440) e `mobile` (Pixel 7, 390). `workers: 1` porque o estado do MSW vive no navegador e cada teste reseta via `?reset=1`.
- **Regressão visual** com `toHaveScreenshot`, `reducedMotion: 'reduce'`, animações desligadas e `maxDiffPixelRatio` 1%, baselines versionadas em `e2e/__screenshots__`, geradas e comparadas na imagem oficial do Playwright (`npm run test:visual`). A renderização de fonte muda entre sistemas operacionais; uma baseline do Windows não bate no Linux nem no macOS.
- **Lighthouse via script Node** (`scripts/lighthouse.mjs`) com `lighthouse/config.json` versionado, 3 medições por página/perfil, mediana e relatórios HTML/JSON. Os relatórios de cada medição são versionados junto com `SUMMARY.md` e `summary.json`: o enunciado pede a entrega dos relatórios. Custo: ~18 MB no repositório, regenerados a cada `npm run lighthouse`.
- **Imagens dos NFTs convertidas para WebP** (800px e 400px) a partir dos PNGs de 1254px/2MB do Figma, por LCP. É um desvio documentado de asset.
- **CI no GitHub Actions** roda typecheck, lint e a suíte Playwright completa, inclusive a regressão visual, na mesma imagem do Playwright: prova que tudo passa em checkout limpo.

## Produto

- **Favoritos e Pedidos são seções de `/profile`** (`#favoritos`, `#pedidos`), não páginas próprias. Não há frame no Figma; o enunciado só exige que favoritos persistam e pedidos sejam consultáveis.
- **Avaliações de colecionadores como no Figma**: estrelas ao lado do preço, chip "4.8 (19)" no mobile e aba "Avaliações de colecionadores (N)". A primeira versão tinha trocado a aba por "Atributos" por falta de rating no contrato; voltei atrás porque é o desvio mais visível do layout. O contrato ganhou `nft.rating` e `GET /nfts/:slug/reviews` (fixtures determinísticas, só leitura, carregadas ao abrir a aba, 6 por vez). Os atributos continuam na linha "Atributos:" do cabeçalho, como no layout.
- **Rede da cotação no carrinho = rede do primeiro item**; no checkout o usuário escolhe explicitamente.
- **Cotação é single-use** e tem `fingerprint`; o pedido envia o fingerprint revisado e a API recusa com `QUOTE_STALE` se algo mudou.
- **Idempotency-Key por tentativa de checkout**, guardada em sessionStorage e reutilizada em timeout e clique repetido; só gira após resposta definitiva.
- **Polling de 3 s na página do pedido enquanto pendente**, além do socket. Rede de segurança para refresh e quedas.
- **Login desktop como modal sobre o marketplace** (como no Figma), usando o header real do shell atrás; mobile em página inteira.
- **Botão de carrinho extra no detalhe desktop**, espelhando a buy bar do mobile.
- **"Mercado" no menu e na trilha leva ao catálogo da página inicial** (`/#catalogo`, com filtros e página zerados). O Figma não tem página de mercado; ele só acende o item nas telas de compra.
- **Carteiras e pagamento com o formulário do Figma**: a página de carteiras é o formulário inline do layout (nome de exibição, apelido, rede, nome do perfil, endereço, ENS ou carteira secundária, tipo de carteira, código de indicação, e-mail e nome ENS), com a secundária atrás de "Igual à carteira principal"/"Adicionar". O mesmo conjunto de campos é o "Perfil do colecionador" do pagamento, pré-preenchido pela carteira escolhida, com "Usar outra carteira?" e a observação opcional. Não há CPF/CNPJ: não existe no layout e o enunciado pede os campos do layout. No contrato, esses campos vivem em `Wallet` (`collectorProfile`) e vão no snapshot do pedido (`collectorInfo`). Rede, endereço e tipo no pagamento acompanham a carteira selecionada em "Carteira e rede". A simulação de conexão ficou numa linha compacta acima do formulário: o Figma não a desenha, o enunciado a exige.
- **Rodapé**: perfil e carteiras não têm rodapé no Figma em nenhuma largura; carrinho, pagamento, login e cadastro não têm no mobile. A app segue isso.
- **A app confere se o MSW está interceptando a aba** (`GET /__mock/state` precisa voltar JSON logo após `worker.start()`). Se não estiver, mostra um aviso fixo com "Recarregar" e o Axios recusa as chamadas com a causa, em vez de deixá-las cair no servidor estático e virar "Algo deu errado" em cada tela. Caso real: "Bypass for network" nas DevTools ou janela que bloqueia service workers.
- **Conexão da carteira revalidada no servidor simulado**: `POST /orders` recusa com `WALLET_NOT_CONNECTED` se a carteira não passou por `POST /wallets/:id/connect` (e não foi desconectada depois); o logout limpa as conexões. Antes a exigência era só da UI, o que podia ser lido como fluxo apenas visual.
- **Formulário do pagamento travado enquanto há tentativa em aberto**: o reenvio após timeout usa o payload original (mesma chave de idempotência), então editar o formulário nesse estado daria a impressão de que a edição valeu.
- **Banco simulado versionado** (`DB_SCHEMA_VERSION`): qualquer mudança no shape dos dados persistidos descarta o banco antigo do navegador e recria o seed. Sem isso, quem já tinha a app aberta via a validação do cliente falhar depois de uma mudança de contrato.

## Correções após revisão

- **Consumo do carrinho passou para o servidor simulado**: quando o pedido confirma, o mock remove as linhas compradas do carrinho do comprador antes de emitir `order.updated`; o cliente só invalida o cache. Substitui a versão anterior, em que o cliente consumia "no máximo uma vez" e falhava se o usuário não estivesse na página do pedido.
- **Rascunho do checkout e pedido pendente são escopados por usuário** e apagados no logout. A revisão encontrou dados de um usuário aparecendo no checkout de outro na mesma aba.
- **Retry do TanStack Query corrigido**: o predicado checava `AxiosError`, mas o interceptor rejeita com `ApiClientError`; nunca havia retry. Agora `isTransient && !canceled`, 2 tentativas.
- **Mocks ligados por padrão** (`VITE_ENABLE_MSW` só desliga com `false`) e `.env.production` versionado. Um build limpo na Vercel subiria sem mocks.
- **Conexão de carteira virou endpoint do mock** (`POST /wallets/:id/connect`, erro `WALLET_REFUSED`) em vez de `setTimeout` no componente.
- **Performance mobile ficou em 76 (início) e 84 (detalhe)**, meta 90. Causa, otimizações feitas e o que faltaria estão em `lighthouse/README.md`. Preferi não pré-renderizar o catálogo no build, que seria o caminho para 90, porque mudaria a arquitetura de SPA às vésperas da entrega.

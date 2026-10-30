# Arquitetura

## Visão geral

Aplicação SPA em React 19 + TypeScript, servida estaticamente (Vercel). Não existe backend: toda a API REST e o servidor Socket.IO são simulados **na camada de rede** com MSW (service worker) e `@mswjs/socket.io-binding`. Componentes, hooks e o cliente Axios não sabem que estão falando com mocks; trocar `VITE_ENABLE_MSW` para `false` e apontar `VITE_API_URL`/`VITE_SOCKET_URL` para um backend real não exige mudar código de aplicação.

```
┌──────────────┐   Axios    ┌──────────────┐   fetch/WS   ┌──────────────────────┐
│  UI (React)  │ ─────────▶ │ TanStack     │ ───────────▶ │ MSW (service worker) │
│  TanStack    │ ◀───────── │ Query cache  │ ◀─────────── │  handlers + db + ws  │
│  Router      │  socket.io │              │   eventos    │  cenários / falhas   │
└──────────────┘ ◀───────── └──────────────┘ ◀─────────── └──────────────────────┘
```

## Camadas e responsabilidades

| Camada | Pasta | Responsabilidade |
| --- | --- | --- |
| Contratos | `src/api/contracts.ts` | Schemas Zod e tipos de todo recurso, erro e evento. Fonte única usada por transporte, estado, UI e mocks. |
| Transporte | `src/api/client.ts`, `src/api/endpoints.ts` | Instância Axios (token, `X-Cart-Id`, request id, normalização de erros em `ApiClientError`) e uma função por operação, com validação Zod da resposta. |
| Estado remoto | `src/features/*/use-*.ts`, `src/lib/query-keys.ts` | Queries e mutations do TanStack Query, invalidação e atualizações otimistas. |
| Sessão | `src/features/session` | Store externo (`useSyncExternalStore`) persistido, guard de rotas, ciclo de vida (restauração, expiração, logout). |
| Tempo real | `src/realtime` | Cliente socket.io, deduplicação por `eventId`, guarda de versão, aplicação no cache e reconciliação após reconexão. |
| Rotas | `src/routes` | File-based routing (TanStack Router) com search params tipados e loaders que pré-carregam o cache. |
| Mocks | `src/mocks` | Banco em memória persistido, fixtures, handlers REST, servidor Socket.IO simulado, cenários de rede e endpoints de controle `/__mock/*`. |

## Contratos REST e eventos

Todos os shapes vivem em `src/api/contracts.ts`. A tabela completa de endpoints, códigos de erro, regras de negócio e cenários está em [`src/mocks/README.md`](./src/mocks/README.md); o transporte do socket e suas limitações em [`src/mocks/README-socket.md`](./src/mocks/README-socket.md).

Pontos de contrato que a UI depende:

- **Erros** têm sempre o formato `{ error: { code, message, details?, meta? } }`. A UI decide por `code` (ex.: `QUOTE_STALE`, `COUPON_EXPIRED`), nunca por status HTTP. `details` carrega erros por campo para formulários.
- **ETH é string decimal** em todo lugar (`"1.19"`). Cálculos passam por `src/lib/money.ts` (decimal.js). Quantidades são inteiras.
- **Versões**: NFT, carrinho, pedido, favoritos e carteiras têm `version` inteiro crescente. É o que permite descartar eventos antigos.
- **Pedidos** exigem o header `Idempotency-Key` e o `quoteFingerprint` da cotação revisada.
- **Eventos** (`nft.updated`, `order.updated`) têm envelope `{ eventId, emittedAt, resource: { kind, id }, version, payload }`; `order.updated` traz `userId`.

## Política de sessão

- Login/cadastro devolvem `{ user, token, expiresAt }`. O store (`session-store.ts`) persiste em `localStorage['kurio:session']` e injeta `Authorization: Bearer` via interceptor do Axios.
- Ao carregar a app, se existe token, `SessionLifecycle` valida com `GET /auth/session`. Token expirado no relógio local ou 401 na API colocam o store em `expired`: o diálogo "Sua sessão expirou" oferece entrar de novo (com `returnTo` para a rota atual) ou continuar como visitante.
- Rotas privadas (`/checkout`, `/profile`, `/wallets`, `/orders/*`) usam `requireAuth` em `beforeLoad`: guardam `returnTo` e redirecionam para `/login`. Só caminhos da mesma origem são aceitos como `returnTo`.
- Logout e troca de usuário: `authApi.logout` (falha ignorada), `sessionStore.clear()`, remoção de toda query cujo primeiro segmento não é `nfts` e re-bind do socket com token `null`. Nada do usuário anterior sobrevive em cache ou em assinaturas.
- Senhas nunca ficam em claro: o mock guarda SHA-256 e o cliente não persiste a senha.

## Estado do carrinho

- O carrinho é **server-side** (no mock), não um array no cliente. Visitantes são identificados por `X-Cart-Id` (`localStorage['kurio:guest-cart']`); usuários pelo token. Refresh mantém tudo porque o banco simulado é persistido.
- No login, `POST /cart/merge` funde o carrinho do visitante no do usuário (soma quantidades, respeita limites) e o id de visitante é descartado.
- Cada item guarda um **snapshot leve** (nome, imagem, preço da edição no momento em que foi adicionado). O snapshot serve para renderizar na hora; **a cotação (`POST /checkout/quote`) é a fonte da verdade de preço, desconto, taxa e total**. A cotação compara o preço atual com o snapshot e devolve `issues` (preço alterado, esgotado, estoque insuficiente), que a UI exibe antes de deixar seguir.
- Quando um pedido é confirmado, o **servidor** (mock) remove do carrinho do comprador apenas os itens e quantidades comprados e incrementa a `version` do carrinho, antes de emitir `order.updated`. Recusa não toca o carrinho. O cliente só revalida `['cart', userId]`: ao aplicar `order.updated` confirmado (em qualquer página) e, como rede de segurança, quando o polling de 3s do pedido vê o estado terminal (`settleOrder`). `POST /cart/consume` continua na API por completude, mas a app não depende dele.
- A rede usada na cotação do carrinho é a do primeiro item; no checkout o usuário escolhe explicitamente.

## Estratégia de cache, retries e sincronização

Definida em `src/app/query-client.ts`:

- `staleTime` 30s para consultas; eventos e invalidações após mutations atualizam antes quando necessário.
- `gcTime` 5min.
- Retry apenas em falhas transitórias (rede, 5xx, 408, 429), no máximo 2 tentativas com backoff exponencial. Nunca em 4xx de negócio.
- Mutations sem retry automático. A idempotência de pedidos é garantida por `Idempotency-Key` explícita, gerada uma vez por tentativa de checkout e reutilizada em timeouts e cliques repetidos; só é trocada após resposta definitiva.
- Chaves privadas incluem o `userId` (`['cart', userId]`, `['favorites', userId]`, `['orders', userId, ...]`), o que isola cache entre usuários; logout remove tudo que não é público.
- Consultas recebem `signal` do Query; o Axios cancela respostas obsoletas quando os parâmetros mudam. Na listagem, `placeholderData: keepPreviousData` mantém os cards anteriores com um indicador "Atualizando…" até a nova página chegar.
- Loaders das rotas usam `ensureQueryData` para aquecer o cache no preload (hover/foco) e deixam a UI cuidar de skeleton e erro na navegação direta.
- Atualização otimista: favoritos (`use-favorites.ts`) e quantidade no carrinho, com snapshot do cache e rollback em erro.

## Reconciliação REST ↔ Socket.IO

- O cliente abre um WebSocket real via `socket.io-client`; o MSW intercepta na página. Após `connect`, emite `session.bind` com o token para o servidor saber a quem entregar `order.updated`.
- Cada evento passa por `shouldApply`: descartado se o `eventId` já foi visto (LRU de 500) ou se `version` não é maior que a última aplicada ao recurso e que a versão no cache. O cache nunca regride; pedidos confirmados/recusados são terminais.
- `nft.updated` atualiza, por id, todas as listagens, destaque, detalhe, relacionados e os snapshots dentro de qualquer carrinho em cache, e invalida cotações abertas. Se o item está no carrinho, um aviso acessível é publicado (`realtimeNotices`) e o resumo é recotado. No checkout, uma cotação cujo `fingerprint` divergir é rejeitada pela API com `QUOTE_STALE`, e a confirmação só volta a ser possível depois que o usuário revisa a nova cotação.
- `order.updated` só é aplicado se `userId` for o do usuário autenticado. A página do pedido também faz polling de 3s enquanto está pendente, como rede de segurança para refresh e quedas de conexão.
- Reconexão: o Manager do socket reconecta com backoff; no `connect` seguinte o cliente invalida `['nfts']`, `['cart']`, `['orders']` e `['quote']` com `refetchType: 'active'`, reconciliando com o REST o que pode ter sido perdido.
- Logout/expiração limpam o log de eventos e refazem `session.bind` com token `null`.

## Limitações conhecidas e decisões de UX

- O socket simulado vive na aba: eventos gerados numa aba não chegam às outras (elas se atualizam pelo REST). Só WebSocket, sem long-polling, namespaces, rooms ou acks (ver README-socket).
- Avaliações com estrelas do Figma não existem no contrato; o detalhe usa "likes" e a aba "Avaliações" virou "Atributos".
- Links fora do escopo (Mercado, Criadores, Aprenda, Central de ajuda, redes sociais, "Ler mais" do blog) ficam desabilitados com tooltip "Em breve"; a newsletter valida o e-mail e avisa que nada foi cadastrado. Nenhuma ação fora do escopo aparenta sucesso.
- Favoritos e Pedidos não têm frame no Figma; vivem como seções da página de perfil.
- A conexão de carteira passa por `POST /wallets/:id/connect` no mock (aprovação após a latência do cenário; recusa = 409 `WALLET_REFUSED`) e é exigida pela UI para confirmar o pedido. O estado "conectada" vive só no cliente (não é persistido) e o `POST /orders` não o revalida; desconectar é local.
- Perfil, carteiras e confirmação não têm frame mobile; foram adaptados mantendo a linguagem visual.

## Desvios do Figma

- Imagens dos NFTs convertidas de PNG 1254px (~2 MB cada) para WebP 800px e 400px (~50 KB), por LCP e CLS. Fonte Roboto Mono self-hosted (`@fontsource`, só subset latin).
- O detalhe desktop ganhou um botão de carrinho ao lado de "COMPRAR", espelhando a barra de compra mobile.
- Abaixo de 640px a seção do blog vira uma linha com rolagem horizontal.
- Ícones de marcas (redes sociais, carteiras) são SVG inline, já que o lucide não os distribui mais.

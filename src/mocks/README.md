# API simulada (MSW)

Toda a API REST do marketplace roda **na camada de rede**: o Service Worker do MSW intercepta as
chamadas do Axios para `/api/*` e responde a partir de um banco em memória persistido em
`localStorage`. Componentes, hooks e o cliente Axios não contêm respostas fictícias. Os contratos
(request, response, erros e eventos) são os schemas Zod de `src/api/contracts.ts`: os handlers
validam as entradas com os mesmos schemas que os formulários usam.

A camada é ligada por `VITE_ENABLE_MSW=true` (dev, preview e build de demonstração). O transporte
Socket.IO simulado está em `socket.ts` (documentado em `README-socket.md`). Ele assina o barramento
`events.ts`, no qual estes handlers publicam `nft.updated` e `order.updated`.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `db.ts` | Tipos e estado do banco, `commit()` (persistência), `resetDb()`, relógio `now()` |
| `persistence.ts` | Acesso seguro ao `localStorage` (no-op fora do navegador), versão do schema |
| `events.ts` | Barramento `mockEvents` (`subscribe`/`emit`) consumido pelo socket simulado |
| `scenarios.ts` | Cenários, latência com PRNG de semente fixa, flags de disparo único, falhas injetadas |
| `fixtures/` | Seed determinístico: 45 NFTs, 2 usuários, carteiras, favoritos, cupons, taxas, 1 pedido |
| `domain/` | Regras de negócio: sessão, catálogo, carrinho, cupom, cotação, pedidos |
| `handlers/` | Rotas MSW por recurso; `http.ts` aplica o cenário e converte erros |
| `control.ts` | Endpoints `/__mock/*` para o painel de dev e o Playwright |
| `__smoke__.ts` | Smoke test fora do navegador (`npx tsx src/mocks/__smoke__.ts`) |

## Modelo de dados

O estado é um único objeto JSON, salvo inteiro em `localStorage['kurio:mockdb']` no formato
`{ schemaVersion, data }`, depois de cada mutação. Se a versão do schema mudar, o seed é recriado.
Todo recurso mutável tem `version`, um inteiro incrementado a cada mudança. Todas as datas são ISO.

| Coleção | Chave | Conteúdo |
| --- | --- | --- |
| `users` | userId | `User` do contrato |
| `passwordHashes` | userId | SHA-256 hex de `userId:senha` (Web Crypto). Nunca em claro |
| `sessions` | token | `{ userId, createdAt, expiresAt }`. TTL de 2 h no relógio da API |
| `nfts` | nftId | `Nft` do contrato. `priceEth` = menor preço entre as edições disponíveis |
| `favorites` | userId | `{ nftIds, version }` |
| `carts` | `user:<id>` ou `guest:<X-Cart-Id>` | Itens `{ id, nftId, editionId, quantity, snapshotPriceEth }`, `couponCode`, `version` |
| `coupons` | código | percentual ou valor fixo, subtotal mínimo, expiração |
| `quotes` | quoteId | Entrada normalizada, dono, fingerprint e expiração (10 min). Uso único |
| `orders` | orderId | `Order` do contrato, com snapshot imutável |
| `orderJobs` | orderId | Resolução agendada (`outcome`, `resolveAt` absoluto) de pedido pendente |
| `idempotency` | `userId:chave` | `{ payloadHash, orderId }`. O escopo por usuário impede vazamento entre contas |
| `wallets` | walletId | `Wallet` do contrato |
| `networkFees` | rede | Taxa fixa por pedido |

**Relógio.** `now()` é o tempo real somado a um deslocamento ajustável por
`POST /__mock/clock/advance`. A aba "Novos" do catálogo usa o relógio do seed
(`2026-10-15T12:00:00Z`) e mostra os NFTs criados nos 30 dias anteriores a ele, por isso o
resultado não depende do dia em que o teste roda.

## Endpoints REST (base `/api`)

Formato de erro: `{ error: { code, message, details?, meta? } }`. `details` é indexado pelo nome do
campo. Rotas privadas exigem `Authorization: Bearer <token>`. Token ausente, desconhecido ou expirado
responde `401 UNAUTHORIZED`. Qualquer outra rota `/api/*` responde `404 NOT_FOUND`.

| Método e rota | Auth | Sucesso | Erros |
| --- | --- | --- | --- |
| `POST /auth/register` | — | 201 `Session` | 422 VALIDATION_ERROR, 409 EMAIL_TAKEN (`details.email`) |
| `POST /auth/login` | — | 200 `Session` | 422, 401 INVALID_CREDENTIALS |
| `GET /auth/session` | Bearer | 200 `Session` | 401 |
| `POST /auth/logout` | opcional | 204 | — |
| `GET /nfts` | — | 200 `CatalogPage` | 422 (parâmetro inválido) |
| `GET /nfts/featured` | — | 200 `{ hero, spotlight }` | — |
| `GET /nfts/:slug` | — | 200 `Nft` (aceita slug ou id) | 404 NOT_FOUND |
| `GET /nfts/:slug/related` | — | 200 `{ items }`: 3 NFTs da mesma coleção | 404 |
| `GET /favorites` | Bearer | 200 `Favorites` | 401 |
| `PUT /favorites/:nftId` | Bearer | 200 `Favorites` (idempotente) | 401, 404 |
| `DELETE /favorites/:nftId` | Bearer | 200 `Favorites` (idempotente) | 401 |
| `GET /cart` | Bearer ou X-Cart-Id | 200 `Cart` (vazio se não existir) | 401, 422 sem identificação |
| `POST /cart/items` | Bearer ou X-Cart-Id | 200 `Cart` | 404, 409 OUT_OF_STOCK, 409 EDITION_UNAVAILABLE, 422 |
| `PATCH /cart/items/:itemId` | Bearer ou X-Cart-Id | 200 `Cart` | 404, 409 OUT_OF_STOCK / EDITION_UNAVAILABLE, 422 |
| `DELETE /cart/items/:itemId` | Bearer ou X-Cart-Id | 200 `Cart` | 404 |
| `PUT /cart/coupon` `{ couponCode \| null }` | Bearer ou X-Cart-Id | 200 `Cart` | 422 COUPON_INVALID, 422 COUPON_EXPIRED (`details.couponCode`) |
| `POST /cart/merge` `{ guestCartId }` | Bearer | 200 `Cart` | 401, 422 |
| `POST /cart/consume` `{ lines }` | Bearer ou X-Cart-Id | 200 `Cart` | 422 |
| `POST /checkout/quote` | Bearer ou X-Cart-Id | 200 `Quote` | 422 (itens, COUPON_INVALID, COUPON_EXPIRED) |
| `POST /orders` + `Idempotency-Key` | Bearer | 201 criado, 200 repetição | 401, 404 cotação, 409 QUOTE_STALE, 409 OUT_OF_STOCK, 409 IDEMPOTENCY_KEY_REUSED, 422 |
| `GET /orders` | Bearer | 200 `{ items }` (só os do usuário) | 401 |
| `GET /orders/:id` | Bearer | 200 `Order` | 401, 403 FORBIDDEN (pedido de outra conta), 404 |
| `GET /me` | Bearer | 200 `User` | 401 |
| `PATCH /me` | Bearer | 200 `User` | 422 (`details.username` se já estiver em uso, `details.avatarUrl` se passar de ~750 KB) |
| `POST /me/password` | Bearer | 204 | 422 (`details.currentPassword` se a senha atual estiver errada) |
| `GET /wallets` | Bearer | 200 `{ items }` | 401 |
| `POST /wallets` | Bearer | 201 `Wallet` | 409 WALLET_LIMIT (`details.kind`), 422 |
| `PATCH /wallets/:id` | Bearer | 200 `Wallet` | 403, 404, 409 WALLET_LIMIT, 422 |

Em todos os cenários, qualquer rota pode responder 503 SERVICE_UNAVAILABLE (cenário `flaky`),
falhar com erro de rede (cenário `offline`) ou devolver a falha injetada por `/__mock/fail-next`.

### Regras de negócio

- **Catálogo.** `q` busca no nome, no criador (nome e handle) e no rótulo da coleção, sem
  diferenciar maiúsculas. `collection` e `network` são parâmetros repetidos: valores da mesma
  faceta combinam com OU, facetas diferentes combinam com E. `priceMin` e `priceMax` são inclusivos
  e comparados como decimais. `sort` aceita `recent`, `price-asc`, `price-desc` e `popular`
  (curtidas); empates são desfeitos pelo id. A aba `new` traz os NFTs criados até 30 dias antes do
  relógio do seed. A aba `trending` traz os que têm o selo `em-alta` ou curtidas acima da mediana.
  Cada faceta conta aplicando todos os filtros, menos o dela mesma. `priceRange` é calculado sobre o
  catálogo inteiro.
- **Carrinho.** O token tem precedência sobre o `X-Cart-Id`. Carrinhos de usuário e de visitante
  ficam em espaços de chave separados, então um `X-Cart-Id` nunca alcança o carrinho de uma conta.
  Os itens são deduplicados por NFT e edição, com id `ci_<nftId>_<editionId>`. A quantidade fica
  limitada a `min(available, maxPerOrder)`. O campo `edition.priceEth` do item guarda o preço do
  momento em que ele foi adicionado ou alterado, enquanto `available` e `maxPerOrder` são lidos ao
  vivo. O merge soma as quantidades, aplica o teto e descarta edições esgotadas; se o carrinho do
  usuário não tiver cupom, herda o do visitante. Depois disso o carrinho do visitante é apagado. O
  consume subtrai apenas as quantidades informadas.
- **Cotação.** As linhas são recalculadas com os preços atuais do catálogo e o cupom é aplicado
  (o desconto nunca passa do subtotal). A taxa depende da rede: ethereum 0.0021, polygon 0.0003,
  solana 0.0001. `issues` sinaliza três situações: `price-changed`, quando o preço difere do snapshot
  do carrinho; `sold-out`; e `insufficient-stock`. O `fingerprint` é o SHA-256 das linhas
  normalizadas, dos totais, do cupom, da rede e dos problemas de estoque. A cotação expira em 10
  minutos. Toda conta com ETH usa `src/lib/money.ts` (decimal.js).
- **Pedido.** A criação segue esta ordem:
  1. Verifica a autenticação e o `Idempotency-Key` (8 a 128 caracteres).
  2. Se a chave já foi usada com o mesmo hash do payload, devolve o pedido existente com 200. Se o
     hash for diferente, responde 409 IDEMPOTENCY_KEY_REUSED. Requisições simultâneas com a mesma
     chave aguardam a primeira.
  3. Recalcula a cotação. Se a cotação expirou ou o fingerprint mudou, responde 409 QUOTE_STALE com
     `meta.quote`, uma cotação nova e já gravada, pronta para reconfirmar.
  4. Se houver problema de estoque, responde 409 OUT_OF_STOCK com `meta.quote`.
  5. Confere se a carteira pertence ao usuário.
  6. Cria o pedido `pending` com snapshot completo (linhas, totais, cupom, rede, carteira e
     colecionador), reserva o estoque (um `nft.updated` por linha) e invalida a cotação.

  A resolução acontece 2,5 s depois. Um pedido confirmado recebe `txHash` (`0x` + 64 hex) e
  `explorerUrl` (etherscan, polygonscan ou solscan, conforme a rede). Um pedido recusado recebe
  `declineReason` e devolve o estoque. Nos dois casos sai um `order.updated`. Confirmado e recusado
  são estados terminais. Pedidos pendentes sobrevivem a um reload: `orderJobs` guarda o horário
  absoluto da resolução, que é reagendada quando o módulo carrega.

## Eventos (`mockEvents` → Socket.IO)

```ts
type DomainEvent = NftUpdatedEvent | OrderUpdatedEvent // src/api/contracts.ts
```

Cada evento traz um `eventId` novo (UUID), `emittedAt`, `resource` e a `version` do recurso depois
da mudança. São publicados:

- `nft.updated`: reserva e devolução de estoque, cenários `price-change` e `sold-out`, e
  `/__mock/nfts/:id/update`;
- `order.updated`: resolução de um pedido, com `userId`, que o socket usa para entregar o evento só
  ao dono.

Para injetar eventos duplicados ou antigos, use `/__mock/socket/emit` (em `socket.ts`).

## Cenários

O cenário pode ser ativado de três formas:

- pela URL: `?scenario=<nome>`, lido por `applyScenarioFromUrl()` antes de o worker iniciar e depois
  removido da URL;
- pelo endpoint de controle: `POST /__mock/scenario { "name": "<nome>" }`;
- pelo painel de dev.

O cenário fica salvo em `localStorage['kurio:scenario']` e é consultado a cada requisição, então a
troca não precisa de reload. As latências vêm de um PRNG com semente fixa, reiniciado a cada troca:
a mesma sequência de requisições produz os mesmos atrasos.

| Nome | Efeito |
| --- | --- |
| `default` | Latência de 150 a 450 ms; o pagamento é confirmado em 2,5 s |
| `slow` | Latência de 1,5 a 3 s (para ver os skeletons) |
| `flaky` | A cada 3 requisições a `/api/nfts*` e a `/api/cart*` (um contador por prefixo), a terceira responde 503 SERVICE_UNAVAILABLE |
| `offline` | Toda rota `/api` falha com erro de rede (`HttpResponse.error()`); `/__mock` continua respondendo |
| `empty-catalog` | Listagem, destaques e relacionados retornam vazios |
| `session-expired` | A primeira requisição com Bearer depois da ativação recebe 401 e a sessão é apagada (dispara uma vez) |
| `order-declined` | O pedido é recusado em 2,5 s com "Pagamento recusado pela carteira" e o estoque volta |
| `order-timeout` | `POST /orders` cria o pedido e emite os eventos, mas só responde depois de 12 s (o cliente desiste em 8 s). Um reenvio com a mesma chave recebe o mesmo pedido na hora |
| `price-change` | 10 s depois da primeira cotação, o preço da primeira linha sobe 15% (`nft.updated`) e o próximo pedido recebe QUOTE_STALE (dispara uma vez) |
| `coupon-expired` | Qualquer cupom responde 422 COUPON_EXPIRED |
| `out-of-order` | Latência de 100 a 2500 ms. Em `GET /api/nfts`, as requisições ímpares levam de 1800 a 2500 ms e as pares de 100 a 400 ms, o que garante que uma busca antiga responda depois da nova |
| `sold-out` | 3 s depois da primeira cotação, a edição da primeira linha fica com disponibilidade 0 (`nft.updated`) e o próximo pedido é barrado (dispara uma vez) |

Os cenários que disparam uma vez guardam essa informação em
`localStorage['kurio:scenario-runtime']`, para que um refresh não os dispare de novo.

## Endpoints de controle (`/__mock`, sem latência e sem falhas)

| Rota | Corpo | Efeito |
| --- | --- | --- |
| `GET /__mock/state` | — | Cenário ativo, lista de cenários, flags, falhas injetadas, contagens do banco e relógio |
| `POST /__mock/reset` | — | Restaura o seed completo (banco, sessões, carrinhos, cenário `default` e flags) |
| `POST /__mock/scenario` | `{ name }` | Ativa um cenário (422 se o nome for desconhecido) |
| `POST /__mock/nfts/:id/update` | `{ priceEth?, editions?: [{ id, priceEth?, available? }] }` | Altera um NFT (aceita id ou slug) e emite `nft.updated` |
| `POST /__mock/orders/:id/resolve` | `{ status: 'confirmed' \| 'declined' }` | Resolve na hora um pedido pendente (`changed: false` se ele já estiver terminal) |
| `POST /__mock/session/expire` | Bearer no header | Expira a sessão desse token |
| `POST /__mock/clock/advance` | `{ ms }` | Avança o relógio da API (sessão, cotação e pedidos pendentes) |
| `POST /__mock/fail-next` | `{ path, method?, status?, code?, message?, count? }` | As próximas `count` requisições que casarem com a regra falham. `path` aceita prefixo com `*`; `status: 0` simula erro de rede |
| `POST /__mock/fail-next/clear` | — | Remove as falhas injetadas |

Exemplo no Playwright:
`await page.request.post('/__mock/fail-next', { data: { method: 'PUT', path: '/api/favorites*' } })`.

## Persistência e reset

| Ação | Como |
| --- | --- |
| Reset completo | `?reset=1` na URL, ou `POST /__mock/reset`, ou `resetMockDb()` |
| Reset com cenário | `?reset=1&scenario=slow`: reseta primeiro e depois aplica o cenário |

O seed é uma função pura, sem `Date.now` nem `Math.random`, então todo reset produz o mesmo banco.
Abas diferentes se sincronizam pelo evento `storage`. Fora do navegador (Node) a persistência não
faz nada.

## Credenciais e cupons

| Usuário | Senha | Dados |
| --- | --- | --- |
| `ana@kurio.dev` (Ana Ribeiro, `ana_ribeiro`) | `Senha123` | 2 carteiras (principal MetaMask/Ethereum e secundária WalletConnect/Polygon), 3 favoritos, 1 pedido confirmado (`ord_seed_ana_001`) |
| `bruno@kurio.dev` (Bruno Lima, `bruno_lima`) | `Senha123` | 1 carteira (principal Coinbase/Ethereum), nenhum favorito |

| Cupom | Regra |
| --- | --- |
| `KURIO10` | 10% de desconto no subtotal |
| `GENESIS` | Expirado: 422 COUPON_EXPIRED |
| `FIXED05` | 0.05 ETH de desconto, para subtotal a partir de 0.5 ETH (abaixo disso: COUPON_INVALID) |

## Fixtures do catálogo

São 45 NFTs, 5 em cada uma das 9 coleções, distribuídos pelas 3 redes. Isso garante que toda
combinação de coleção e rede tenha resultado e que haja 5 páginas com `pageSize` 9. Os preços vão de
0.02 a 12.30 ETH. Cada NFT tem de 1 a 3 edições, com `available` entre 0 e 25 e `maxPerOrder` entre
1 e 5.

| Grupo | NFTs |
| --- | --- |
| Hero | Emerald Ape #042 (1.19 ETH), Sage Nomad #009, Neon Vessel #552 |
| "NFT em destaque" | Golden Beat #207 |
| Todas as edições esgotadas | `cosmic-bloom-505` e `golden-beat-753` |
| Alguma edição esgotada | Mais 6 NFTs |

As imagens vêm de `public/images` (versões de 800 px e 400 px). Os avatares dos criadores são SVGs
em data URI.

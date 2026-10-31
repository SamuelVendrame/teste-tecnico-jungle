# Kurio · Marketplace de NFTs

Implementação do desafio frontend "NFT Marketplace" (enunciado em [CHALLENGE.md](./CHALLENGE.md)). Decisões de arquitetura em [ARCHITECTURE.md](./ARCHITECTURE.md).

**Demo:** _(URL pública a preencher)_

## Stack

React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Axios · Socket.IO client · Tailwind CSS v4 · shadcn/ui · MSW 2 (+ `@mswjs/socket.io-binding`) · Playwright · Lighthouse

## Setup

```bash
npm ci
cp .env.example .env   # já vem com os mocks ativados
npm run dev            # http://localhost:5173
```

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MSW` | `true` | Camada de mocks (REST + Socket.IO). Ligada por padrão, mesmo sem `.env`; só `false` desliga. O `.env.production` versionado fixa `true` no build de demonstração. |
| `VITE_API_URL` | `/api` | Base da API. |
| `VITE_SOCKET_URL` | `ws://localhost/socket` | URL do socket (interceptada pelo MSW). |

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana Ribeiro | `ana@kurio.dev` | `Senha123` |
| Bruno Lima | `bruno@kurio.dev` | `Senha123` |

Cupons: `KURIO10` (10%), `FIXED05` (0,05 ETH, subtotal mínimo 0,5), `GENESIS` (expirado).

## Cenários simulados e reset

Toda a API e o Socket.IO são simulados na camada de rede (MSW). O estado fica em `localStorage` e sobrevive a refresh; o reset restaura a seed completa.

Três formas de escolher um cenário:

- **URL**: `/?scenario=slow` ou `/?scenario=order-timeout&reset=1` (reseta e aplica).
- **Painel "Cenários"**: botão flutuante no canto inferior esquerdo (presente também no build de demonstração). Lista os cenários, reseta os dados, preenche credenciais e expira a sessão.
- **Endpoint de controle**: `POST /__mock/scenario { "name": "flaky" }`, usado pelos testes.

| Cenário | Efeito |
| --- | --- |
| `default` | Latência 150 a 450 ms; pagamento confirmado em 2,5 s |
| `slow` | Latência 1,5 a 3 s (skeletons) |
| `flaky` | A cada 3 requisições a `/api/nfts*` e `/api/cart*`, uma responde 503 |
| `offline` | Toda rota `/api` falha com erro de rede |
| `empty-catalog` | Catálogo, destaques e relacionados vazios |
| `session-expired` | A próxima requisição autenticada recebe 401 e a sessão expira |
| `order-declined` | Pagamento recusado em 2,5 s; estoque e carrinho preservados |
| `order-timeout` | `POST /orders` cria o pedido mas só responde após 12 s; o reenvio com a mesma `Idempotency-Key` recupera o mesmo pedido |
| `price-change` | 10 s após a primeira cotação o preço sobe 15% (`nft.updated`) e o pedido recebe `QUOTE_STALE` |
| `coupon-expired` | Todo cupom responde `COUPON_EXPIRED` |
| `out-of-order` | Latência 100 a 2500 ms com respostas fora de ordem no catálogo |
| `sold-out` | 3 s após a primeira cotação a edição esgota e o pedido é barrado |

Endpoints de controle (sem latência): `GET /__mock/state`, `POST /__mock/reset`, `POST /__mock/scenario`, `POST /__mock/nfts/:id/update`, `POST /__mock/orders/:id/resolve`, `POST /__mock/session/expire`, `POST /__mock/clock/advance`, `POST /__mock/fail-next`, `POST /__mock/socket/emit`, `POST /__mock/socket/disconnect`. Detalhes em [src/mocks/README.md](./src/mocks/README.md) e [src/mocks/README-socket.md](./src/mocks/README-socket.md).

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Typecheck + build de produção |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run test:e2e` | Playwright (faz o build e sobe o preview sozinho); a regressão visual é pulada fora do container |
| `npm run test:visual` | Regressão visual no container oficial do Playwright (requer Docker) |
| `npm run test:visual:update` | Regera as baselines de regressão visual no mesmo container |
| `npm run lighthouse` | Auditoria Lighthouse (3 medições, mediana) em `lighthouse/reports` |

## Reproduzindo fluxos de falha

Todos a partir de `npm run dev` (ou da URL pública), logado como `ana@kurio.dev`:

1. **Preço muda com o NFT no carrinho**: adicione um NFT, abra `/cart` e, em outra aba do DevTools, rode `fetch('/__mock/nfts/emerald-ape-042/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceEth: '2.50' }) })`. O resumo é recotado e um aviso aparece. Em `/checkout`, confirmar com a cotação antiga abre "A cotação mudou". Atalho: `/?scenario=price-change&reset=1`, faça o checkout e espere 10 s antes de confirmar.
2. **Clique repetido / timeout**: `/?scenario=order-timeout&reset=1`; no checkout clique em confirmar várias vezes. Só um pedido é criado; após o alerta de timeout, "Tentar novamente" leva ao mesmo pedido.
3. **Pagamento recusado**: `/?scenario=order-declined&reset=1`.
4. **Pedido pendente com queda de conexão**: confirme um pedido e, com ele pendente, rode `fetch('/__mock/socket/disconnect', { method: 'POST' })` ou recarregue a página. O estado é recuperado sem criar outro pedido.
5. **Sessão expirada no checkout**: no painel "Cenários" clique em "Expirar sessão" durante o checkout. Como o checkout é rota privada, a app vai direto para o login (com aviso) e devolve ao checkout com os dados preservados; em páginas públicas aparece o diálogo "Sua sessão expirou".
6. **Cupom inválido/expirado**: `GENESIS` (expirado), qualquer outro código (inválido), ou `/?scenario=coupon-expired`.
7. **Lentidão, falhas e offline**: `/?scenario=slow`, `/?scenario=flaky`, `/?scenario=offline`, `/?scenario=out-of-order`.
8. **Falha de favorito com rollback**: `fetch('/__mock/fail-next', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'PUT', path: '/api/favorites*', status: 503 }) })` e clique num coração.

Os testes em `e2e/` automatizam cada um desses fluxos.

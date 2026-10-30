# Arquitetura

> Documento vivo. Seções marcadas com _(a preencher)_ serão completadas ao final da implementação.

## Visão geral

Aplicação SPA em React 19 + TypeScript, servida estaticamente (Vercel). Não existe backend: toda a API REST e o servidor Socket.IO são simulados **na camada de rede** com MSW (service worker) e `@mswjs/socket.io-binding`. Componentes, hooks e o cliente Axios não sabem que estão falando com mocks.

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
| Transporte | `src/api/client.ts`, `src/api/endpoints.ts` | Instância Axios (token, X-Cart-Id, request id, normalização de erros em `ApiClientError`) e uma função por operação, com validação da resposta. |
| Estado remoto | `src/features/*/use-*.ts`, `src/lib/query-keys.ts` | Queries e mutations do TanStack Query, invalidação e atualizações otimistas. |
| Sessão | `src/features/session` | Store externo (`useSyncExternalStore`) persistido, guard de rotas, ciclo de vida (restauração, expiração, logout). |
| Tempo real | `src/realtime` | Cliente socket.io, deduplicação por `eventId`, guarda de versão, aplicação no cache e reconciliação após reconexão. |
| Rotas | `src/routes` | File-based routing (TanStack Router) com search params tipados e loaders que pré-carregam o cache. |
| Mocks | `src/mocks` | Banco em memória persistido, fixtures, handlers REST, servidor Socket.IO simulado, cenários de rede e endpoints de controle `/__mock/*`. |

## Contratos REST e eventos

Ver `src/mocks/README.md` (gerado junto com os handlers) e `src/api/contracts.ts`. _(resumo a preencher)_

## Política de sessão

_(a preencher: token Bearer em localStorage `kurio:session`, expiração, 401 → estado `expired`, `returnTo`, limpeza de cache privado no logout)_

## Estado do carrinho

_(a preencher: carrinho de visitante por `X-Cart-Id`, merge no login, snapshot leve x cotação como fonte da verdade, consumo parcial após pedido)_

## Estratégia de cache, retries e sincronização

Definida em `src/app/query-client.ts`:

- `staleTime` 30s para consultas; eventos e invalidações após mutations atualizam antes quando necessário.
- `gcTime` 5min.
- Retry apenas em falhas transitórias (rede, 5xx, 408, 429), no máximo 2 tentativas com backoff exponencial. Nunca em 4xx de negócio.
- Mutations sem retry automático. A idempotência de pedidos é garantida por `Idempotency-Key` explícita.
- Chaves privadas incluem o `userId` (`['cart', userId]`, `['favorites', userId]`), o que isola cache entre usuários; logout remove tudo que não é público.
- Consultas recebem `signal` do Query e o Axios cancela respostas obsoletas quando os parâmetros mudam.

## Reconciliação REST ↔ Socket.IO

_(a preencher: envelope com `eventId` + `version`, LRU de eventos vistos, regra "só aplica se version > cache", reconexão → `invalidateQueries` ativas, eventos de outro usuário descartados por `userId`)_

## Limitações conhecidas e decisões de UX

_(a preencher)_

## Desvios do Figma

_(a preencher)_

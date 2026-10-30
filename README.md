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
| `VITE_ENABLE_MSW` | `true` | Ativa a camada de mocks (REST + Socket.IO). Sem backend real, mantenha `true`. |
| `VITE_API_URL` | `/api` | Base da API. |
| `VITE_SOCKET_URL` | `ws://localhost/socket` | URL do socket (interceptada pelo MSW). |

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana Ribeiro | `ana@kurio.dev` | `Senha123` |
| Bruno Lima | `bruno@kurio.dev` | `Senha123` |

Cupons: `KURIO10` (10%), `FIXED05` (0,05 ETH, subtotal mínimo 0,5), `GENESIS` (expirado).

## Cenários simulados e reset

_(a preencher: lista de cenários, `?scenario=<nome>&reset=1`, painel "Cenários" no canto da tela, endpoints `/__mock/*`)_

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Typecheck + build de produção |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run test:e2e` | Playwright (faz o build e sobe o preview sozinho) |
| `npm run test:e2e:update` | Atualiza baselines de regressão visual |
| `npm run lighthouse` | Auditoria Lighthouse (3 medições, mediana) em `lighthouse/reports` |

## Reproduzindo fluxos de falha

_(a preencher)_

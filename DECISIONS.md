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

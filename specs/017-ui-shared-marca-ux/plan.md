# Plano — 017

## Arquitetura da solução
Fonte única em `packages/ui`, consumida por **importação** (sem cópia/sync de arquivos), espelhando o padrão já aceito dos logos (`brand.ts` data-URI):

- **Favicon:** `brand.ts` ganha `faviconV2 = { src: "data:image/png;base64,…", width:16, height:16 }` (PNG 421 bytes, 16×16) + função `applyFavicon(doc?)` que faz upsert de `<link rel="icon" type="image/png">` com `href = faviconV2.src`. `index.ts` reexporta ambos.
  - site (Astro/SSG): `import { faviconV2 } from "@artificio/ui"` em `Base.astro` → `<link rel="icon" type="image/png" href={faviconV2.src} />` (build-time, sem flash).
  - accounts/glossário/mesas (Vite SPA): `import { applyFavicon } from "@artificio/ui"` em `main.tsx`; chamar `applyFavicon()` no boot.
- **Rodapé "presente":** `Footer.tsx` passa a renderizar o texto fixo "Este é um presente da Artifício RPG…". Remover as duas ocorrências no glossário.
- **Toggle de tema:** `Header.tsx` ganha prop aditiva (ex.: `showThemeToggle?: boolean`, default conservador) que renderiza botão lua/sol; handler lê/grava cookie `artificio_theme` e alterna `dataset.theme`. Lógica espelha `apps/site/src/layouts/Base.astro`. glossário/mesas ativam a prop.

## Arquivos afetados (por módulo/pacote)
- `packages/ui/src/brand.ts` — `faviconV2` + `applyFavicon()`.
- `packages/ui/src/index.ts` — reexport.
- `packages/ui/src/Footer.tsx` — texto "presente".
- `packages/ui/src/Header.tsx` — toggle de tema (prop aditiva).
- `apps/site/src/layouts/Base.astro` — favicon via import (substitui o `<link href="/faviconV2.png">` adicionado).
- `apps/accounts/frontend/index.html` — remover `<link>` estático; `apps/accounts/frontend/src/main.tsx` — `applyFavicon()`.
- `apps/glossario/frontend/index.html` — remover `<link>` estático; `apps/glossario/frontend/src/main.tsx` — `applyFavicon()`; `LandingSection.tsx` + `App.tsx` — remover texto duplicado; header glossário ativa toggle.
- `apps/mesas/frontend/index.html` — remover `<link>` estático; `main.tsx` — `applyFavicon()`; header mesas ativa toggle.
- Remover assets: `apps/{site,glossario/frontend,accounts/frontend,mesas/frontend}/public/faviconV2.png`.

## Contratos/interfaces tocados
- `@artificio/ui` Header/Footer (shell compartilhado, D058) — mudanças aditivas/retrocompatíveis. Sem toque em `packages/auth`/SSO. Cookie `artificio_theme` já é contrato existente (site/accounts). Sem DNS/subdomínio/schema.

## Impacto em consumidores
- Header/Footer mudam em site, accounts, mesas, glossário (todos consomem `@artificio/ui`). Por isso smoke de build dos 4 é obrigatório (pétrea).

## Rollback
- `git revert` do commit. Mudanças isoladas em packages/ui + consumo; reverter restaura estado anterior (favicon volta ao que era — incl. quebrado no glossário).

## Validação (como provo que funciona)
- `turbo build` (ou `pnpm --filter` por pacote) verde em packages/ui + 4 apps.
- Favicon: confirmar `<link rel="icon">` presente no HTML buildado do site e, nos SPAs, que `applyFavicon` injeta o link (preview/DOM). Zero `faviconV2.png` em `public/`/`dist` (exceto se gerado por import — não deve haver via /public).
- Rodapé: texto "presente" aparece 1× no Footer de cada app; ausente em LandingSection/App do glossário.
- Toggle: preview local — clique alterna `data-theme`, grava cookie `artificio_theme`, persiste em reload; site/accounts não regridem.

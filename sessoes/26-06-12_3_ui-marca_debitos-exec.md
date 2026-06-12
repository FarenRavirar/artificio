# Sessão 26-06-12_3 — Execução do backlog de débitos UX/marca

- **Data:** 2026-06-12
- **Objetivo:** executar os débitos registrados em `sessoes/26-06-12_2_debitos_ux-marca.md` (D-INFRA1, D-UX3, D-UX2, D-UX1, D-MARCA1).
- **Módulos:** accounts, glossario, mesas, site, packages/ui
- **Gate:** Fase 3 (Gate D mesas+glossário fechados). Nada de Gate C (WP/DNS intocáveis).
- **Estado:** aberta

## Vínculos
- Backlog: `sessoes/26-06-12_2_debitos_ux-marca.md`
- Pétreas: `packages/ui` (Footer/Header) = SDD Completo + smoke de glossario/mesas/site/accounts (auth/design sagrado).
- Tema cross-subdomínio = cookie `artificio_theme` (`Domain=.artificiorpg.com`), reusar mecanismo de site/accounts.
- git commit/push/merge/deploy/VM-write = aprovação explícita por ação (formato AGENTS.md). Cada deploy e cada módulo = aprovação separada.

## Decisão de processo
- `packages/ui` Footer (D-UX3) + Header toggle (D-UX2) = **uma spec SDD única** (decisão do mantenedor 2026-06-12). Um smoke dos 4 consumidores no fim.
- D-MARCA1: decisão registrada em D063; ajustar linguagem pública/produto para "projetos" e preservar "módulo" como termo técnico.

## Plano / ordem
1. **D-INFRA1** — favicon unificado `faviconV2.png` (Lite por app). Fonte canônica = `apps/mesas/frontend/public/faviconV2.png`. Cobrir site (link+asset), glossário (asset ausente), accounts (link+asset). mesas já OK.
2. **D-UX3** — dedup glossário (`LandingSection.tsx`/`App.tsx`) + mover "presente…" → `packages/ui/src/Footer.tsx`. [spec única, SDD Completo]
3. **D-UX2** — toggle tema (lua/sol) em `packages/ui/src/Header.tsx` reusando cookie `artificio_theme`. [mesma spec]
4. **D-UX1** — ícone lua/sol na login accounts (`main.tsx` + `styles.css`). Sai junto do passo 3.
5. **D-MARCA1** — rename público "módulo/modular" → "projetos"; documentação de retomada/produto ajustada; termo técnico preservado.

## Gate por item
editar local → build/tsc verde → validar (preview se observável) → aprovação commit/push/PR→dev → deploy beta (aprovação) → smoke → aprovação promote+prod → smoke + cross-módulo. Evidência aqui.

## Progresso

### Reframe (mantenedor 2026-06-12): compartilhado = FONTE ÚNICA importável
- Princípio: para trocar o favicon do projeto inteiro, mudar em **um lugar só** e propagar por **importação** de código compartilhado — sem cópia/sync (sync duplica = anti-padrão). Espelha o padrão dos logos (`brand.ts` data-URI).
- D-INFRA1 reclassificado de Lite → **SDD Completo** (toca `packages/ui`). Spec **017** criada cobrindo os 3 débitos compartilhados (favicon + Footer + Header toggle). Um smoke dos 4 consumidores.
- D-MARCA1: "serviços" → **"projetos"** (mantenedor trocou); débito atualizado.

### D-INFRA1 — favicon FONTE ÚNICA ✅ (local, build verde; aguarda aprovação commit)
- `packages/ui/src/brand.ts`: `faviconV2` (data-URI 16×16, 421 bytes) + `applyFavicon()` (upsert `<link rel=icon>`). `index.ts` reexporta.
- site (Astro): `import { faviconV2 }` em `Base.astro` → `<link>` build-time. accounts/glossário/mesas (Vite): `import { applyFavicon }` em `main.tsx`, injeta no boot.
- Removidos: `<link href="/faviconV2.png">` estáticos (accounts/glossário/mesas index.html) + as 4 cópias `public/faviconV2.png`. Fonte = só `packages/ui`.
- Builds verdes: ui (tsc) + site + accounts + glossario-fe + mesas-fe. Verificado: site dist tem `<link rel=icon href=data:...>`; SPAs trazem o data-URI no bundle; zero `faviconV2.png` em dist/public.

### D-UX3 — dedup glossário + "presente" no Footer ✅ (local, build verde; aguarda aprovação commit)
- `packages/ui/src/Footer.tsx`: nova `<p class="artificio-footer-gift">` com a frase; CSS em `styles.css` (+ variante dark). glossário e mesas já consomem `<Footer>` → herdam.
- `apps/site/src/components/SiteFooter.astro` (footer próprio, espelha classes): frase adicionada.
- `apps/glossario/.../LandingSection.tsx`: removida a frase "presente" (agora vive no Footer); linha "Gratuito para sempre…" mantida.
- accounts: login não tem footer (card central, redesign 26-06-12_1) → frase não aplicável lá; não fabriquei footer.
- Pendência de decisão: badge "presente" do hero em `apps/glossario/.../App.tsx:123` ("Um presente… para a comunidade") — não removi (elemento de design). Ver pergunta ao mantenedor.
- Verificado: frase no site dist + bundles glossário/mesas; ausente em LandingSection.

### Decisões do mantenedor (2026-06-12)
- D-UX2 escopo: **mecanismo compartilhado + D-UX1 agora; dark de glossário/mesas depois** (specs próprias). Toggle não habilitado em glossário/mesas (sem CSS dark) p/ não virar botão no-op.
- Badge "presente" do hero do glossário (`App.tsx:123`): **manter**.
- Registrado **D062** em `decisions.md`.

### D-UX2 — mecanismo de tema compartilhado ✅ (local, build verde; toggle não habilitado em glossário/mesas)
- `packages/ui/src/theme.tsx` (novo): `Theme`, `readThemeCookie`/`writeThemeCookie`/`resolveTheme`/`applyTheme`/`setTheme` (cookie único `artificio_theme` `.artificiorpg.com`) + `ThemeIcon` (lua/sol) + `ThemeToggle` (botão autocontido). `index.ts` reexporta.
- `Header.tsx`: prop aditiva `showThemeToggle` (default false) renderiza `<ThemeToggle/>`. CSS `.artificio-theme-toggle` (+ variante dark) em `styles.css`.
- glossário/mesas: **não habilitados** (sem dark CSS) — backlog futuro.

### D-UX1 — ícone lua/sol na login accounts ✅ (local, build verde, validado em preview)
- `apps/accounts/.../main.tsx`: botão `.accounts-theme-toggle` troca texto → `<ThemeIcon theme={theme}/>` (importado de `@artificio/ui`), mantém estado/onClick próprios; +`aria-label`/`title`. `styles.css`: pill vira botão de ícone (inline-flex, padding 9px).

### Validação em preview
- **site** (build, :4321): `<link rel=icon>` = data-URI; `.artificio-footer-gift` presente (1×) com a frase. ✅
- **accounts** (vite preview client, :4323): favicon injetado por `applyFavicon` (data-URI); toggle = SVG (sem texto), `aria-label="Alternar tema"`; clique alterna `data-theme` light↔dark. ✅
- Smoke build (T10): packages/ui (tsc) + site + accounts + glossario-fe + mesas-fe = **5/5 verdes**.

### Pendente
- D-MARCA1 (rename "projetos"): **escopo definido pelo mantenedor 2026-06-12** — ajustar terminologia, depois documentação, depois fluxo até prod. Decisão **D063**: "projetos" na linguagem pública/produto; "módulo" preservado como termo técnico interno (arquitetura, gates, `apps/*`, workflows, `_deploy-module`, código).
- Spec **018** criada para D-MARCA1.
- [APROVAÇÃO] commit/push/PR→dev → deploy beta (por módulo) → smoke → promote prod → smoke cross-módulo.
- Backlog futuro: CSS dark de glossário/mesas → habilitar `showThemeToggle` nos headers deles.

### D-MARCA1 — terminologia "projetos" ✅ (local; build/validação verde)
- Spec **018** criada (`specs/018-ui-terminologia-projetos/`) por tocar `packages/ui` + docs.
- `packages/ui` Footer/Header: linguagem pública "Projetos do Artifício", "Hub de projetos..." e comentários de props ajustados.
- `packages/content`: descrição SEO pública ajustada para "Hub de projetos...".
- Site Astro espelhado (`SiteHeader`, `SiteFooter`, `content.ts`): aria/title/tagline/comentário ajustados.
- Accounts login: "acessar os projetos do Artifício".
- Docs de retomada/produto: `README.md`, `context-capsule.md`, `project-state.md`, spec 017 e backlog atualizados com D063.
- Preservado: "módulo" técnico em arquitetura, gates, `apps/*`, workflows, `_deploy-module`, código/identificadores e docs legados.

### Validação final 017/018
- Busca final: sem `Módulos do Artifício`, `Hub modular`, `acessar os módulos` nos arquivos-alvo públicos; novos textos encontrados como `Projetos do Artifício`, `Hub de projetos...`, `acessar os projetos...`.
- Builds verdes (2026-06-12): `@artificio/content`, `@artificio/ui`, `@artificio/site`, `@artificio/accounts`, `@artificio/glossario-frontend`, `@artificio/mesas-frontend`.
- Browser local site (`127.0.0.1:4321`): favicon data-URI OK, nav/footer usam `Projetos do Artifício`, sem label antigo.
- Accounts: build/bundle contém `Use sua conta Google para acessar os projetos do Artifício.`, `aria-label="Alternar tema"` e favicon data-URI. Preview estático não é confiável porque sem API `/api/auth/me` o SPA redireciona para `beta`; não indica regressão de produção.
- Warnings não-bloqueantes: `@import` CSS do mesas e chunks grandes de glossário/mesas já existentes no build.
- Branch criada automaticamente para o fluxo: `feat/ui-017-018-marca-projetos`. Sem commit/push ainda.

## Critério de conclusão
Cada item: build verde + validação + evidência registrada; `project-state.md` atualizado ao fechar a sessão. Commits/deploys só com aprovação por ação.

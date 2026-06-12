# Sessão 26-06-12_3 — Execução do backlog de débitos UX/marca

- **Data:** 2026-06-12
- **Objetivo:** executar os débitos registrados em `sessoes/26-06-12_2_debitos_ux-marca.md` (D-INFRA1, D-UX3, D-UX2, D-UX1, D-MARCA1).
- **Módulos:** accounts, glossario, mesas, site, packages/ui
- **Gate:** Fase 3 (Gate D mesas+glossário fechados). Nada de Gate C (WP/DNS intocáveis).
- **Estado:** fechada

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

### D-INFRA1 — favicon FONTE ÚNICA ✅ (entregue em beta/prod)
- `packages/ui/src/brand.ts`: `faviconV2` (data-URI 16×16, 421 bytes) + `applyFavicon()` (upsert `<link rel=icon>`). `index.ts` reexporta.
- site (Astro): `import { faviconV2 }` em `Base.astro` → `<link>` build-time. accounts/glossário/mesas (Vite): `import { applyFavicon }` em `main.tsx`, injeta no boot.
- Removidos: `<link href="/faviconV2.png">` estáticos (accounts/glossário/mesas index.html) + as 4 cópias `public/faviconV2.png`. Fonte = só `packages/ui`.
- Builds verdes: ui (tsc) + site + accounts + glossario-fe + mesas-fe. Verificado: site dist tem `<link rel=icon href=data:...>`; SPAs trazem o data-URI no bundle; zero `faviconV2.png` em dist/public. Deploy final: prod em `accounts`/`glossario`/`mesas`; site em beta.

### D-UX3 — dedup glossário + "presente" no Footer ✅ (entregue em beta/prod)
- `packages/ui/src/Footer.tsx`: nova `<p class="artificio-footer-gift">` com a frase; CSS em `styles.css` (+ variante dark). glossário e mesas já consomem `<Footer>` → herdam.
- `apps/site/src/components/SiteFooter.astro` (footer próprio, espelha classes): frase adicionada.
- `apps/glossario/.../LandingSection.tsx`: removida a frase "presente" (agora vive no Footer); linha "Gratuito para sempre…" mantida.
- accounts: login não tem footer (card central, redesign 26-06-12_1) → frase não aplicável lá; não fabriquei footer.
- Decisão do mantenedor: badge "presente" do hero em `apps/glossario/.../App.tsx:123` ("Um presente… para a comunidade") foi mantido como elemento de design.
- Verificado: frase no site dist + bundles glossário/mesas; ausente em LandingSection.

### Decisões do mantenedor (2026-06-12)
- D-UX2 escopo: **mecanismo compartilhado + D-UX1 agora; dark de glossário/mesas depois** (specs próprias). Toggle não habilitado em glossário/mesas (sem CSS dark) p/ não virar botão no-op.
- Badge "presente" do hero do glossário (`App.tsx:123`): **manter**.
- Registrado **D062** em `decisions.md`.

### D-UX2 — mecanismo de tema compartilhado ✅ (entregue; ativação glossário/mesas futura)
- `packages/ui/src/theme.tsx` (novo): `Theme`, `readThemeCookie`/`writeThemeCookie`/`resolveTheme`/`applyTheme`/`setTheme` (cookie único `artificio_theme` `.artificiorpg.com`) + `ThemeIcon` (lua/sol) + `ThemeToggle` (botão autocontido). `index.ts` reexporta.
- `Header.tsx`: prop aditiva `showThemeToggle` (default false) renderiza `<ThemeToggle/>`. CSS `.artificio-theme-toggle` (+ variante dark) em `styles.css`.
- glossário/mesas: **não habilitados** (sem dark CSS) — backlog futuro.

### D-UX1 — ícone lua/sol na login accounts ✅ (entregue em prod)
- `apps/accounts/.../main.tsx`: botão `.accounts-theme-toggle` troca texto → `<ThemeIcon theme={theme}/>` (importado de `@artificio/ui`), mantém estado/onClick próprios; +`aria-label`/`title`. `styles.css`: pill vira botão de ícone (inline-flex, padding 9px).

### Validação em preview
- **site** (build, :4321): `<link rel=icon>` = data-URI; `.artificio-footer-gift` presente (1×) com a frase. ✅
- **accounts** (vite preview client, :4323): favicon injetado por `applyFavicon` (data-URI); toggle = SVG (sem texto), `aria-label="Alternar tema"`; clique alterna `data-theme` light↔dark. ✅
- Smoke build (T10): packages/ui (tsc) + site + accounts + glossario-fe + mesas-fe = **5/5 verdes**.

### Pendência resolvida no fluxo
- D-MARCA1 (rename "projetos") foi executado pela spec **018**. Decisão **D063**: "projetos" na linguagem pública/produto; "módulo" preservado como termo técnico interno (arquitetura, gates, `apps/*`, workflows, `_deploy-module`, código).
- Aprovações por ação foram recebidas para commit/push/PR→dev, deploy beta, merge PR, promoção prod e deploy prod.
- Backlog futuro preservado: CSS dark de glossário/mesas → habilitar `showThemeToggle` nos headers deles.

### D-MARCA1 — terminologia "projetos" ✅ (entregue em beta/prod)
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
- Branch do fluxo: `feat/ui-017-018-marca-projetos`; commit `90e690b`; PR #23; merge em `dev` por squash `7d90cb8`; promoção `main` por fast-forward.

### Fluxo GitHub/Beta — 017/018 ✅
- Commit autorizado e criado: `90e690b feat(ui): unificar marca e terminologia`.
- PR aberto e aprovado por checks: `#23` (`feat/ui): unificar marca e terminologia`), branch `feat/ui-017-018-marca-projetos`.
- Merge PR→`dev` autorizado e concluído por squash: `7d90cb8 feat(ui): unificar marca e terminologia`; branch remota de feature removida.
- Push `dev` disparou CI/deploy: `pr-checks`, `promote-dev-to-main` (guarda), `deploy-accounts` CI-only, `deploy-mesas` beta, `deploy-site` CI-only, `deploy-glossario` CI-only: todos verdes.
- Deploy beta dispatch autorizado e concluído:
  - `deploy-site` run `27433587211`: sucesso (`Deploy site beta` verde).
  - `deploy-glossario` run `27433589180`: sucesso.
  - `deploy-mesas` beta já havia subido automaticamente no push `dev` (`27433235324`): sucesso.

### Smoke beta pós-deploy ✅
- `https://beta.artificiorpg.com/` 200; `/healthz` 200; `/blog/` 200; `/admin/status` 401.
- HTML de `beta.artificiorpg.com`: contém `Projetos do Artifício`, contém `Hub de projetos de RPG em português`, contém favicon `data:image/png`; não contém `Módulos do Artifício` nem `Hub modular`.
- `https://glossariobeta.artificiorpg.com/` 200; `/api/terms` 200.
- `https://mesasbeta.artificiorpg.com/` 200; `/api/v1/me/options` 401; `/api/v1/auth/google` 302 para `accounts.artificiorpg.com/login?return=...`.
- Comparação pré-prod: `origin/main` = `bdbd89f`; `origin/dev` = `7d90cb8`; `origin/main..origin/dev` contém apenas `7d90cb8 feat(ui): unificar marca e terminologia`.
- Próximo passo foi executado após aprovação explícita: promoção `dev -> main` por `promote-prod-fast-forward.yml` e deploy prod de accounts, glossário e mesas. Site permanece beta-only (Gate C adiado; raiz/WP intocáveis).

### Produção — 017/018 ✅
- Aprovação explícita recebida para promover `dev -> main` e despachar deploy prod de `accounts`, `glossario` e `mesas`.
- Promoção fast-forward concluída: `promote-prod-fast-forward` run `27434738197` sucesso; `origin/main == origin/dev == 7d90cb805ec41b67fedcf2f33a8d326698cf249d`.
- Deploys prod concluídos com sucesso:
  - `deploy-accounts` run `27434803027`.
  - `deploy-glossario` run `27434806734`.
  - `deploy-mesas` run `27434810258`.
- Smoke prod read-only:
  - `https://accounts.artificiorpg.com/health` 200; `/login` 200; `/api/auth/me` sem cookie 401.
  - Bundle JS de `accounts` contém "acessar os projetos", `Alternar tema` e favicon `data:image/png`.
  - `https://glossario.artificiorpg.com/` 200; `/api/terms` 200; HTML sem `Módulos do Artifício`/`Hub modular`.
  - `https://mesas.artificiorpg.com/` 200; `/api/v1/me/options` sem cookie 401; `/api/v1/auth/google` 302 para `accounts.artificiorpg.com/login?return=https%3A%2F%2Fmesas.artificiorpg.com%2F`.
  - Guarda Gate C: `https://artificiorpg.com/` 200 (WordPress raiz intocado).
- Site novo permanece somente em `beta.artificiorpg.com`; nenhum cutover/DNS raiz/WordPress foi tocado.

### Fechamento
- Specs 017 e 018 entregues em produção para os projetos com produção (`accounts`, `glossario`, `mesas`) e em beta para o `site`.
- Backlog futuro preservado: habilitar CSS dark/toggle em glossário+mesas após specs próprias; CDX-310 segue pendente.
- Fechamento documental pós-prod (sem commit, a pedido do mantenedor): `project-state.md`, `context-capsule.md`, `sessoes/index.md`, backlog `26-06-12_2` e specs 017/018 atualizados para refletir produção. Smoke read-only refeito: accounts health/login/me, glossário home/API, mesas home/API, WP raiz e site beta todos responderam conforme esperado.

## Critério de conclusão
Cada item: build verde + validação + evidência registrada; `project-state.md` atualizado ao fechar a sessão. Commits/deploys só com aprovação por ação.

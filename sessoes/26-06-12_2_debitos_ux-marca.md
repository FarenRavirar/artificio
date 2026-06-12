# Sessão 26-06-12_2 — Débitos técnicos (UX / marca / terminologia)

- **Data:** 2026-06-12
- **Tipo:** backlog de débitos (NÃO executar nesta sessão — só registrar). Cada item vira sua própria sessão/branch quando for feito.
- **Módulos afetados:** accounts, glossario, mesas, site, packages/ui
- **Estado:** aberta (registro de débitos; nada implementado)

> Itens levantados pelo mantenedor em 2026-06-12 após promoção do glossário SSO (015) a prod. Pétreas: mudança em `packages/ui` = SDD Completo + smoke de todos os consumidores (auth/design sagrado). Terminologia em governança = decisão registrada.

## D-UX1 — Ícone de tema (lua/sol) na tela de login do accounts
- **O quê:** `beta.artificiorpg.com` tem ícone de lua que alterna claro/escuro. A login do `accounts.` tem só toggle em **texto** ("Tema claro/escuro").
- **Trocar por ícone** lua/sol, igual ao site.
- **Locais:** `apps/accounts/frontend/src/main.tsx` (botão `.accounts-theme-toggle`, atualmente texto) + `apps/accounts/frontend/src/styles.css`. Referência do ícone/comportamento: `apps/site/src/components/SiteHeader.astro:36` (`#theme-toggle`, `aria-label="Alternar tema"`) + lógica em `apps/site/src/layouts/Base.astro`.
- **Nota:** lógica de tema já existe no `main.tsx` (cookie `artificio_theme` `Domain=.artificiorpg.com`). Só falta trocar o gatilho de texto → ícone.
- **Escopo:** apps/accounts (SSO — cuidado, mas é CSS/JSX presentational).

## D-UX2 — Mesmo ícone + funcionalidade de tema no glossário e mesas
- **O quê:** glossário e mesas não têm toggle de tema. Adicionar o mesmo ícone lua/sol e a funcionalidade.
- **Tema é cross-subdomínio:** cookie `artificio_theme` (`.artificiorpg.com`) já usado por site/accounts. Reusar o mesmo mecanismo (não inventar outro).
- **Locais:** ideal = ação de toggle no **`packages/ui/src/Header.tsx`** (shell compartilhado) → todos os módulos herdam de uma vez. Consumidores: `apps/glossario/.../GlossarioHeader.tsx`, header do mesas, `apps/accounts`/`apps/site`.
- **Nível SDD:** **Completo** (`packages/ui` = compartilhado; smoke de todos os módulos). Decidir: toggle no Header compartilhado (preferido) vs por módulo.

## D-UX3 — Glossário: duplicação de texto + mover "presente" pro rodapé
- **Duplicação:** "Gratuito para sempre · Sem anúncios · Sem coleta de dados pessoais" + "Este é um presente da Artifício RPG para toda a comunidade brasileira de RPG. Compartilhe com seus grupos!" aparecem repetidos.
- **Locais da duplicação:** `apps/glossario/frontend/src/components/LandingSection.tsx` e `apps/glossario/frontend/src/App.tsx`. Remover a repetição.
- **Mover** o texto "Este é um presente da Artifício RPG para toda a comunidade brasileira de RPG. Compartilhe com seus grupos!" para o **rodapé principal compartilhado** → `packages/ui/src/Footer.tsx` → aparece em **todos os módulos**.
- **Nível SDD:** **Completo** (`packages/ui` Footer = compartilhado).

## D-MARCA1 — Renomear conceito público "módulo"/"modular" → "projetos"
- **O quê:** trocar o conceito e nome de "módulo"/"modular" (e correlatos) para **"projetos"** na linguagem do produto. (Atualizado 2026-06-12: mantenedor trocou "serviços" → "projetos".)
- **Locais (UI voltada ao usuário, prioridade):** texto "acessar os **módulos** do Artifício" em `apps/accounts/frontend/src/main.tsx`; labels/nav e `MODULES` const em `packages/ui` (`defaultNavItems`) + `apps/site` (`MODULES`); demais textos de UI.
- **Decisão D063 (2026-06-12):** linguagem pública/produto + docs de retomada usam **"projetos"**; "módulo" fica preservado como termo técnico interno (arquitetura, gates, `apps/*`, workflows, `_deploy-module`, código).
- **Nível SDD:** Completo se tocar `packages/*`/governança; Lite se só textos de um app.

## D-INFRA1 — Favicon de FONTE ÚNICA que espalha para todos os apps
- **Princípio (mantenedor, 2026-06-12):** o que é compartilhado tem que ter fonte única. Para trocar o favicon do projeto inteiro, mudar em **um lugar só** e propagar para todos os apps automaticamente. Sem N cópias soltas que divergem.
- **Estado real conferido (2026-06-12):** asset existia só em `apps/mesas/frontend/public/faviconV2.png` (fonte de fato); glossário tinha `<link rel="icon">` mas **asset ausente** (favicon quebrado); accounts sem link e sem asset; site sem link e sem public dir. → cópias divergentes = exatamente o anti-padrão a eliminar.
- **Alvo:** asset canônico em **`packages/ui`** (mesmo lar dos logos `_logo*.png`/`brand.ts`); apps puxam de lá. Mecanismo a decidir (ver opções na sessão de execução). `packages/ui` = **SDD Completo** (compartilhado) + smoke de site/glossário/mesas/accounts.
- **Escopo:** packages/ui (fonte) + apps/site, apps/glossario, apps/mesas, apps/accounts (consumo). Auth/design sagrado.

## D-INFRA2 — Auditar código duplicado que deveria ser importação compartilhada
- **O quê:** escanear o monorepo inteiro atrás de código/assets/UX que hoje estão **duplicados** por módulo mas deveriam ter **fonte única em `packages/*` consumida por importação** (princípio D062). Ex.: favicon (já tratado na 017), logos, helpers de tema/cookie, utilitários repetidos, blocos de UI espelhados (ex.: `SiteFooter.astro` espelha `Footer.tsx`), normalizers, fetch/auth client wrappers.
- **Estado:** só REGISTRO. **NÃO investigar ainda.** Quando executar: levantar a lista de duplicações, classificar (o que centralizar em `packages/*`, o que deixar), e abrir specs por caso. `packages/*` = SDD Completo.
- **Escopo:** todo o monorepo (auditoria read-only primeiro). Ref: D062.

## D-MARCA2 — Laranja padrão geral = #E8521A (não #FF9457)
- **O quê:** o laranja padrão geral do projeto é **`#E8521A`**, não `#FF9457`. Atualizar onde o laranja de marca está como `#FF9457` para `#E8521A`.
- **CONFLITO com decisão firme D040:** D040 fixou `#FF9457` (amostra pixel de `midias/cropped-Logo-PNG-Negativo-2.png`) como laranja-padrão e a CDX-311 já trocou `#E8521A`→`#FF9457` em vários arquivos. Esta dívida **reverte** isso. Antes de aplicar: registrar **decisão nova que supera D040** em `.specify/memory/decisions.md` (confirmar com mantenedor o hex canônico e a fonte) — senão volta o vai-e-vem.
- **Locais prováveis:** `packages/ui` (tokens/`brand.ts`/`styles.css`), `apps/mesas` (vars + arquivos tocados na CDX-311), demais usos do token de marca.
- **Estado:** só REGISTRO. Não aplicar sem a decisão superando D040.
- **Nível SDD:** Completo (`packages/ui` = compartilhado; afeta todos os módulos).

## Sugestão de ordem
1. D-INFRA1 (favicon) — rápido, isolado.
2. D-UX3 (dedup + Footer) — `packages/ui`, SDD Completo.
3. D-UX2 (toggle no Header compartilhado) — `packages/ui`, SDD Completo (casa com D-UX3).
4. D-UX1 (ícone na login accounts) — pode sair junto do D-UX2.
5. D-MARCA1 (rename serviços) — precisa decisão de escopo antes; maior risco de retrabalho.

## Fechamento
Sessão de registro. Nada implementado. Cada item executa em sessão/branch própria com aprovação por ação (commit/push/deploy = mantenedor).

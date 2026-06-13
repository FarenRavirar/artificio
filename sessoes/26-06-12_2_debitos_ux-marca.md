# Sessão 26-06-12_2 — Débitos técnicos (UX / marca / terminologia)

- **Data:** 2026-06-12
- **Tipo:** backlog de débitos. Execução parcial registrada em sessão própria; itens remanescentes continuam como backlog.
- **Módulos afetados:** accounts, glossario, mesas, site, packages/ui
- **Estado:** parcialmente executada (017/018 concluídas; 019 auditoria concluída; 020 em andamento; novos débitos D-CONT1/D-MESAS1/D-FEEDBACK1 registrados)

> Itens levantados pelo mantenedor em 2026-06-12 após promoção do glossário SSO (015) a prod. Pétreas: mudança em `packages/ui` = SDD Completo + smoke de todos os consumidores (auth/design sagrado). Terminologia em governança = decisão registrada.

## Atualização 2026-06-13
- Pedido do mantenedor: ajustar governança para comunicação padrão em **caveman ultra**, registrar débitos urgentes de changelog, corrigir o débito da logo responsiva, adicionar arquivamento de mesas e replicar feedback bug/melhoria para site+glossário.
- Arquivos a modificar: `AGENTS.md`, `.specify/memory/decisions.md`, `docs/agents/context-capsule.md`, `.specify/memory/project-state.md`, `specs/020-ui-theme-artificio-padrao/tasks.md`, `sessoes/26-06-12_7_ui-theme-020-dark-readiness.md` e esta sessão.
- Critério de conclusão: buscas por `caveman`, `changelog`, `arquivar`, `reportar` e `dinamismo` refletem o novo estado sem criar spec paralela.

### D-CONT1 execução
- Pesquisa local: `project-state.md`, `decisions.md`, sessões 015/017/018/020 e mecanismos de changelog dos apps.
- Escopo de edição: `apps/mesas/database/changelogs.json` (JSON publicado) e novo `apps/glossario/database/migration_15_changelog_ui_sso_updates.sql` (idempotente).
- Conteúdo: entradas públicas sobre login único/conta compartilhada, visual/nav Artifício, e canal de feedback no mesas. Tema lua/sol fica fora do PROD; mencionar só quando promovido.
- Validação: parse do JSON, grep das entradas, e checagem da migration idempotente. Sem VM, sem banco prod, sem commit/push.

## D-UX1 — Ícone de tema (lua/sol) na tela de login do accounts
- **Status:** ✅ executado na spec 017 e deployado em produção (`accounts`, run `27434803027`).
- **O quê:** `beta.artificiorpg.com` tem ícone de lua que alterna claro/escuro. A login do `accounts.` tem só toggle em **texto** ("Tema claro/escuro").
- **Trocar por ícone** lua/sol, igual ao site.
- **Locais:** `apps/accounts/frontend/src/main.tsx` (botão `.accounts-theme-toggle`, atualmente texto) + `apps/accounts/frontend/src/styles.css`. Referência do ícone/comportamento: `apps/site/src/components/SiteHeader.astro:36` (`#theme-toggle`, `aria-label="Alternar tema"`) + lógica em `apps/site/src/layouts/Base.astro`.
- **Nota:** lógica de tema já existe no `main.tsx` (cookie `artificio_theme` `Domain=.artificiorpg.com`). Só falta trocar o gatilho de texto → ícone.
- **Escopo:** apps/accounts (SSO — cuidado, mas é CSS/JSX presentational).

## D-UX2 — Mesmo ícone + funcionalidade de tema no glossário e mesas
- **Status:** parcialmente executado. ✅ mecanismo compartilhado criado na spec 017 (`packages/ui`); ⏳ habilitar dark/toggle em glossário e mesas foi absorvido pela **Spec 020 — Theme Artifício padrão**, porque depende de tokens/dark readiness e não deve virar spec visual paralela.
- **O quê:** glossário e mesas não têm toggle de tema. Adicionar o mesmo ícone lua/sol e a funcionalidade.
- **Tema é cross-subdomínio:** cookie `artificio_theme` (`.artificiorpg.com`) já usado por site/accounts. Reusar o mesmo mecanismo (não inventar outro).
- **Locais:** ideal = ação de toggle no **`packages/ui/src/Header.tsx`** (shell compartilhado) → todos os módulos herdam de uma vez. Consumidores: `apps/glossario/.../GlossarioHeader.tsx`, header do mesas, `apps/accounts`/`apps/site`.
- **Nível SDD:** **Completo** (`packages/ui` = compartilhado; smoke de todos os módulos). Decidir: toggle no Header compartilhado (preferido) vs por módulo.

## D-UX3 — Glossário: duplicação de texto + mover "presente" pro rodapé
- **Status:** ✅ executado na spec 017 e deployado em beta/prod conforme escopo. Badge "presente" do hero foi mantido por decisão do mantenedor.
- **Duplicação:** "Gratuito para sempre · Sem anúncios · Sem coleta de dados pessoais" + "Este é um presente da Artifício RPG para toda a comunidade brasileira de RPG. Compartilhe com seus grupos!" aparecem repetidos.
- **Locais da duplicação:** `apps/glossario/frontend/src/components/LandingSection.tsx` e `apps/glossario/frontend/src/App.tsx`. Remover a repetição.
- **Mover** o texto "Este é um presente da Artifício RPG para toda a comunidade brasileira de RPG. Compartilhe com seus grupos!" para o **rodapé principal compartilhado** → `packages/ui/src/Footer.tsx` → aparece em **todos os módulos**.
- **Nível SDD:** **Completo** (`packages/ui` Footer = compartilhado).

## D-MARCA1 — Renomear conceito público "módulo"/"modular" → "projetos"
- **Status:** ✅ executado na spec 018 e deployado em produção para `accounts`/`glossario`/`mesas`; `site` atualizado no beta. Decisão D063 registrada.
- **O quê:** trocar o conceito e nome de "módulo"/"modular" (e correlatos) para **"projetos"** na linguagem do produto. (Atualizado 2026-06-12: mantenedor trocou "serviços" → "projetos".)
- **Locais (UI voltada ao usuário, prioridade):** texto "acessar os **módulos** do Artifício" em `apps/accounts/frontend/src/main.tsx`; labels/nav e `MODULES` const em `packages/ui` (`defaultNavItems`) + `apps/site` (`MODULES`); demais textos de UI.
- **Decisão D063 (2026-06-12):** linguagem pública/produto + docs de retomada usam **"projetos"**; "módulo" fica preservado como termo técnico interno (arquitetura, gates, `apps/*`, workflows, `_deploy-module`, código).
- **Nível SDD:** Completo se tocar `packages/*`/governança; Lite se só textos de um app.

## D-INFRA1 — Favicon de FONTE ÚNICA que espalha para todos os apps
- **Status:** ✅ executado na spec 017 e deployado em beta/prod conforme escopo. Fonte única ficou em `packages/ui/src/brand.ts` (`faviconV2` data-URI + `applyFavicon()`); cópias em `public/` removidas.
- **Princípio (mantenedor, 2026-06-12):** o que é compartilhado tem que ter fonte única. Para trocar o favicon do projeto inteiro, mudar em **um lugar só** e propagar para todos os apps automaticamente. Sem N cópias soltas que divergem.
- **Estado real conferido (2026-06-12):** asset existia só em `apps/mesas/frontend/public/faviconV2.png` (fonte de fato); glossário tinha `<link rel="icon">` mas **asset ausente** (favicon quebrado); accounts sem link e sem asset; site sem link e sem public dir. → cópias divergentes = exatamente o anti-padrão a eliminar.
- **Alvo:** asset canônico em **`packages/ui`** (mesmo lar dos logos `_logo*.png`/`brand.ts`); apps puxam de lá. Mecanismo a decidir (ver opções na sessão de execução). `packages/ui` = **SDD Completo** (compartilhado) + smoke de site/glossário/mesas/accounts.
- **Escopo:** packages/ui (fonte) + apps/site, apps/glossario, apps/mesas, apps/accounts (consumo). Auth/design sagrado.

## D-INFRA2 — Auditar código duplicado que deveria ser importação compartilhada
- **O quê:** escanear o monorepo inteiro atrás de código/assets/UX que hoje estão **duplicados** por módulo mas deveriam ter **fonte única em `packages/*` consumida por importação** (princípio D062). Ex.: favicon (já tratado na 017), logos, helpers de tema/cookie, utilitários repetidos, blocos de UI espelhados (ex.: `SiteFooter.astro` espelha `Footer.tsx`), normalizers, fetch/auth client wrappers.
- **Estado:** ✅ auditoria executada na **Spec 019**. Resultado: inventário com achados classificados. Subconjunto visual/comum foi absorvido pela **Spec 020**; itens não-visuais seguem como specs futuras (config/auth, auth client, deploy, analytics, SEO, normalizers).
- **Escopo:** todo o monorepo (auditoria read-only primeiro). Ref: D062.

## D-CONT1 — URGENTE: atualizar changelogs de mesas e glossário
- **Status:** ✅ resolvido localmente em 2026-06-13. Produção depende de commit/push/deploy autorizados.
- **Prioridade:** urgente.
- **O quê:** atualizar os changelogs públicos do `mesas` e do `glossario` para refletir as mudanças recentes que chegaram aos usuários, especialmente SSO, tema lua/sol quando promovido, ajustes de marca/nav e demais mudanças visíveis.
- **Locais alterados:** `apps/mesas/database/changelogs.json`; `apps/glossario/database/migration_15_changelog_ui_sso_updates.sql`.
- **Feito:** Mesas ganhou entrada publicada sobre login único/visual compartilhado e a entrada já existente de feedback foi publicada. Glossário ganhou migration idempotente com entradas sobre conta única e visual/navegação alinhados ao Artifício.
- **Atenção:** glossário usa DB/migration para changelog; mesas usa JSON servido por backend. Não houve escrita em banco/VM.
- **Nível SDD:** Lite por app se for só conteúdo local de changelog; Completo se virar componente compartilhado ou migration/produção.

## D-MESAS1 — Arquivar mesas manualmente e autoarquivar após 1 mês em produção
- **O quê:** adicionar no `mesas` a função de **arquivar mesas**.
- **Regra automática:** mesas publicadas há mais de **1 mês** devem ser arquivadas automaticamente **apenas no PROD**. Beta/local não devem autoarquivar por idade para não bagunçar teste/hydrate.
- **Requisitos mínimos:** status/flag de arquivamento; ação manual para responsável/admin conforme regra do produto; filtro no catálogo público para esconder arquivadas por padrão; rotina agendada/cron prod-only; registro em changelog quando entregue.
- **Risco:** toca regra de negócio e possivelmente banco/cron. Qualquer migration/SQL em prod exige aprovação e checklist.
- **Nível SDD:** SDD Lite se restrito ao `apps/mesas`; SDD Completo se tocar shared, CI/CD/cron compartilhado ou migration produtiva.

## D-FEEDBACK1 — Site principal e glossário com ferramenta de reportar bug/sugerir melhoria
- **O quê:** levar para `site` e `glossario` a mesma ferramenta que o `mesas` já tem para **reportar bug** e **sugerir melhoria**.
- **Referência:** `apps/mesas/frontend/src/features/dev-feedback/FeedbackButton.tsx`, `FeedbackModal.tsx` e painel/admin correspondente.
- **Escopo desejado:** experiência e linguagem iguais entre projetos; persistência pode ser por app no começo, mas avaliar se deve virar fonte única em `packages/ui`/backend compartilhado antes de duplicar.
- **Atenção:** se a solução virar componente compartilhado ou contrato cross-app, aplicar SDD Completo e smoke em consumidores; se for port local por app, SDD Lite por módulo.
- **Nível SDD:** provável SDD Completo se reutilizar estrutura comum; Lite se apenas replicar localmente em `site` ou `glossario`.

## D-CSS1 — Limpeza futura do aviso CSS no build Astro
- **Origem:** revisão Spec 020 T9/B2 (caminho Astro/zero-JS), 2026-06-13.
- **Evidência:** `pnpm --filter @artificio/site build` verde com `output: static`, 45 páginas + Pagefind; aviso não bloqueante: `@import rules must precede all rules`.
- **Causa provável:** `@import url(...)` de fontes em `packages/ui/src/styles.css` fica depois de regra quando o site importa `@artificio/ui/styles.css` via `apps/site/src/styles/global.css`.
- **Impacto:** não quebra T9, build nem runtime; é higiene/compat CSS.
- **Alvo:** limpar em fatia futura movendo import de fonte para ordem CSS válida ou criando mecanismo static-friendly equivalente para fontes.
- **Nível SDD:** Completo se tocar `packages/ui` (CSS compartilhado); Lite se a correção ficar restrita ao `apps/site`.

## D-MARCA2 — Laranja padrão geral = #E8521A (não #FF9457)
- **O quê:** o laranja padrão geral do projeto é **`#E8521A`**, não `#FF9457`. Atualizar onde o laranja de marca está como `#FF9457` para `#E8521A`.
- **CONFLITO com decisão firme D040:** D040 fixou `#FF9457` (amostra pixel de `midias/cropped-Logo-PNG-Negativo-2.png`) como laranja-padrão e a CDX-311 já trocou `#E8521A`→`#FF9457` em vários arquivos. Esta dívida **reverte** isso. Antes de aplicar: registrar **decisão nova que supera D040** em `.specify/memory/decisions.md` (confirmar com mantenedor o hex canônico e a fonte) — senão volta o vai-e-vem.
- **Locais prováveis:** `packages/ui` (tokens/`brand.ts`/`styles.css`), `apps/mesas` (vars + arquivos tocados na CDX-311), demais usos do token de marca.
- **Estado:** absorvido pela **Spec 020 — Theme Artifício padrão** como decisão de paleta antes de runtime. Não aplicar sem decisão formal superando/reinterpretando D040.
- **Nível SDD:** Completo (`packages/ui` = compartilhado; afeta todos os módulos).

## Sugestão de ordem
0. ✅ D-CONT1 — atualizar changelogs de mesas e glossário (resolvido localmente; publicar exige fluxo Git/deploy).
1. ✅ D-INFRA1 + D-UX3 + mecanismo D-UX2 + D-UX1 — entregues pela spec 017.
2. ✅ D-MARCA1 — entregue pela spec 018.
3. ✅ D-INFRA2 — auditoria executada pela spec 019.
4. ⏳ Spec 020 — executar o Theme Artifício padrão: D-UX2 visual completo + D-MARCA2/paleta + achados visuais da 019.
5. ⏳ D-MESAS1 — arquivar mesas manual/auto prod-only após 1 mês.
6. ⏳ D-FEEDBACK1 — portar reportar bug/sugerir melhoria para site e glossário.
7. ⏳ D-CSS1 — limpar aviso CSS `@import` de fontes no build Astro.
8. ⏳ Specs não-visuais derivadas da 019: config/auth, auth client, deploy, analytics, SEO, normalizers.

## Fechamento
Sessão de registro/backlog. Itens D-INFRA1, D-UX1, D-UX3 e D-MARCA1 foram executados na sessão `26-06-12_3_ui-marca_debitos-exec` via specs 017/018. D-INFRA2 foi auditado na spec 019. D-UX2 visual completo e D-MARCA2 foram absorvidos pela spec 020, evitando specs visuais concorrentes. Em 2026-06-13 foram adicionados D-CONT1 (urgente), D-MESAS1, D-FEEDBACK1 e D-CSS1; B8 da logo foi quitado na spec 020 como responsividade mobile. D-CONT1 foi resolvido localmente no mesmo dia com changelogs de mesas/glossário atualizados. Itens não-visuais da 019 seguem no backlog derivado. Commit/push/deploy seguem exigindo aprovação por ação.

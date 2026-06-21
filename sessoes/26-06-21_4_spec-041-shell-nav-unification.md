# Sessão: Spec 041 — Unificação do shell/nav (investigação + planejamento)

**Data:** 2026-06-21
**Objetivo:** Investigar por que o nav/header NÃO é realmente compartilhado entre os projetos e abrir spec completa de unificação (caveman/investigação, **0 código**).
**App/Pacote:** `packages/ui` + consumidores (site/glossario/mesas/accounts/links)
**Gate:** nenhum (Fase 3, débito de arquitetura UX)
**Modo:** SDD Completo (planejamento). Nenhuma autorização de commit/push/deploy.

---

## Vínculos
- Spec: `specs/041-ui-shell-nav-unification/{spec.md,plan.md,tasks.md}`
- Débitos: `BL-SHELL-B13`, `D-SHELL1` (alvo de fechamento via 041); `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-UI-THEME-REACT-HEADER-VARIANT` (resolvidos por construção); `D-PROMOTE-033-UPGRADES-REGRESSION` (dependência).
- Sessão relacionada: `sessoes/26-06-21_3_theme-regression.md`.

## Achados (investigação)
- **Centralização parcial.** Dados (lista de links) JÁ são fonte única: `packages/ui/src/modules.ts:6` `defaultNavItems`, consumido por React (`Header.tsx`) e Astro (`apps/site/src/lib/content.ts:75` `MODULES = defaultNavItems`).
- **Markup + botões forkados.** Site Astro reimplementa o header inteiro em `apps/site/src/components/SiteHeader.astro` (não usa `<Header>`); toggle de tema é JS inline duplicado (~4444 bytes em `Base.astro`). Causa raiz das dessincronizações (perdeu botão/tema no promote).
- **Botões por-app.** glossario (`GlossarioHeader.tsx:78`) e mesas (`AppShell.tsx:42`, `HeaderActions.tsx`) constroem o próprio botão de tema/changelog à mão e injetam via `actions`. "Adicionar botão no central" NÃO espelha hoje.
- **Busca:** só placeholder no site (`SiteHeader.astro:33`), sem ação; nada central.
- **Menu de conta divergente:** mesas tem `{label:'Conta', external}`; glossário não liga ao accounts.; links só "Painel admin". Sem padrão "Perfil Artifício + Conta &lt;Serviço&gt;".
- Regressões de tema (`BL-UI-THEME-*`) são SINTOMA do fork; unificar mata a classe de bug.

## Decisões do mantenedor (registradas na spec §3)
1. Site Astro → **Híbrido** (markup estático no build + ilha React mínima p/ sessão e toggle).
2. **Centralizar TODOS os botões padrão** (tema/changelog/busca/login) com interruptores; app só injeta o exclusivo.
3. **Padronizar menu de conta:** Perfil Artifício (accounts global) + Conta &lt;Serviço&gt; (local) + extras do app.

## Entregue nesta sessão
- `specs/041-ui-shell-nav-unification/spec.md` (contexto leigo, achados file:line, requisitos R1-R10, aceite, fora de escopo, riscos, perguntas abertas).
- `plan.md` (arquitetura "uma fonte, dois renderizadores", mudanças por camada, ordem, armadilhas).
- `tasks.md` (T0-T5 implementável por outra IA; tabela T-ROTAS a preencher com mantenedor).
- `specs/backlog.md`: `BL-SHELL-B13` e `D-SHELL1` linkados à spec 041.

## Backlog (verificação obrigatória)
- Atualizado: `BL-SHELL-B13`, `D-SHELL1` apontam p/ spec 041. Sem débito novo descoberto além dos já registrados. As 3 perguntas abertas (spec §8) ficam como pendência de decisão do mantenedor, não bug.

## Critério de conclusão (desta sessão = só planejamento)
- [x] Spec completa aberta (spec+plan+tasks) implementável por terceiro.
- [x] Achados registrados com evidência file:line.
- [x] Backlog linkado.
- [ ] `project-state.md` — atualizar "próximo passo" se o mantenedor priorizar a 041 (não feito sem pedido).
- [ ] Execução de código — **não autorizada nesta sessão**.

## Investigação 2ª rodada (decisões do mantenedor aplicadas)
- **accounts "gerenciar conta" quebrado = confirmado:** `apps/accounts` só tem tela de login (`src/app.ts:164` serve `/` e `/login`; backend só `/api/auth/google|me|logout|refresh`). **Não existe página de conta.** Por isso "Perfil Artifício" não aterrissa. → Conserto ENTRA na 041 (Fase 5: criar `/conta`).
- **PADRÃO DE UNIFORMIZAÇÃO (mantenedor):** conta global = **`/conta`** (accounts., igual em todos); conta local = **`/perfil`** em cada serviço (glossario **renomeia** `/profile`→`/perfil`; mesas já `/perfil`); busca = **`/busca`** em todos, **chamando a API**, botão **executa** a busca (não bounce). site/links/accounts sem conta local.
- **Busca real existente p/ consolidar em `/busca`+API:** glossario (`termController.ts`/`useGlossario`); mesas (`CatalogoPage.tsx:299` `?search=`); links (filtro `CommunityGroups`). accounts off. **site = não existe → implementar no FIM (Fase 6) chamando API.**
- Decisões: site **híbrido**; **centralizar todos botões** (com flags); **menu conta padronizado**.

## Entregue (2ª rodada)
- `tasks.md` reescrito: 9 fases (F0 setup/branch→F8 commit/PR/revisões), **gate de teste verde + PARADA por permissão a cada fase**, T-ROTAS preenchida, accounts `/conta` (F5), busca/Pagefind (F6).
- Branch: F0 cria `feat/041-ui-shell-nav-unification` **a partir do diff local atual** (não descartar `applyHeaderVariant` etc.).
- `task-revisões.md` criado: registro de revisões dos bots (nunca responder no PR); merge só após encerrar.
- `tasks-2.md` criado: **regra "nada para trás"** — toda descoberta da execução (bug, regressão, fora de escopo, efeito colateral) investiga + registra + resolve DENTRO da spec; proibido empurrar ao backlog sem decisão do mantenedor. Log vivo com template D-041-NN + gate de fechamento.
- `spec.md` §6/§8 atualizados (accounts `/conta` e busca site entraram no escopo).

## Fluxo combinado de entrega
DeepSeek executa fase a fase, testa→verde→para→espera permissão. Ao fim: mantenedor pede commit→PR→checks GitHub→revisões em `task-revisões.md`→merge só quando encerrar.

## Revisão de precisão da spec (3ª rodada — investigação contra código + contrato CSS)
Investiguei `packages/ui/src/styles.css`, `apps/site` (Base.astro, SiteHeader, SearchModal, SiteFooter), `apps/accounts` (app.ts, main.tsx), `packages/auth/client.ts`. Correções aplicadas (spec §9, §10, R11):
- **Site JÁ tem busca** (Pagefind `SearchModal.astro`, funcional em build/preview) — minha spec dizia "não existe". Corrigido. Conflito real com "/busca+API" (site é SSG sem API) → §10, decisão na F6 (recomendado: rota `/busca` + Pagefind).
- **Site JÁ lê o cookie de tema no boot** (`Base.astro:53-69`, head pré-paint) — minha hipótese "site não lê cookie" estava errada. Regressão = cache/upgrade, não mecanismo ausente. Corrigido (não reconstruir o que funciona).
- **accounts NÃO tem router** (`main.tsx` = 1 tela login; backend serve só `["/","/login"]`). `/conta` exige adicionar roteamento, não "só uma rota". Corrigido na F5.
- **SiteFooter.astro** é outro fork; **login do site é role-aware** via JS (`Base.astro:137-167`) — ilha React tem de preservar. Registrado.
- **Contrato CSS = segue o site** (R11): `styles.css:50` "Espelha o site"; reusar classes `artificio-*`, 2 eixos de tema (`data-theme` conteúdo / `data-variant` header), tokens navy `#020740`/laranja `#FF5722`. Botões centrais já têm classe (`.artificio-header-action`).
- Nomes de pacote p/ `--filter` verificados (`@artificio/mesas-frontend` etc.); `getAccountsOrigin()` retorna origin sem path (`/conta` ok).

## Execução (F0-F7)
Todas as fases executadas 2026-06-21. Build 15/15 ✅ após cada fase. 14 descobertas (D-041-01 a D-041-14) registradas em `tasks-2.md`, todas fechadas.

## F8 — Commit, PR, Revisões, Merge
- **Commit `ba2b647`:** feat(041) inicial — shell único cross-projeto (52 arquivos, +1899/-481)
- **Commit `b1c5fa0`:** 31 correções de revisão (15 reviews amazon-q/codex/coderabbit + 16 Sonar)
- **Commit `632604e`:** #16-#19 (CodeQL XSS/redirect falso-positivo + EventTarget guard + catch error)
- **PR #80** aberto para `dev`. Checks: lint+build+test ✅, CodeQL ✅, Snyk ✅, Semgrep ✅.
- **Merge `8981c84`** em `origin/dev` (autorizado pelo mantenedor).
- **19 achados de revisão** documentados em `task-revisões.md` (#1-#19). 16 Sonar aplicados.
- **Deploy beta** disparado para site/glossario/mesas (workflow_dispatch). accounts/links = PROD-only.

## F9 — Changelog cross-app
- `changelogs.json` criados/atualizados em 4 apps. Mesas + glossario + site + links padronizados.
- Glossario migrado de DB (`public.update_log`) para JSON; controller reescrito; `mergeUsers.ts` limpo.
- `ChangelogModal` centralizado em `packages/ui` (~500 linhas duplicadas eliminadas). 4 apps migrados.
- Auditoria independente: 53 ✅, 1 🛑 (AbortController signal corrigido), 6 ⚠️ cosméticos.
- `BL-GLOSSARIO-CHANGELOG-JSON` fechado. `BL-GLOSSARIO-CHANGELOG-CLEANUP` aberto (dropar tabela pós-deploy).
- 5 novas descobertas (D-041-16 a D-041-20) registradas em `tasks-2.md`, todas fechadas.
- Build 15/15 ✅.

## Critério de conclusão (desta sessão)
- [x] Spec completa aberta (spec+plan+tasks) implementável por terceiro.
- [x] Achados registrados com evidência file:line.
- [x] Backlog linkado.
- [x] F0-F9 executadas. PR #80 mergeado. Deploy beta disparado.
- [x] Changelog cross-app centralizado e auditado.
- [x] 20 descobertas (D-041-01 a D-041-20) todas fechadas.
- [x] 19 revisões de bots documentadas e resolvidas.
- [x] 16 Sonar code smells aplicados.

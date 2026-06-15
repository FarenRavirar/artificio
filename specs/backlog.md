# Backlog Geral de Specs e Debitos

> Mapa vivo das pendencias acionaveis. Atualizar ao abrir/fechar specs. Nao substituir `project-state.md`; este arquivo organiza o que falta por prioridade e origem.

## LEIA PRIMEIRO — regras de manutencao

- Ao criar spec: adicionar linha nesta tabela se houver debito novo.
- Ao fechar: registrar evidencia e mudar status/remover da lista ativa.
- Se uma pendencia precisar aprovacao nominal (`commit`, `push`, deploy, VM write, segredo), marcar `bloqueado`.
- Nao listar checklist historico ja superado; se a fonte antiga divergir, preferir `project-state.md` + sessao mais recente.
- Toda linha deve ter origem rastreavel (`specs/...`, `sessoes/...`, decisao `D###` ou erro `E###`).
- Task aberta em `tasks.md` nao precisa virar linha propria se estiver coberta por item agregado claro; registrar essa cobertura na sessao/spec da auditoria.
- Se decisao posterior mudou o caminho, mover o item antigo para fechado/absorvido ou atualizar o proximo passo para nao orientar agente errado.
- Este arquivo tem dois tipos de item:
  - `BL-*`: backlog/spec/fatia planejada.
  - `D-*`: debito nomeado vindo de sessoes/reviews.

## P0 — Seguranca / Infra / Deploy

| ID | Status | Origem | Escopo | Falta para fechar | Proximo passo |
|---|---|---|---|---|---|
| BL-ACCOUNTS-PORT | aberto | `specs/023`, `docs/agents/infra-map.md` | `apps/accounts/docker-compose.yml` | avaliar remover `ports: "3000:3000"` e trocar por `expose`, sem quebrar deploy/smoke SSO | abrir fatia de hardening ou incluir na continuidade da 023 |
| BL-CDX-310 | aberto | `project-state.md`, `specs/019` B4 | CI/CD accounts | reconciliar `deploy-accounts.yml` ao `_deploy-module.yml`; substituir shim operacional por compose versionado correto | criar spec/fatia infra; exige cuidado com SSO |
| BL-DEP-MESAS-LEGACY-SCRIPTS | aberto | `specs/019` FSU-012/B4 | deploy mesas | limpar/arquivar scripts legados `apps/mesas/scripts/deploy/*` depois que `_deploy-module` for a fonte unica | tratar junto de BL-CDX-310 ou em fatia infra pequena |
| BL-BETA-HYDRATE | bloqueado | `specs/005`, `project-state.md` | mesas beta | `PROD_DB_URL` read-only no `mesas-beta-api` + restart/deploy aprovado | mantenedor fornece/autoriza segredo + restart/deploy |
| BL-DEP-PATHFILTERS | aberto | `docs/agents/deploy-flow.md` | GitHub Actions | path-filters de deploy nao cobrem manifests raiz (`package.json`, lock, workspace, turbo) | spec infra propria; validar sem disparar deploy indevido |
| BL-DEP-CONTAINER-NAMES | futuro | `specs/009-infra-deploy-hardening/` T9, D050 | `_deploy-module`/composes | substituir `container_name` fixo por nomes por projeto compose, se o custo compensar | adiar ate nova dor real de colisao; toca health-check/deploy de varios apps |
| D-DEP1 | aberto | `sessoes/26-06-12_2_debitos_ux-marca.md` | Express em todos os backends | investigar/migrar tudo para Express 5 por app, sem big-bang | spec propria; auditar breaking changes e smokes por consumidor |
| D-DEP2 | aberto | `sessoes/26-06-12_2_debitos_ux-marca.md` | VM/toolchain/deps | atualizar apt, Node, pnpm, imagens Docker e deps npm com plano seguro | spec propria em fatias; backup/janela para VM |

## P1 — Produto / Apps

| ID | Status | Origem | Escopo | Falta para fechar | Proximo passo |
|---|---|---|---|---|---|
| BL-SITE-GATED | aberto | `specs/008`, `specs/011`, `project-state.md` | `apps/site`, `apps/site-admin` | Gate D site: validacao Opus/mantenedor, paridade editorial, E2E admin autenticado, midia real, SEO/redirects finais conforme fase | quebrar em fatias menores; nao tocar Gate C/WP raiz |
| BL-SITE-CMS-PARITY | aberto | `specs/011-site-cms-authoring/` | CMS/autoria | operacoes editoriais basicas, lixeira/restaurar/apagar, agendamento/autosave/revisoes, roles editoriais, dashboard/build status, redirects UI, auditoria | priorizar MVP editorial real antes de features novas |
| BL-LINKS-013 | bloqueado | `specs/013-links-regras-restore/` | `apps/links`, `regras.` | localizar artefato das paginas ou decidir refazer do zero; depois deploy `links.`/`regras.` | mantenedor indicar fonte ou aprovar rebuild |
| BL-NAV-LINKS-014 | bloqueado | `specs/014-ui-nav-whatsapp/` | nav compartilhada | adicionar item so apos `links.` no ar para evitar link morto | retomar depois de BL-LINKS-013 |
| BL-MESAS-EXPRESS5-016 | aberto | `specs/016-mesas-express5/`, E004 | `apps/mesas/backend` | migrar mesas para Express 5 e remover override `@types/multer>@types/express` | executar spec 016 com build/test/smoke beta |
| BL-FEEDBACK-MESAS-ANTIDRIFT | aberto | `specs/021-feedback-site-glossario/` notas FR-010 | `apps/mesas`, `packages/ui/feedback` | decidir se mesas deve consumir `@artificio/ui/feedback` para reduzir drift visual/comportamental | abrir fatia pequena quando mexer em feedback do mesas |
| BL-FEEDBACK-MERGE | futuro | `specs/021-feedback-site-glossario/` fora de escopo | feedback site/glossario | unificar/mesclar feedbacks entre projetos, se o produto pedir uma fila central | adiar ate haver dor operacional real |
| D-FEEDBACK1 | validacao | `specs/021-feedback-site-glossario/`, `project-state.md` | site + glossario | glossario foi para prod; site fica vivo em beta enquanto Gate C mantem WP na raiz; falta validacao admin/beta quando o site for retomado | validar admin/beta quando retomar site; nao acionar prod raiz antes do Gate C |
| D-SYNC1 | aberto | `sessoes/26-06-12_2_debitos_ux-marca.md` | mesas + glossario + bancos | sync inteligente sistemas/cenarios cross-app com merge, backup, dry-run | criar SDD Completo proprio antes de qualquer SQL |

## P1 — UI / Design System

| ID | Status | Origem | Escopo | Falta para fechar | Proximo passo |
|---|---|---|---|---|---|
| BL-UI-B2-STATIC | aberto | `specs/020` B2/T11 | `packages/ui`, `apps/site` | `@artificio/ui/static` ou teste de paridade real para brand/nav/footer Astro zero-JS | decidir abordagem static export vs teste de paridade |
| BL-UI-B3-HEADERACTION | aberto | `specs/020` B3 | `packages/ui` | componente/primitive visual-only `HeaderAction` | implementar em shared com smoke consumidores |
| BL-UI-B4-PRIMITIVES | aberto | `specs/020` B4 | `packages/ui` | primitives de formulario/estado; contrato ja descrito em `primitives-form-state.md` | implementar tokens -> primitives -> consumers |
| BL-UI-B6-E2E | validacao | `specs/020` B6, `specs/022` T7 | `apps/glossario` | readiness dark autenticado com dados/admin/forms/selects/validacao e medicao AA numerica formal | executar E2E/manual autenticado e registrar evidencias |
| BL-UI-B7-E2E | validacao | `specs/020` B7 | `apps/mesas` | E2E autenticado do mantenedor em prod: `/perfil` light com dados + mestre com `banner_url` custom | validar manualmente e fechar B7 |
| BL-UI-B12-FONTS | aberto | `specs/020` B12, `specs/022` T13 | `packages/ui`, site publico, apps | remover `@import` Google Fonts render-blocking e sistematizar Inter/Oswald em declaracao unica | criar fatia shared CSS/perf |
| BL-UI-RADIUS-SPACING | aberto | `specs/019` FSU-021 | `packages/ui`, apps consumidores | revisar escala visual de radius/shadow/spacing para evitar drift entre apps | tratar junto de primitives/recipes |
| BL-UI-T5-THEME-DEDUP | baixo | `specs/020` execution-priority Tier 4 | `apps/accounts`, `apps/site`, `packages/ui` | deduplicar helpers de tema em API `@artificio/ui/theme` | fazer quando voltar a tocar theme runtime |
| BL-022-SEMANTIC-VARS | aberto | `specs/022` T2/T3/T4 | `packages/ui/styles.css`, consumidores | implementar/validar variaveis semanticas e checklist AA por tela | concluir camada vars + parity antes de novas migrações grandes |
| BL-022-MESAS-T8-BETA | validacao | `specs/022` T8 | `apps/mesas` perfil | T8 ficou local/branch; falta prova visual com dados vivos em beta/prod antes de fechar definitivamente | validar apos publicacao autorizada da fatia |
| BL-022-MESAS-CATALOGO | aberto | `specs/022` T9 | `apps/mesas` catalogo publico | aplicar paleta/tokens/fontes e validar AA/responsivo | executar proxima fatia UI do mesas |
| BL-022-MESAS-PAINEL | aberto | `specs/022` T10 | `apps/mesas` painel mestre/gestao | aplicar paleta/tokens/fontes em painel, listas e estados | executar apos catalogo/perfil |
| BL-022-MESAS-FORMS | aberto | `specs/022` T11 | `apps/mesas` forms/modais/toasts | migrar forms multi-step, drawers, modais, toasts e css UI residual | executar com smoke de fluxos autenticados |
| BL-022-MESAS-REMOVE-REMAP | aberto | `specs/022` T12 | `apps/mesas` tema light | remover remap local `[data-theme="light"]` quando todas as telas dependerem dos tokens compartilhados | fazer apos T9-T11 |
| BL-022-ACCOUNTS-R7 | aberto | `specs/022` T14 | `apps/accounts` | decidir/migrar accounts para styles/tokens globais ou documentar excecao R7 | se migrar, rodar smoke SSO login/me/logout |
| BL-022-FINAL | bloqueado | `specs/022` T15 | tema global | validacao final, changelog e fechamento dependem das T2-T14 | fechar somente depois das fatias anteriores |
| BL-SHELL-B13 | aberto | `project-state.md`, `specs/020` | shell/nav/footer | unificar nav/footer entre projetos restantes, incluindo markup Astro/site e accounts quando aplicavel | dividir por fonte unica data/static e runtime React |
| D-UX2 | validacao | `sessoes/26-06-12_2_debitos_ux-marca.md`, `specs/020` B6/B7 | glossario + mesas tema | mecanismo existe; falta fechar readiness autenticado com dados em glossario/mesas | E2E mantenedor e registrar fechamento |
| D-SHELL1 | aberto | `sessoes/26-06-12_2_debitos_ux-marca.md`, `specs/020` B13 | shell/nav/footer | fonte unica de dados feita; residual Astro markup/accounts | seguir BL-SHELL-B13 |

## P2 — Shared / Conteudo / Observabilidade

| ID | Status | Origem | Escopo | Falta para fechar | Proximo passo |
|---|---|---|---|---|---|
| BL-CONFIG-AUTH | aberto | `specs/019` B2/B3 | `packages/config`, `packages/auth` | dominios/projetos canonicos + auth HTTP client compartilhado | SDD Completo; smoke todos consumidores SSO |
| BL-ANALYTICS | aberto | `specs/019` B5 | `packages/analytics`, glossario/mesas | glossario/mesas adotarem `@artificio/analytics` | fatia por app; validar sem coleta excessiva |
| BL-SEO-SHARED | aberto | `specs/019` B6 | `@artificio/content`, `@artificio/config` | helpers SEO por projeto/modulo alem do site | criar spec shared quando novo app publico precisar |
| BL-NORMALIZERS | aberto | `specs/019` B7 | site/site-admin/apps | issues por app para normalizacao de payload externo | iniciar por site/site-admin |
| BL-COPY-PUBLICA | aberto | `specs/019` B8/FSU-013 | copy publica compartilhada | decidir se textos publicos repetidos devem virar pacote/helper compartilhado ou permanecer por app | registrar decisao antes de criar abstracao |
| BL-GLOSSARIO-LEGACY-CLEAN | aberto | D061/project-state | `apps/glossario` | limpeza futura de `password_hash` legado apos migracao SSO estabilizada | spec/migration propria com backup e smoke |
| BL-GLOSSARIO-NONGOOGLE-E2E | baixo | `specs/015-glossario-sso-compat/` | `apps/glossario` login legado/migracao | E2E browser opcional para cenario seedado de usuario nao-Google/compat legado | fazer apenas se reabrir fluxo legado D061 ou houver regressao |

## Debitos fechados ou absorvidos (nao acionar sem nova evidencia)

| ID | Estado | Origem | Observacao |
|---|---|---|---|
| D-UX1 | fechado | spec 017 | Icone lua/sol em `accounts` entregue em prod. |
| D-UX3 | fechado | spec 017 | Texto duplicado do glossario/rodape tratado. |
| D-MARCA1 | fechado | spec 018 / D063 | Linguagem publica "projetos" entregue. |
| D-INFRA1 | fechado | spec 017 | Favicon fonte unica em `packages/ui`. |
| D-INFRA2 | fechado como auditoria | spec 019 | Gerou backlog derivado; nao e item de implementacao sozinho. |
| BL-REALIP-023 | fechado | `specs/023-infra-real-ip-contract/`, sessao 26-06-15_1 | PR #39 mergeado; `dev -> main`; deploy prod accounts/mesas/glossario verde; `nginx -t`, config renderizada e smokes HTTP beta/prod OK. |
| D-NGINX1/D-NGINX2 | fechado | spec 023 / D069 | Virou contrato Real IP geral; fechado por BL-REALIP-023. |
| D-SHELL1b | fechado | release 2026-06-14 | Shell capado do glossario resolvido em prod. |
| D-MESAS1 | fechado | release 2026-06-14 / `project-state.md` | Arquivar mesas e `MESAS_CRON_SECRET` foram promovidos; reabrir so com nova evidencia. |
| D-CONT1 | fechado/absorvido | `sessoes/26-06-12_2_debitos_ux-marca.md`, release 2026-06-14 | Changelogs entraram no acumulado publicado; reabrir so se smoke visual mostrar ausencia. |
| D-MESAS-UI1 | fechado | `sessoes/26-06-12_2_debitos_ux-marca.md`, `apps/mesas/frontend/src/components/TableCardDashboard.tsx` | Botao/badge Arquivar usam `--artificio-bronze`; `bg-slate-600` removido do componente. |
| D-GLOS-CTA | fechado/stale | commit `652cf20` | CTA logado do glossario ja corrigido; resta so validacao visual se suspeita nova. |
| D-CSS1 | fechado local/site-only | sessao 26-06-12_2 | Higiene local; residual compartilhado de fontes e BL-UI-B12-FONTS. |
| D-MARCA2 | superado/absorvido | D064/spec 020 | Canonico atual e `#FF5722`, nao reabrir sem nova decisao. |
| BL-DOCS-AUDIT-024 | fechado | `specs/024-docs-specs-backlog-audit/`, `sessoes/26-06-15_2_docs-specs-backlog-audit.md` | Auditoria documental criada e aplicada; backlog verificado e atualizado. |

# Sessão 26-06-30_1 — mesas · redesign da gestão (`/gestao`)

- **Data:** 2026-06-30
- **App/escopo:** apps/mesas (frontend admin + contrato API admin)
- **Gate:** D (mesas)
- **Spec:** `specs/057-mesas-gestao-redesign/`
- **Modo:** SDD Completo — esta abertura = **investigação + plano primeiro** (decisão do mantenedor)
- **Objetivo:** repensar e reorganizar completamente a UX de `/gestao` (hoje "cara de gambiarra"); criar spec nova só com isso.

## Decisões do mantenedor (2026-06-30)
1. Sidebar — **reestruturar do zero** (IA nova proposta na spec, estilo Cloudflare).
2. Mesas central — **fila unificada de drafts** (origem Bot/Exporter/Texto · status · lote); CRUD publicado fica em Conteúdo.
3. Dashboard — **refazer útil e enxuto** (cards reais + feed; sem Alertas/Atalhos stub).
4. Escopo — **investigação+plano primeiro**; implementação só após aprovação nominal.
5. Acessibilidade de teclado **fora de escopo** (tela de uso pessoal único).

## Feito nesta sessão
- T0 lido (project-state + capsule + decisions).
- Mapeamento inicial com MCPs (`artificio-api-governance`, `codebase-memory-mcp`) + leitura de `features/admin/*`.
- Achados → `specs/057-.../debitos.md` (DEB-057-01..05).
- Spec 057 criada: spec.md, plan.md, tasks.md, reviews.md, debitos.md.
- Backlog + project-state + index de sessões atualizados.

## Achados-chave
- Duas árvores admin coexistem: `features/admin` (novo 049/054) + `modules/admin` (velho). Inconsistência.
- Backend já expõe Bot Discord (`chat-exporter/config|run|test`, `discovery/guilds`), 2 sistemas de draft (`discord/drafts` + `import/drafts`), métricas (`metrics`/`metrics/shadow`/`import/metrics`). Frontend não organiza.
- Bundle API com `consumers:[]` (linkagem não populada) + `api-orphans` stale (1970) → mapa de órfãs = trabalho de fase.
- "Erro" do console em Conteúdo→Mesas = só dedup de request do DashboardSection (ruído, não bug).

## Progresso
- **Fase 0 ✅** → `inventario.md`: 6 Sections + 3 árvores (features/admin, modules/admin, discord-sync/inbox); 163 rotas mesas cruzadas front×back via api-governance; órfãos = `admin/users*`, `setting-suggestions*`, `discord/drafts/:id/refresh-image`, `import-json/reparse`, `import/metrics` (wrapper sem caller); 2 filas de draft; ruído dedup explicado.
- **Fase 1 ✅** → `proposta-ia.md`: IA Cloudflare-like 7 grupos (Visão geral · Mesas · Catálogo · Comunidade · Importação · Sistema); Moderação→Mesas, Integrações→Importação; Bot de Discord 3 tabs (Config/Importação/Relatórios); mapa tela-antiga→nova; disposição dos órfãos (R10); tokens; correção do ruído.
- **Tasks ampliadas** → Fases 2–9 detalhadas em `tasks.md`.

- **Investigação extra (pedido mantenedor):** notificações + campos do Bot/ChatExporter → `investigacao-notif-config.md`. Achados: (A) **sino do admin morto** — 42 notificações beta, todas `suggestion_approved/rejected`, 0 dos tipos visíveis; causa = `notifyAdmins` auto-exclui autor (single-admin) + eventos `table_published/member_joined/dev_feedback` sem emissor (DEB-057-06, R14). (B) Bot Via A (bot_token+`sources`) já multi-canal/frontend; ChatExporter Via B = **perfil único** → precisa tabela de perfis multi-canal (DEB-057-07, R13). Evidência DB beta read-only (`mesas-beta-db`). Spec ganhou R13/R14; tasks T6.5 + T4.3.

- **G1 APROVADO (2026-06-30):** IA 7 grupos; R13 perfis multi-canal; R14 sino só eventos de outros (mesa publicada/membro/feedback); R15 tabela padrão (filtro+multi-select apagar/arquivar+abrir/editar); Usuários=construir; setting-suggestions=construir UI (é `setting_style_suggestions`, data usada pelo cadastro de mesa — não remove); import/metrics=remover.
- **ChatExporter — solução completa** → `chatexporter-solucao.md` (pesquisa do git Tyrrrz/DiscordChatExporter): causa-raiz "não funciona" = CLI não instalada no container (`spawn` ENOENT). Solução: bundle da CLI pinada no Dockerfile (`DISCORD_CHAT_EXPORTER_BIN`), bot token (não user-token, ToS), descoberta guild/canal por dropdown, perfis multi-canal no DB, agenda via `mesas-cron`, wizard leigo explicativo. Tasks T6.5–T6.8 + T7.2/T7.4.

- **ChatExporter na VM DEFINIDO (Opção A):** containers `mesas-api`/`mesas-cron` são Alpine sem dotnet (verificado read-only). Host-install não resolve (container≠host, musl≠glibc, some no rebuild). Solução = Dockerfile multi-stage: `dotnet publish -r linux-musl-x64 --self-contained` da DCE (tag pinada) → COPY pro Alpine + `icu-libs`/`libstdc++`. Reprodutível, sobrevive a redeploy/recriação. T6.6.

## Decisões pré-implementação (2026-06-30, antes do G2)
- **Branch criada:** `feat/057-mesas-gestao-redesign` (saiu de `feat/052`, carregou working tree da 052; nada commitado).
- **member_joined fora do sino (R14):** verificado no back — **não há mecanismo de entrar em mesa** (sem `table_members`/seat/join/enroll); tipo existe no enum (`db/types.ts:459`) mas nunca emitido. Sino = {`table_published`,`dev_feedback`}. member_joined entra quando existir feature de membros (outra spec). spec R14 + T4.3 atualizados.
- **Arquivar mesa já existe:** `tables.archived_at`+`status`+`tableArchiving.ts` → T2.5 reduzida (só batch+UI p/ mesas).
- **Fronteira 052↔057:** mantenedor decidiu **057 dona de TUDO no DCE** (UI/perfis + Dockerfile bundle + runner agendado). 052 Bloco A (ingestão DCE) absorvido → nova T6.9 (runner no `mesas-cron`); 052 segue dona da camada IA/shadow. tasks.md Fase 6 atualizada.
- **Risco aberto (valido em T6.6, não bloqueia):** DCE `publish -r linux-musl-x64 --self-contained` — confirmar suporte a RID musl no build antes de fechar.

## G2 — implementação iniciada (2026-06-30, autorizado "pode iniciar")
**Working tree salva primeiro** (mantenedor: "pegue o que dá para reaproveitar"): 2 commits na branch `feat/057-mesas-gestao-redesign` —
- `d2390ef chore(052)`: hardening DCE/metrics salvo da tree suja (guards path-traversal + `sql FILTER` no metrics + breakdown de status de draft) — relevante pois 057 absorve DCE.
- `40b1455 docs(057)`: spec/sessão/backlog/index/project-state + `.gitignore: .codex/`.
Tree limpa.

**Fase 2 — Fundação (núcleo pronto, tsc+lint verdes; sem commit ainda):**
- T2.1 ✅ tokens `--admin-rail/--admin-surface/--admin-hover` (dark+light) em `index.css`. Remoção de hardcode das Sections movida p/ fases 4-7 (reescrevem cada Section) — anti-retrabalho.
- T2.2 ✅ primitivas `ui/`: `PageHeader`, `MetricCard`, `SectionCard`, `StatusPill`, `cn`.
- T2.4 ✅ `<AdminTable>` (R15): filtros+facetas estado-na-URL, lote apagar/arquivar, abrir/editar, loading/erro/empty. Genérico+presentacional.
- T2.3 ✅ `AdminSidebar` 6 grupos IA nova + roteamento (`visao-geral/mesas/catalogo/importacao` + redirects das antigas). Achado: sidebar antiga usava `--brand` inexistente → ativo quebrado; corrigido p/ `--color-artificio-orange`. Sections atuais reusadas interino (sem stub/link morto).
- T2.5 ⏸ diferido — endpoints de lote/arquivo criados junto da UI que os usa (fases 4-7). Mesa já tem archive.
- Smoke real = T9.2 beta (rota auth-gated).

## Fase 2 commitada + PR + conserto da base (2026-06-30)
- Commit Fase 2 + push + **PR #119** base `dev`.
- **BUG de processo:** branch `feat/057` criada a partir de `feat/052` (tree ativa) em vez de `dev` → PR carregou os 6 commits não-mergeados da 052 + salvage = 75 arquivos, CONFLITANTE com `dev`.
- **Conserto (autorizado):** `git branch backup/057-pre-rebase` + `git rebase --onto origin/dev d2390ef` + `git push --force-with-lease`. PR #119 agora só 057: **26 arquivos, 1278/71, MERGEABLE**. SHAs novos: `72faccb docs(057)` + `b04e5b7 feat(057)`.
- **Salvage 052 (`d2390ef`, hardening DCE/metrics) preservado em `backup/057-pre-rebase`** → DÉBITO: levar pra branch/PR própria da 052 (não pertence à 057). Registrar em backlog da 052.
- **Aprendizado:** sempre criar branch de trabalho a partir de `dev` atualizado, nunca de outra branch de feature com tree suja. Ver `fluxo-por-fase-057` (memória).
- Checks PR: semgrep/snyk ✅, CodeRabbit em andamento.

- **#119 fechada, recriada do zero como PR #120** (pedido do mantenedor — CodeRabbit já tinha começado a ler a versão bagunçada; PR limpa dá review limpo). Mesma branch já rebaseada. #120: 26 arquivos, 1278/71, MERGEABLE. https://github.com/FarenRavirar/artificio/pull/120

## Review Codex #120 + fix CI api-governance (2026-06-30)
- **Codex 2×P2 (ambos procedem, corrigidos):** C1 redirect `moderacao/:sub?` dropava sub → `LegacyModeracaoRedirect` preserva + repoint DashboardSection; C2 lote por `selected.size` enganoso → `visibleSelectedIds` (filtrado∩selecionado). Veredictos em `reviews.md`.
- **CI api-governance vermelho:** `api-consumers.generated.json` defasado (consumidor moveu linha 84→90 por causa do código novo). **Causa-raiz:** no rebase eu rodei `git checkout -- docs/api/generated/` e descartei o regen que o pre-push tinha feito → b04e5b7 subiu com docs/api stale. Corrigido: `pnpm verify:api` (breaking=0) regenerou consumers/diff/inventory/map. **Aprendizado:** nunca `checkout --` em `docs/api/generated` durante rebase; regenerar e commitar junto do código que move linhas.
- Validação: tsc+eslint+vite build+verify:api verdes.

## Review Sonar #120 — primitivas admin (2026-06-30)
- Achados do mantenedor em `features/admin/components/ui/*`: props não-readonly, `AdminTable.valueToText` stringificando objeto como `[object Object]`, `window.confirm`, key por índice em breadcrumb.
- Plano de correção: ajustar tipos locais para `Readonly`, tornar `valueToText` seguro para primitivos/Date e objetos, trocar para `globalThis.confirm`, e chavear breadcrumb por caminho acumulado.
- Correção aplicada em `AdminTable`, `MetricCard`, `PageHeader`, `SectionCard`, `StatusPill`; sem helper duplicado.
- Validação: `pnpm --filter @artificio/mesas-frontend lint` ✅; `pnpm --filter @artificio/mesas-frontend build` ✅ (só warning conhecido de chunk >500 kB).

## Próximo passo
- **Esperar reviews dos bots no PR #120** (amazon-q/codex/coderabbit) + CI.
- Triar achados em `reviews.md`, corrigir o que procede (sob autorização), depois Fase 3/4.
- Pendência: mover salvage `d2390ef` p/ a 052 (branch/PR própria) — fica em `backup/057-pre-rebase`.

## Fase 3 — investigação e plano (2026-06-30)
- Pedido do mantenedor: investigar, registrar e implementar Fase 3; foco em robustez, organização, menor duplicação e escalabilidade.
- Skill aplicado: `split-refactor`.
- Estado inicial: `git status --short --branch` limpo em `feat/057-mesas-gestao-redesign`.
- Inventário `modules/admin`: 5 áreas isoladas (`activity`, `hydration`, `platforms`, `systems`, `dev-feedback`) e 13 arquivos.
- Consumidores reais via `rg "modules/admin"`: `features/admin/components/*`, `features/admin/utils/treeHelpers.ts`, `pages/SystemsAdminView.tsx`, `pages/ScenariosAdminView.tsx`.
- Veredito: não há dois caminhos arquiteturais equivalentes; `modules/admin` é só árvore antiga coexistindo com a nova. Melhor caminho = mover as áreas antigas para `features/admin/{activity,hydration,platforms,systems,dev-feedback}` preservando exports/contratos, corrigir imports e remover `modules/admin` vazio.
- Limite do split: somente realocar árvore e imports. Sem reescrever UI, sem trocar rotas, sem alterar comportamento funcional.
- Implementação: `activity`, `hydration`, `platforms`, `systems` e `dev-feedback` movidos para `features/admin/`; imports antigos `modules/admin` eliminados; diretório `src/modules/admin` removido.
- Validação: `rg "modules/admin" apps/mesas/frontend/src -n` sem resultados; `pnpm --filter @artificio/mesas-frontend lint` ✅; `pnpm --filter @artificio/mesas-frontend build` ✅ (warning conhecido de chunk >500 kB); `pnpm --filter @artificio/mesas-frontend test` ✅ (13 files, 148 tests); `pnpm verify:api` ✅ (breaking=0; 3 warnings ambíguos conhecidos).

## Review CodeRabbit #120 — ReactNode + Fase 4 (2026-06-30)
- Achado: `React.ReactNode` nas primitivas admin depende do namespace global React; tsconfig não habilita `allowUmdGlobalAccess`.
- Correção planejada/aplicada: `import type { ReactNode } from 'react'` em `StatusPill`, `MetricCard`, `SectionCard`, `PageHeader`, `AdminTable` e `AdminSidebar`; `rg "React\\.ReactNode" apps/mesas/frontend/src/features/admin -n` sem resultados.
- Investigação Fase 4: `DashboardSection` e `GestaoLayout` duplicam fetch de pendências (`system-suggestions`, `scenario-suggestions`, `drafts limit:1`) causando o ruído já mapeado em DEB-057-03. App já tem TanStack Query global.
- Plano Fase 4: extrair `useAdminPendencias` com `queryKey ['admin','pendencias']`, normalização defensiva e uso compartilhado no layout+dashboard; refazer `DashboardSection` como visão única com `MetricCard`, `SectionCard`, `StatusPill` e `ActivityPanel`, sem abas/stubs `Alertas`/`Atalhos`.
- Fase 4 implementada: `useAdminPendencias` centraliza sugestões pendentes + presença de drafts `needs_review`; `useAdminDashboardMetrics` centraliza mesas ativas + métricas DCE; `GestaoLayout` consome a mesma query de pendências; `DashboardSection` virou página única com cards reais, pendências operacionais, última importação e feed único.
- Ajuste de robustez pós-`verify:api`: primeira versão do hook usava recurso dinâmico e o scanner gerava `GET /api/v1/admin/:param`; corrigido para endpoints explícitos `system-suggestions`/`scenario-suggestions`, preservando governança sem ruído novo.
- Validação: `pnpm --filter @artificio/mesas-frontend lint` ✅; `pnpm --filter @artificio/mesas-frontend build` ✅ (warning conhecido chunk >500kB); `pnpm --filter @artificio/mesas-frontend test` ✅ (13 files, 148 tests); `pnpm verify:api` ✅ (breaking=0; 3 warnings ambíguos conhecidos).

## Review CodeRabbit #120 — App.tsx nested template literal (2026-06-30)
- Achado: `LegacyModeracaoRedirect` usa template literal aninhado ao preservar `sub` no redirect legado de `/gestao/moderacao/:sub?`.
- Plano: extrair o sufixo opcional para constante tipada/legível e manter o comportamento existente (`/gestao/mesas` ou `/gestao/mesas/<sub>`).
- Correção aplicada: `legacySubPath` separa o path opcional e o `Navigate` usa template literal simples.
- Validação: `rg "\\$\\{[^}]*\`" apps/mesas/frontend/src/App.tsx -n` sem resultados; `pnpm --filter @artificio/mesas-frontend lint` ✅; `pnpm --filter @artificio/mesas-frontend build` ✅ (warning conhecido de chunk >500 kB).

## Verificação T2.5 — R15 backend batch/archive (2026-06-30)
- Pedido: verificar se T2.5 já foi implementada ou o que falta.
- Evidência de código: `adminTables.ts` tem `PUT /api/v1/admin/tables/:id`, `DELETE /api/v1/admin/tables/:id` e `POST /api/v1/admin/tables/auto-archive`; não há endpoint admin de batch para mesas, nem archive admin em lote.
- Evidência de código: `gmPanel.ts` tem `PATCH /api/v1/gm/tables/:id/archive` individual (dono/admin), confirmando que arquivamento de mesa existe no modelo, mas não como operação administrativa em lote.
- Evidência de código: `discord/drafts.ts` e `discord/messages.ts` já têm `PATCH /batch`; esses casos da matriz já estão cobertos.
- Evidência de código: `systemSuggestionsAdmin.ts`/`scenarioSuggestionsAdmin.ts` têm approve/reject individuais; `ComunidadeSection` faz rejeição em lote com N chamadas individuais, não endpoint batch.
- Evidência de código: `notifications.ts` só lista e marca leitura (`read-all`/`:id/read`); não há delete/archive individual nem em lote.
- Veredito: T2.5 segue aberta. O que existe é base parcial: Discord drafts/messages ok; mesas archive individual ok; faltam endpoints/admin UI de batch/archive nas demais listas da matriz e adoção por `<AdminTable>` nas fases 5/7.

## Fase 5 — Mesas central (2026-06-30)
- Pedido: implementar Fase 5.
- Investigação: `ModeracaoSection` já é a rota `/gestao/mesas/:sub?` e já reutiliza `DiscordDraftReviewTable` + `MessagesView`; o backend já suporta `drafts/batch`, `drafts/rejected`, `messages/batch` e `drafts/:id/refresh-image`.
- Plano: manter a lógica existente (sem duplicar fila), trocar a casca visual para `PageHeader`/`SectionCard`, preservar deep links `mensagens`/`rascunhos`, e expor `refresh-image` como ação por linha/preview em drafts Discord.
- Limite: sem mexer em T2.5 backend genérico; Fase 5 usa os endpoints de drafts/mensagens que já existem.
- Implementação: `ModeracaoSection` virou página Mesas com breadcrumb, descrição e tabs estáveis (`rascunhos`/`mensagens`) usando tokens/primitivas admin; default local passa a rascunhos, com deep link explícito ao trocar tab.
- Implementação: `DiscordDraftReviewTable` rotula origem como Bot/Exporter/Texto, derivando de `source_kind`/`source_type` quando disponível e caindo para Bot/Texto sem inventar dado.
- Implementação: `discordSyncApi.refreshDraftImage` ligado ao `POST /admin/discord/drafts/:id/refresh-image`; `DiscordDraftPreview` mostra `Rebaixar imagem` apenas para draft Discord, chama o endpoint, refaz `getDraft` e mostra toast.
- Tasks: T5.1 e T5.2 marcadas concluídas; smoke beta permanece em T9.2 por rota auth-gated.
- Validação: `pnpm --filter @artificio/mesas-frontend lint` ✅; `pnpm --filter @artificio/mesas-frontend test -- DiscordDraftReviewTable DiscordDraftPreview` ✅ (13 files, 148 tests); `pnpm --filter @artificio/mesas-frontend build` ✅ (warning conhecido chunk >500 kB); `pnpm verify:api` ✅ (breaking=0; 3 warnings ambíguos conhecidos).

## Verificação api:lint — 3 warnings `no-ambiguous-paths` (2026-06-30)
- Pedido: verificar os 3 warnings emitidos por `pnpm verify:api`.
- Warning 1 (`mesas`): `/api/v1/gm/{slug}/contact` × `/api/v1/gm/tables/{id}`. Código real monta `gmPanelRoutes` antes de `gmRoutes`, e os handlers relevantes têm caminhos/métodos distintos; risco runtime atual não confirmado. É dívida de desenho de rota pública/GM.
- Warning 2 (`glossario`): `/api/social/{id}/comments` × `/api/social/comments/{id}`. Código real tem GET/POST no nested e DELETE no literal; consumidores reais usam `DELETE /social/comments/:id`. Risco runtime atual não confirmado, mas o desenho permite ambiguidade teórica se `id=comments`.
- Warning 3 (`glossario`): `/api/systems/{systemId}/editions` × `/api/systems/editions/{id}`. Código real tem GET/POST no nested e PUT/DELETE no literal; consumidores reais usam `/systems/editions/:id`. Risco runtime atual não confirmado, mas o desenho permite ambiguidade teórica se `systemId=editions`.
- Veredito: warnings conhecidos/procedentes como dívida de desenho, não regressão da Fase 5 nem falha de scanner. Para zerar de verdade sem silenciar regra, precisa renomear/versar rotas (`/gm/public/:slug/contact`, `/social/terms/:id/comments`, `/systems/:systemId/editions` + `/editions/:id` ou similar) com compatibilidade/depreciação; isso é mudança de contrato e deve ser spec/débito próprio.

## Fase 6 — Importação + Bot de Discord (2026-06-30)
- Pedido: avançar para a Fase 6.
- Investigação: `IntegracoesSection` ainda era um painel plano com 8 tabs; `ChatExporterAutomationPanel` já cobria config/test/run legado em perfil único; backend já tinha `GET/PUT /chat-exporter/config`, `POST /test`, `POST /run`, discovery, import-json e metrics. O gap estrutural era perfis multi-canal + IA organizada.
- Decisão de implementação local: manter config legada compatível, adicionar `discord_chat_exporter_profiles` como entidade nova, fazer `test/run` por perfil reutilizar `runChatExporterCli` + `processDiscordChatExporterFolder`, e reorganizar UI sem duplicar importador.
- Implementação backend: migration 134 `discord_chat_exporter_profiles`; tipos Kysely; rotas `GET/POST /chat-exporter/profiles`, `PATCH/DELETE /profiles/:id`, `POST /profiles/:id/test`, `POST /profiles/:id/run`; token por perfil encriptado com `settingsCrypto`, fallback no token global, `import_dir` gerado pelo backend.
- Implementação Dockerfile: Opção A local/versionada — image `mesas-api` copia a CLI self-contained da image oficial pinada `tyrrrz/discordchatexporter:2.47.3` para `/opt/dce`, define `DISCORD_CHAT_EXPORTER_BIN=/opt/dce/DiscordChatExporter.Cli` e instala libs Alpine necessárias. Falta deploy beta para provar runtime real.
- Implementação frontend: `IntegracoesSection` virou grupo Importação com PageHeader/SectionCard e tabs Bot de Discord / Importar arquivo / Importar texto / Enriquecimento; Bot tem subtabs Configuração / Importação / Relatórios.
- Implementação frontend: `ChatExporterProfilesPanel` usa `<AdminTable>` para perfis, discovery de servidores/canais, criação/edição de perfil, agenda, token opcional por perfil, Testar, Importar agora e apagar.
- Tasks: T6.1, T6.2 e T6.5 marcadas concluídas localmente; T6.6 parcial (Dockerfile pronto, falta deploy/test), T6.8 parcial (última run/status/erro + test/run, falta delta "a atualizar"); T6.3/T6.4/T6.7/T6.9 seguem abertas.
- Validação: `pnpm --filter @artificio/mesas-backend build` ✅; `pnpm --filter @artificio/mesas-frontend build` ✅ (warning conhecido chunk >500 kB); `pnpm --filter @artificio/mesas-frontend lint` ✅; `pnpm --filter @artificio/mesas-frontend test -- ChatExporter discordSyncApi` ✅ (13 files, 148 tests); `pnpm --filter @artificio/mesas-backend test -- chatExporter` ✅ (34 files, 321 tests); `pnpm verify:api` ✅ (mesas +4 non-breaking; mesmos 3 warnings `no-ambiguous-paths` conhecidos).

## Fase 4b / T4.3 — Notificações do admin (2026-06-30)
- Pedido: implementar T4.3.
- Investigação: `gmPanel.ts` já emite `table_published` quando mestre não-admin cria mesa ativa ou muda status para `active`; `devFeedback.ts` já emite `dev_feedback` com `excludeUserId`; `NotificationBell` ainda mostrava grupos `system_suggestion`, `scenario_suggestion`, `member_joined` e tinha hardcodes visuais (`#1B2A4A`, `bg-blue-500/10`, `bg-red-500`).
- Plano: manter backend existente de sugestões (outras notificações continuam servindo usuários/sugestões), restringir **visibilidade do sino admin** a `{table_published, dev_feedback}`, trocar hardcodes por tokens e ajustar link de feedback para `/gestao/sistema`.
- Implementação: `NotificationBell` agora agrupa só `Mesas publicadas` (`table_published`) e `Feedbacks reportados` (`dev_feedback`) para admin; estilos usam `--admin-surface`, `--admin-hover`, `--border`, `--fg*`, `--color-artificio-orange`, `--danger`; `devFeedback` aponta `action_url` para `/gestao/sistema`.
- Busca: `rg "system_suggestion|scenario_suggestion|member_joined|#1B2A4A|bg-blue-500/10|bg-red-500" NotificationBell.tsx devFeedback.ts` sem resultados.
- Validação: `pnpm --filter @artificio/mesas-frontend lint` ✅; `pnpm --filter @artificio/mesas-frontend build` ✅ (warning conhecido chunk >500 kB); `pnpm --filter @artificio/mesas-backend build` ✅; `pnpm verify:api` ✅ (breaking=0; mesmos 3 warnings ambíguos conhecidos); `git diff --check` ✅.

## Fase 7 — Catálogo + Comunidade + Sistema (2026-06-30)
- Pedido: avançar para etapa 7.
- Investigação: `ConteudoSection` ainda tinha casca antiga e lista de mesas manual; `SistemaSection` tinha stubs `jobs/logs/erros/config`; `admin/users` existia mas retornava `[]` por TODO; `setting-suggestions` já tinha CRUD backend, sem UI.
- Plano: (1) dar PageHeader+tabs/tokens ao Catálogo preservando views existentes; (2) implementar listagem real de usuários no backend + painel `AdminUsersPanel` com `<AdminTable>` e toggle Covil; (3) deixar Sistema sem stubs, com Usuários + Erros reportados; (4) criar UI CRUD para Estilos por cenário e encaixar no Catálogo.
- Implementação backend: `GET /api/v1/admin/users` deixou de retornar TODO vazio e agora lista usuários reais com `users` + `profiles` + `gm_profiles`, filtros defensivos `role`/`covil_verified`/`search`, limite 200 e meta; `PATCH /users/:id/covil` foi preservado.
- Implementação frontend: `ConteudoSection` virou Catálogo com PageHeader/SectionCard e tabs Sistemas/Plataformas/Cenários/Estilos por cenário/Mesas publicadas; plataformas seguem separadas por kind; mesas publicadas usam `<AdminTable>`.
- Implementação frontend: novo `AdminUsersPanel` lista usuários via `admin/users`, filtra role/Covil, abre detalhe e alterna selo Covil sem duplicar tabela manual.
- Implementação frontend: novo `SettingSuggestionsPanel` dá CRUD real para `setting-suggestions`/`setting_style_suggestions` com `<AdminTable>`, form de cenário+estilos e edição inline.
- Implementação frontend: `SistemaSection` removeu stubs de jobs/logs/erros/config e ficou com tabs reais `Usuários` e `Erros reportados` (`DevFeedbackPanel`).
- Teste corrigido: `adminProfile.test.ts` passou a mockar `../db`/Kysely para a listagem real de usuários; cobre retorno, filtros e erro de query.
- Tasks: T7.1, T7.2, T7.3 e T7.4 marcadas concluídas localmente; smoke beta permanece em T9.2.
- Validação: `pnpm --filter @artificio/mesas-backend test -- adminProfile adminSettingSuggestions` ✅ (34 files, 323 tests); `pnpm --filter @artificio/mesas-frontend lint` ✅; `pnpm --filter @artificio/mesas-frontend build` ✅ (warning conhecido chunk >500 kB); `pnpm --filter @artificio/mesas-backend build` ✅; `pnpm verify:api` ✅ (mesas +4 non-breaking; mesmos 3 warnings `no-ambiguous-paths` conhecidos); `git diff --check` ✅ (somente avisos LF→CRLF).

## Fases 2/6 restantes — tudo antes da Fase 8 (2026-06-30)
- Pedido: implementar tudo que falta antes da Fase 8, **tudo na spec 057, sem SDD separado** (deploy/commit seguem gated à parte).
- **T2.5 ✅** — `POST /api/v1/admin/tables/batch` (`archive`/`unarchive`/`delete`, idempotente, `logActivity`) em `adminTables.ts`; `bulkActions` (arquivar/desarquivar/apagar-lote com confirm) na tabela Mesas publicadas do Catálogo. Drafts/messages já tinham `/batch`; sugestões seguem rejeição-em-lote por N chamadas.
- **T6.3 ✅** — dry-read delta: `discoverChannelDelta(channelId, afterMessageId)` em `discord/discovery.ts` (Discord API `/channels/:id/messages?after=`, 1 página teto 100) + `GET /chat-exporter/profiles/:id/delta` (maior snowflake importado via `discord_import_messages`). Exportado no `discord/index.ts`.
- **T6.4 ✅** — `IntegrationLogsView`: filtro por origem + ordenação (recentes/antigas/mais falhas).
- **T6.7 ✅** — `ChatExporterProfilesPanel` reescrito como wizard 3 passos (Conectar → Canais → Agenda), estados explicativos, guia de token, sem ID cru.
- **T6.8 ✅** — ação "Ver novidades" por perfil (consome delta) + exibição na coluna Saúde; delta limpo após import.
- **T6.9 ✅ (código)** — `runProfileExport`/`runFolderImport`/`resolveChatExporterBinary` extraídos p/ `discord/chatExporterProfileRunner.ts` (dedup rota↔runner); `discord/chatExporterSchedule.ts` com `isProfileDue`/`selectDueProfiles` (puras); script `runDiscordChatExporterSchedule.ts` + `discord:chat-exporter-schedule` no package.json + tick 5 min no `cronRunner.ts`. Teste `chatExporterSchedule.test.ts` (11 casos).
- **T6.6** — Dockerfile já bundla a CLI DCE pinada (`tyrrrz/discordchatexporter:2.47.3` → `/opt/dce`) — inalterado; deploy/runtime gated.
- **Gated (não feito, por regra de deploy/commit):** runtime real de delta/CLI/scheduler (bot token + canal + `mesas-cron` no beta) = smoke T9.2; deploy do Dockerfile DCE; nenhum commit/push.
- **Validação:** `pnpm --filter @artificio/mesas-backend build` ✅; `test` ✅ (35 files, **332** tests, +11 do scheduler); `pnpm --filter @artificio/mesas-frontend lint` ✅; `build` ✅ (warning chunk >500kB conhecido); `test` ✅ (13 files, 148 tests); `pnpm verify:api` ✅ (mesas +6 non-breaking, breaking=0, órfãs 0, duplicatas 0, exit 0).
- **Estado:** tudo antes da Fase 8 code-complete. Falta só Fase 8 (limpeza de contrato) + Fase 9 (validação/smoke/promote). Código local, **não commitado**.

## Fase 8 — Limpeza de contrato (2026-06-30)
- Pedido: "pode realizar a 8".
- Investigação (código = verdade): **`import/metrics`** (`inbox/metrics.ts`, montado em `adminImportInbox.ts`) = 0 caller frontend + redundante com `GET /admin/discord/metrics` → **removido**. **`import-json/reparse`** (`discord/import.ts`) = reprocessa `discord_import_messages` em lote por `messageIds` (não é o `drafts/:id/reparse` de draft único) → **não redundante, MANTIDO**.
- **T8.1 ✅** — removido: mount `router.use('/metrics', metricsRouter)` + import em `adminImportInbox.ts`; arquivo `inbox/metrics.ts` deletado; bloco de teste `GET /admin/import/metrics` (2 casos) em `adminImportInbox.test.ts`; path `/api/v1/admin/import/metrics` em `mesas.openapi.yaml`.
- **T8.2 ✅** — `pnpm api:bundle` (281 ops) + `pnpm verify:api` exit 0. mesas breaking=1 (`path.remove` do import/metrics, intencional/aprovado), non-breaking=6 (rotas novas fases 5-7).
- **Validação:** backend build ✅; test ✅ (35 files, **330** tests, -2 do metrics); `pnpm -w run lint` ✅ (15/15). Código local, **não commitado**.
- **Estado:** Fases 2–8 completas. Falta só **Fase 9** (T9.1 validação — já verde local; T9.2 smoke beta auth-gated; T9.3 promote — gated aprovação nominal).

## Review CodeRabbit PR #120 — correções Fases 5-8 (2026-06-30)
- Pedido do mantenedor: "corrija e implemente", "tudo que não seja ruim, agora"; no frontend traduzir termos exceto os bem conhecidos.
- Triagem completa + veredictos em `reviews.md` §"Review CodeRabbit PR #120". 19 achados corrigidos (1 Critical token leak, 6 Major, Minors, dedups, i18n); 2 não aplicados com justificativa técnica (run síncrono mantido por UX; schema+tipo é padrão de normalização mandatório).
- Destaques: `publicProfile` não vaza mais `token_enc`; `admin/users` com paginação real (`page`/`per_page`+`COUNT`); delete de mesa com confirmação; toggle status não reativa `full`/`ended`; hooks propagam erro (sem mascarar 0) e sem `placeholderData` (loading volta a funcionar); UI de `media`/`Tópicos`/`clearToken`; `deleteProfile` com try/catch+busy; OpenAPI 201/204; `formatDate`/`tabButtonClass` extraídos; i18n (Tópicos, Última execução, status pt-BR).
- Validação: backend build+330 tests; frontend lint+build+148 tests; `verify:api` exit 0 (mesas breaking=1 = remoção Fase 8; non-breaking=6). Código local, **não commitado**.

## Incidente beta — Cookies do ChatExporter + 401/502 (2026-07-01)
- Pedido do mantenedor: investigar código, repo DiscordChatExporter e VM após erro ao salvar em **Cookies** em `https://mesasbeta.artificiorpg.com/gestao/importacao`.
- Console informado: 401 em rotas admin/notifications, 502 em `GET /admin/discord/discovery/guilds` com retries, 400 em `PUT /admin/discord/chat-exporter/config`.
- VM read-only: `mesas-beta-*` e `accounts-*` healthy; beta em commit `caf461d`; `/opt/dce/DiscordChatExporter.Cli` ainda **não existe** no container (`dce_bin=no`) porque o bundle do Dockerfile precisa redeploy/rebuild.
- Logs beta: 401 iniciais às 13:55:38 viram 304/OK ~300ms depois nas mesmas rotas → access cookie expirado antes do refresh; cobre a correção local em `packages/auth`/`AppShell` (evita `/me` 401 e duplica menos consumidores).
- Logs beta: `discovery/guilds` 502 = `DiscordSettingsDecryptError: Credencial Discord ilegível com a chave atual. Regrave o token.`; backend transforma credencial inválida em 502, frontend retrya 3x por ser 5xx.
- Logs beta: `PUT /chat-exporter/config` 400 = schema atual aceita `cookies`, mas depois revalida o config completo e exige `channelId`/`importDir`; salvar só Cookies quebra.
- Repo oficial DiscordChatExporter (`Tyrrrz/DiscordChatExporter`, `.docs/Using-the-CLI.md` + `Token-and-IDs.md`): comandos usam `export -t token -c channel ...`; o token pode ser **user token** ou **bot token**. A README avisa que user token/session existe mas é sensível/contra ToS; bot token é o caminho recomendado quando possível. Não há flag `--cookies`; o que a UI chamava de "Cookies" precisa virar **token de usuário/session**.
- Decisão do mantenedor (2026-07-01): suportar **os dois** modos, mas usar **um ou outro** por perfil; por enquanto a prioridade é user token/session. Modelo de UI: padrão global + perfil pode sobrescrever. Enter salva o perfil atual do wizard.
- Correção planejada: `auth_type` por perfil (`global`/`user`/`bot`); config global `authType`; token de usuário global em `chat_exporter_token`; bot token global reaproveita `bot_token`; token próprio por perfil segue em `token_enc`; remover `--cookies` do comando CLI, mas não remover o fluxo user/session.
- Refinamento UX (2026-07-01): perfil deve poder usar padrão global ou sobrescrever credencial/modo; tela aceita IDs manuais de servidor/canal com link de ajuda; `Importar depois de` usa data+hora e vira `--after` do DiscordChatExporter. A "pasta de importação" é detalhe interno: o backend exporta JSON para `incoming/` e chama o mesmo parser do upload manual (`processDiscordChatExporterFolder` → `importDiscordChatExporterJson`), para a sincronização chegar como se o JSON tivesse sido colado/enviado.
- Achado DCE oficial: CLI documenta `--after`/`--before` para data/hora e `-p` para particionar arquivo, mas `-p` **não é** "últimas N mensagens"; é split do output. Para "X últimas mensagens" há duas estratégias possíveis e exigem decisão: pós-filtrar o JSON depois do export (funciona com user/session, mas pode baixar histórico grande) ou calcular janela via API/bot antes do export (mais leve, mas não cobre user/session puro).

## Critério de conclusão (desta abertura)
- `inventario.md` + `proposta-ia.md` completos; plano faseado aprovado pelo mantenedor.
- [ ] `project-state.md` atualizado com status, débitos e backlog refletindo esta sessão.

## Backlog
- `BL-057-GESTAO-REDESIGN` registrado em `specs/backlog.md`.

## Triagem de reviews do CodeRabbit no PR #120 (2026-06-30)
- **project-state.md corrigido:** "5 débitos" → "7 débitos (5 iniciais + 2 na investigação extra)".
- **D1–D10 (débitos da 052 encontrados no diff do PR #120):** registrados como DEB-057-08 a DEB-057-17 no `debitos.md` da 057. Alvo: Fase 6 (absorção do DCE). Ponteiro adicionado no `debitos.md` da 052.
- **Backlog atualizado:** status BL-057 reflete Fase 2 em PR #120 + 17 débitos totais (7 próprios + 10 herdados).

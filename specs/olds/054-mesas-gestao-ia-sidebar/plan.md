# 054 — Plano

> Solução técnica da reorganização da `/gestao`. Implementação por autorização nominal por ação.
>
> **Estado:** Fases 1-4 implementadas localmente (código presente, não mergeado). Fases descritas abaixo refletem o que foi executado — o plano como referência histórica.

## Fase 0 — Investigação/decisão (sem código)

- Mapear no código TODO componente/rota por trás de cada nó da IA-alvo (tabela old→new vira mapa real componente↔rota). Usar Serena `find_symbol`/`find_referencing_symbols` + `rg`.
- Inventariar e **classificar** TODO identificador a renomear (decisão 4 = rename ampliado) em 3 baldes:
  - **(a) interno-FE** — estado, nome de componente/arquivo, `tab` local, testid → renomeia direto.
  - **(b) contrato FE↔BE sem persistência** — rota de API, chave de payload → renomeia rota+consumidor no **mesmo PR**, sem migration.
  - **(c) valor persistido** — enum/coluna/JSONB em DB (ex.: `status`, `origin`, valores de tab gravados) → rename **só com migration** + aprovação nominal + guard online-safe (spec 050), ou alias/compat + backfill; se não compensar, **débito explícito** (não quebrar).
- ⚠️ **Pétrea de banco:** nenhum valor persistido renomeado sem migration. `rg` nos valores atuais (`'fontes'`, `'import-json'`, `'mensagens'`, `'drafts'`, enums de status/origin) p/ achar onde gravam/leem em DB.
- Fechar as 4 Decisões em aberto do `spec.md` com o mantenedor.
- Saída: documento de mapeamento + decisões registradas. **Sem editar componentes.**

## Fase 1 — Shell de navegação (sidebar + roteamento) ✅ IMPLEMENTADA

- Criar componente de layout admin: `<AdminSidebar>` + `<AdminMain>` (header contextual + breadcrumb + zona de ações + slot de subnav + outlet de conteúdo).
- Se Decisão 3 = rotas aninhadas: introduzir rotas `/gestao/<grupo>/<sub>` (React Router nested) com `aria-current` na ativa (reaproveita mecanismo do `Nav.tsx`/`styles.css` já existente — spec 051 F2).
- Avaliar extração de `AdminSidebar`/`Breadcrumb` p/ `packages/ui` (se houver reuso por outro app-admin futuro; senão local no mesas, mas com tokens de tema). Decisão registrada.
- Migrar `GestaoPage` de estado-de-aba → layout shell, **preservando** os painéis existentes como conteúdo dos nós.

## Fase 2 — Reorganização dos grupos (mover, não reescrever) ✅ IMPLEMENTADA

### O que foi feito (descrição factual, não plano original):

- **DiscordSyncPanel.tsx desmontado** — container de 5 tabs substituído por componentes independentes. Bloco `mensagens` extraído para `MessagesView.tsx` (entidade `discord_import_messages`, Discord-only). Config/DiscordJsonImport/SourceList mantidos como componentes avulsos.
- **ConteúdoSection** — agrupa `SystemsAdminView`, `PlatformsPage` (já separa VTT/Comunicação via estado `kind`), `ScenariosAdminView`, bloco Mesas (inline migrado de `GestaoPage`).
- **ComunidadeSection** — agrupa sugestões (sugestões recebidas/aprovadas/rejeitadas + histórico de decisões). Lógica inline de `GestaoPage` (normalizadores, fetch, approve/reject em lote, drawer) migrada.
- **ModeraçãoSection** — duas visões: `MessagesView` (mensagens capturadas, Discord-only) + `DiscordDraftReviewTable` (rascunhos unificados Discord+Inbox). `InboxDraftReviewTable` deletado (dedup R-A9). Correction-tracking portado como prop opcional `onBeforeSync`.
- **IntegracoesSection** — Discord config (`DiscordSettingsPanel`), canais (`DiscordSourceList`), importar histórico (`DiscordJsonImportPanel`), importação de dados (`TextPasteArea`, movido do Inbox), enriquecimento (`EnrichmentAdminPanel`, ex-`HydrationAdminPanel`), logs de integração (stub). **Mensagens capturadas e Rascunhos são links contextuais** para Moderação (T2.7/Decisão 1), não re-render.
- **Caixa de entrada DERRUBADO (R-Q2)** — não existe como grupo. `InboxPanel` desmembrado: `TextPasteArea` → Integrações; rascunhos do Inbox → Moderação (unificados); `dev-feedback` → Sistema.
- **SistemaSection** — `DevFeedbackPanel` + stubs honestos (Jobs/Logs/Erros/Config).
- **Resolvida duplicação Moderação×Discord (Decisão 1):** painéis de Mensagens/Rascunhos renderizam **só em Moderação**. Em Integrações, são links contextuais (`ModeracaoLinks`).

## Fase 3 — Renomeações (rótulo + identificadores) + padrão de botões ✅ IMPLEMENTADA

- Trocar rótulos (tabela de renomeações).
- **Rename ampliado (decisão 4)** conforme classificação da Fase 0: (a) interno-FE direto; (b) contrato FE↔BE no mesmo PR; (c) persistido **só com migration** (aprovação nominal + guard online-safe) ou débito explícito. Atualizar **todos** os consumidores — zero nome velho órfão.
- Varredura de verbos de ação → aplicar padrão de botões (primária/secundária/destrutiva/estado/revisão).
- Atualizar `GestaoPage.test.tsx` e demais testes que asseguram rótulos antigos (`Gerenciar Conteúdo`, `Discord Sync`, `Inbox`, `Hidratação de Dados`, `Apurar`...) → novos rótulos. **Não** apenas deletar asserts — migrar.

## Fase 4 — Dashboard + telas novas (incremental) ✅ IMPLEMENTADA

> Estado real (investigação 2026-06-27): landing `/gestao → dashboard` JÁ existe (`App.tsx:62`); `DashboardSection` hoje = card "Visão geral" stub + `<ActivityPanel/>` direto, **sem subnav**; stubs honestos de Sistema (Jobs/Logs/Erros/Config) e Integrações (Logs) JÁ implementados. Detalhe ancorado e divisão de baldes em `tasks.md` §Fase 4.

- **Dashboard** (`DashboardSection`): adicionar subnav local (padrão de botões `subTab` das outras Sections, não `AdminMain.subnav`) — Visão geral / Pendências / Últimas atividades / Alertas / Atalhos rápidos.
  - **Dado REAL, sem fabricar:** *Últimas atividades* = `ActivityPanel` existente (mover, não reescrever); *Pendências* = contagem de sugestões `?status=pending` + rascunhos `getDrafts({origin:'all',status:'needs_review'})` com link p/ Comunidade/Moderação; *Atalhos rápidos* = grade de `NavLink` (links reais, não stub).
  - **Stub honesto "em breve":** Visão geral e Alertas (sem fonte agregada hoje).
  - ⚠️ NÃO instanciar `useDiscordSync` só p/ contador (`queueStats` carrega todas as mensagens client-side). Opcional: religar badge da sidebar via `<AdminSidebar pendenciaCount={n} />` (`GestaoLayout` hoje não passa).
- **Logs/Jobs/Erros em Sistema + Logs em Integrações:** já são stub honesto — só confirmar zero número/lista falsa (sem backend, R-A5).

## Validação (pétrea)

- `pnpm run lint` + `pnpm run build` verdes antes de declarar qualquer fase concluída.
- Testes de `GestaoPage` migrados e verdes.
- a11y: teclado/foco/`aria-current` na sidebar (alinhar com 053 Frente A — não regredir).
- Smoke visual mantenedor em beta antes de prod.
- Git: branch + PR; cada `commit`/`push`/`merge`/deploy com autorização nominal própria.

## Riscos

- **Contrato quebrado por rename** — mitigar separando "texto exibido" de "identificador". Fase 0 lista o que é contrato.
- **Colisão com 053 Frente A** (mesma tela) — sequenciar (recomendado: 054 antes de 053 A).
- **Escopo inflar** (Dashboard/Logs/Jobs viram features) — manter como estrutura+stub salvo decisão explícita.
- **`packages/ui`** — se extrair sidebar/breadcrumb, smoke dos consumidores (SDD Completo).

# Sessão: 054 Fase 1 — Shell de navegação

- **Data:** 2026-06-27
- **Objetivo:** Implementar T1.1–T1.5 da spec 054: AdminSidebar + AdminMain + roteamento aninhado + Sections
- **App/Projeto:** `apps/mesas/frontend`
- **Gate:** D (mesas)
- **Tipo:** SDD Completo (Fase 1)

## Vínculos
- Spec: `specs/054-mesas-gestao-ia-sidebar/`
- Tasks: `tasks.md` §Fase 1
- Autorização: mantenedor liberou Fase 1 ("Fase 1 liberada da spec 054 em tasks liberado")

## Arquivos criados

| Arquivo | Descrição |
|---|---|
| `features/admin/components/AdminSidebar.tsx` | Sidebar fixa com 6 grupos (NavLink, aria-current, design §C) |
| `features/admin/components/AdminMain.tsx` | Área principal: header contextual + breadcrumb + actions + subnav + outlet |
| `features/admin/components/GestaoLayout.tsx` | Shell: AdminSidebar + AdminMain + Outlet |
| `features/admin/components/DashboardSection.tsx` | ActivityPanel + stub Visão geral |
| `features/admin/components/ConteudoSection.tsx` | SystemsAdminView/PlatformsPage/ScenariosAdminView + tabela Mesas |
| `features/admin/components/ComunidadeSection.tsx` | Sugestões (lógica inline migrada de GestaoPage) |
| `features/admin/components/ModeracaoSection.tsx` | DiscordDraftReviewTable + stub Mensagens capturadas |
| `features/admin/components/IntegracoesSection.tsx` | DiscordSettings/DiscordJsonImport/HydrationAdminPanel/TextPasteArea + stubs |
| `features/admin/components/SistemaSection.tsx` | DevFeedbackPanel + stubs (Jobs/Logs/Erros/Config) |

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `App.tsx` | Rota `/gestao` convertida para rotas aninhadas com GestaoLayout; import GestaoPage removido |
| `ComunidadeSection.tsx` | Fix lint: setState síncrono no useEffect → setTimeout |

## Decisões registradas

- **T1.4:** Manter AdminSidebar/AdminMain LOCAIS em `features/admin/components/`. Nenhum outro app-admin consome hoje; extração futura via SDD Completo se houver demanda.

## Checklist de fechamento

- [x] T1.1 — AdminSidebar criado com 6 grupos + NavLink + aria-current + design §C
- [x] T1.2 — AdminMain criado com header/breadcrumb/actions/subnav/outlet
- [x] T1.3 — App.tsx com rotas aninhadas /gestao/<grupo>; guard admin só no pai (R-A11)
- [x] T1.4 — Decisão: manter local, não extrair p/ packages/ui
- [x] T1.5 — GestaoPage quebrado em 6 Sections; lógica inline migrada (sugestões → Comunidade, mesas → Conteúdo)
- [x] lint verde (6/6)
- [x] build verde (6/6, 2255 modules)
- [ ] Smoke de navegação do mantenedor em beta (pendente)
- [ ] tasks.md atualizado (T1.1–T1.5 marcados como IMPLEMENTADO, não fechado)
- [ ] project-state.md atualizado

## Próximo passo

Fase 2: desmontar DiscordSyncPanel, extrair MessagesView, distribuir painéis entre Moderação e Integrações.

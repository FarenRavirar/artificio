# 057 — Redesign completo da gestão do mesas (`/gestao`)

- **Módulo/Pacote:** apps/mesas (frontend admin + contrato API admin existente)
- **Gate relacionado:** D (mesas)
- **Modo:** SDD Completo (refator grande de área admin + toca contrato API/consumidores + possível remoção de endpoints)
- **Escopo desta abertura:** **Investigação + plano primeiro.** Implementação só após aprovação nominal do plano pelo mantenedor (decisão do mantenedor, 2026-06-30).

## Problema

A área `/gestao` do mesas (`mesasbeta.artificiorpg.com/gestao`) está com **cara de gambiarra**: desatualizada, feia, pouco informativa, mal organizada. Specs 047/049/054/056 melhoraram por partes, mas o resultado **não é usável**. Sintomas concretos observados (2026-06-30):

1. **Duas árvores de código admin coexistem e divergem visualmente:**
   - `apps/mesas/frontend/src/features/admin/*` — novo (specs 049/054): `AdminSidebar` 6 grupos + 6 `*Section.tsx` + `GestaoLayout`/`AdminMain`.
   - `apps/mesas/frontend/src/modules/admin/*` — velho: `activity`, `hydration` (EnrichmentAdminPanel), `platforms`, `systems`, `dev-feedback`.
   - Mistura = inconsistência de estilo, padrões e estado.

2. **Dashboard redundante e oco** (`DashboardSection.tsx`):
   - "Visão geral" = stub `em breve` **+** `<ActivityPanel/>`; "Últimas atividades" = **o mesmo** `<ActivityPanel/>` → conteúdo repetido.
   - "Alertas" = stub `em breve` (nunca implementado).
   - "Atalhos rápidos" = só NavLinks (dispensável).
   - Nenhum card de estado real da plataforma.

3. **Integrações amontoadas** (`IntegracoesSection.tsx`): 8 subtabs num só painel (Discord config / canais / mensagens→link / rascunhos→link / importar histórico / importação de dados / enriquecimento / logs). Sem hierarquia, sem fluxo.

4. **Sem "Bot de Discord" organizado:** o backend já expõe config persistível (`chat-exporter/config` GET/PUT), execução (`/run`, `/test`), descoberta (`discovery/guilds`) e métricas (`metrics`, `metrics/shadow`), mas o frontend não monta uma área coesa de Configuração / Importação / Relatórios.

5. **Drafts/revisão espalhados:** dois sistemas paralelos de rascunho no backend — `/api/v1/admin/discord/drafts/*` e `/api/v1/admin/import/drafts/*` — sem um destino central único. Rascunho gerado por Exporter, Bot ou texto colado não tem "lugar só dele".

6. **Endpoints possivelmente órfãos:** bundle de API (`docs/api/generated`) tem `consumers:[]` em 100% das rotas admin (linkagem não populada) e `api-orphans.generated.md` está stale (timestamp 1970). Não há mapa confiável de quais rotas admin o frontend realmente consome.

7. **Ruído de console em `/gestao/conteudo`→Mesas:** 3 GETs de pendência (`system-suggestions`, `scenario-suggestions`, `discord/drafts`) disparados no mount do Dashboard e cancelados pelo dedup do `apiClient` (`[api] Cancelando requisição duplicada`). Não é erro funcional, mas é sintoma de montagem/efeitos mal coordenados.

## Requisitos (numerados, testáveis)

> Esta spec entrega **investigação + plano aprovável**. Requisitos de produto abaixo guiam o plano; a implementação será destravada em fase própria.

- **R1** — Mapa completo e verificável de telas/painéis de `/gestao` (componente → rota → endpoints consumidos), distinguindo `features/admin` vs `modules/admin`.
- **R2** — Mapa completo de endpoints admin do mesas com classificação **usado / órfão / duplicado**, cruzando chamadas reais do frontend (`rg`/AST) contra rotas do backend — sem confiar no bundle stale.
- **R3** — Proposta de **arquitetura de informação (IA) nova da sidebar**, reestruturada do zero, estilo painel Cloudflare (grupos coesos, hierarquia clara, sem redundância). Inclui: grupo **Importação** com sub-área **Bot de Discord** (abas Configuração / Importação / Relatórios) e grupo central **Mesas** = fila unificada de drafts.
- **R4** — Definição de **Mesas central** = fila unificada dos dois sistemas de draft (`discord/drafts` + `import/drafts`) com filtro por origem (Bot / Exporter / Texto), por status (rascunho / revisão / sincronizado) e ações em lote. CRUD de mesas publicadas permanece em Conteúdo.
- **R5** — Definição de **Bot de Discord › Configuração**: todas as configurações editáveis no frontend, com **persistência confirmada após salvar** (round-trip GET após PUT).
- **R6** — Definição de **Bot de Discord › Importação**: leitura prévia ("dry-read") que mostra quantos itens estão **a atualizar / desatualizados**, com filtros e informações relevantes antes de importar.
- **R7** — Definição de **Bot de Discord › Relatórios**: relatórios manipuláveis (filtro/ordenação) reusando `metrics` / `import_runs`.
- **R8** — Redesign do **Dashboard**: enxuto e útil — cards de estado real (mesas ativas, pendências, últimas importações, métricas do bot) + um feed de atividade único. Sem "Alertas" stub, sem "Atalhos", sem subtab redundante.
- **R9** — Plano de **unificação das duas árvores** (`features/admin` + `modules/admin`) numa estrutura única coesa.
- **R10** — Plano de **descarte/consolidação** dos endpoints classificados como órfãos em R2 (remover, marcar `legacy`, ou justificar) — sem deixar nada para trás.
- **R11** — Construção visual **não preguiçosa**: tokens de tema (sem hex hardcoded novo), componentes consistentes, densidade informativa. Acessibilidade de teclado **fora de escopo** (tela de uso pessoal único — decisão do mantenedor).
- **R12** — Plano faseado de implementação com ordem que evita retrabalho, cada fase com critério de aceite verificável.
- **R13** — **Perfis multi-canal para o DiscordChatExporter (Via B)**: substituir o perfil único atual por N perfis configuráveis no frontend (label, channelId, modo de acesso `global|user|bot`, token opcional, agenda, enabled), persistidos no DB (tabela própria), token encriptado. Sem escrita manual na VM. Via A (bot + `sources`) já é multi-canal — só ganha UI. **User/session e bot são suportados, um modo por perfil**; o campo antigo "Cookies" era nomenclatura/implementação errada, pois o CLI usa `-t token` (user token ou bot token), não `--cookies`. Detalhe em `investigacao-notif-config.md` §B.
- **R14** — **Corrigir notificações do admin.** Audiência DECIDIDA (mantenedor, 2026-06-30): sino mostra só **eventos de OUTROS usuários** — **mesa publicada** + **feedback**. **`member_joined` sai do escopo**: verificado que o backend **não tem mecanismo de entrar em mesa** (sem `table_members`/seat/join/enroll), logo o tipo `member_joined` existe no enum (`db/types.ts:459`) mas **nunca pode ser emitido**; entra quando existir feature de membros (outra spec). Implementar: emissor real p/ `table_published` + `dev_feedback`; manter a auto-exclusão do autor (`excludeUserId`); tipos visíveis do sino = {`table_published`,`dev_feedback`}; **remover** `system_suggestion`/`scenario_suggestion` do sino (não pedidos). Tokens no `NotificationBell`. Detalhe em `investigacao-notif-config.md` §A.
- **R15** — **Padrão único de tabela em TODA lista do `/gestao`** (drafts, mensagens, mesas, sistemas, plataformas, cenários, sugestões, usuários, notificações, perfis, runs): cada tabela tem (a) **filtros** (busca + facetas relevantes: status/origem/data/tipo); (b) **seleção múltipla** com ações em lote **apagar** e **arquivar**; (c) ação por linha **abrir** (detalhe/preview) e **editar**. Componente canônico reusável (não reimplementar por tela). Onde o backend não tiver batch/archive, criar o endpoint (contrato via `verify:api`). Detalhe em `proposta-ia.md` §7.

## Critérios de aceite

Esta abertura (investigação+plano) está **concluída** quando:
- `inventario.md` cobre R1+R2 com tabela componente→rota→endpoint e coluna usado/órfão/duplicado.
- `proposta-ia.md` cobre R3–R8 com a sidebar nova desenhada e cada grupo justificado.
- `plan.md` cobre R9–R12 com fases ordenadas e rollback.
- Mantenedor aprovou (nominal) a IA e o plano antes de qualquer código.

## Fora de escopo

- Acessibilidade de teclado/WCAG (tela de uso pessoal único — R11).
- Mudança no contrato SSO / `packages/auth` / `accounts.`.
- Automação inteligente / IA de auto-aprovação (é a spec 052; esta só **expõe** os relatórios/métricas que a 052 já produz).
- Cutover DNS, infra, deploy de outros apps.
- CRUD de mesas publicadas (permanece em Conteúdo, só reorganizado visualmente).

## Riscos e impacto em outros módulos

- **Risco baixo de blast radius cross-app:** mudança concentrada em `apps/mesas/frontend` + possível remoção de rotas admin do `apps/mesas/backend`. Não toca `packages/*` de auth nem outros apps.
- **Risco de regressão funcional:** `/gestao` é a ferramenta operacional do mantenedor; refator grande pode quebrar fluxos de moderação/importação em uso. Mitigação: fases pequenas + smoke por fase.
- **Contrato API:** remover endpoints órfãos passa por `pnpm verify:api` (governança spec 055, `api-diff` breaking bloqueia). Qualquer remoção = breaking change documentada.
- **Specs vizinhas:** 052 (automação IA) produz métricas/drafts que esta spec consome na UI — coordenar para não duplicar nem quebrar `discord_import_runs` / `_ai_suggestions`.

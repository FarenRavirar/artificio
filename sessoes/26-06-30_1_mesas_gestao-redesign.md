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

## Próximo passo
- **G2:** autorização nominal para iniciar implementação (Fase 2: fundação tokens+`<AdminTable>`+sidebar). **Nenhum código antes do OK.**

## Critério de conclusão (desta abertura)
- `inventario.md` + `proposta-ia.md` completos; plano faseado aprovado pelo mantenedor.

## Backlog
- `BL-057-GESTAO-REDESIGN` registrado em `specs/backlog.md`.

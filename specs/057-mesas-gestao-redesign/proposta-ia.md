# Proposta de IA + Design — 057 (Fase 1)

> Base: `inventario.md`. Estilo-alvo = painel Cloudflare (organização por recurso, densidade informativa, settings em cards com save por seção, um acento só). Decisões abaixo destravam a ampliação de tasks (Fase 2+). Acessibilidade de teclado fora de escopo (decisão mantenedor).

## 1. Princípios de design (Cloudflare-like)

1. **Sidebar = recursos, não verbos.** Cada grupo top-level é um domínio coeso; ações vivem dentro da página, não na nav.
2. **Página = header + tabs + conteúdo.** Header com breadcrumb + título + ação primária à direita. Sub-visões = tabs sob o header (não subnav de botões azuis soltos).
3. **Overview primeiro.** Todo grupo com dado abre numa visão de estado (metric-cards + tabela/feed), não num stub.
4. **Um acento só:** brand `#FF5722` para ativo/primário. **Matar `bg-blue-600`** dos subtabs (inconsistente com a marca).
5. **Tokens, não hardcode.** `--admin-rail`, `--admin-surface`, `--surface`, `--fg`, `--border`. Zero `#0E1A38`/`#16223E`/`bg-white/5` cru novo.
6. **Estados honestos.** Sem "em breve". Stub = ou constrói, ou remove o item. Empty state = convite à ação ("Nenhum rascunho a revisar. Importe pelo Bot de Discord.").
7. **Vocabulário do usuário.** "Rascunhos a revisar", "Canais monitorados", "Última importação" — não "drafts needs_review", "sources", "runs".

## 2. Sidebar nova (reestruturada do zero)

```
GESTÃO
├─ Visão geral        (Overview: metric-cards + atividade)              [LayoutDashboard]
├─ Mesas              (pipeline pré-publicação — fila unificada)        [ClipboardList]
│   ├─ Rascunhos        (drafts unificados: Bot/Exporter/Texto · status · lote)
│   └─ Mensagens         (discord_import_messages — capturas cruas)
├─ Catálogo           (entidades de referência + mesas publicadas)      [BookOpen]
│   ├─ Sistemas · Plataformas · Cenários · Mesas publicadas (CRUD)
├─ Comunidade         (sugestões da comunidade)                         [Users]
│   └─ Sugestões de sistema · Sugestões de cenário
├─ Importação         (todas as fontes de ingestão)                     [DownloadCloud]
│   ├─ Bot de Discord   → tabs: Configuração · Importação · Relatórios
│   ├─ Importar texto    (colar texto → rascunho)
│   ├─ Importar arquivo  (JSON DiscordChatExporter)
│   └─ Enriquecimento    (sync/enrich prod→dev)
└─ Sistema            (operação do painel)                              [Settings]
    ├─ Usuários         (decisão R10 — ver §6)
    └─ Erros reportados (DevFeedbackPanel)
```

**O que dissolve (nada fica para trás):**
- `Moderação` (grupo atual) → vira o grupo **Mesas** (mensagens + rascunhos são o pipeline pré-publicação).
- `Integrações` (grupo atual, 8 subtabs) → vira **Importação** (Bot de Discord organizado + texto + arquivo + enriquecimento). Os subtabs "mensagens"/"rascunhos" que eram só links somem (o destino é Mesas).
- `Sistema` perde os 4 stubs (jobs/logs/erros/config) → fica Usuários + Erros reportados (DevFeedback). "Config" só volta se houver config real.
- `Dashboard` 5-subtabs → **Visão geral** página única.

## 3. Mapa "tela antiga → lugar novo"

| Hoje | Novo |
|---|---|
| Dashboard › visão-geral/atividades | Visão geral (página única) |
| Dashboard › pendências | Visão geral (card "Pendências" linkando) |
| Dashboard › alertas/atalhos | **removido** |
| Moderação › mensagens | Mesas › Mensagens |
| Moderação › rascunhos | Mesas › Rascunhos |
| Integrações › Discord (config+bot) | Importação › Bot de Discord › Configuração |
| Integrações › Canais monitorados | Importação › Bot de Discord › Configuração (seção Canais) |
| Integrações › Importar histórico (JSON) | Importação › Importar arquivo |
| Integrações › Importação de dados (texto) | Importação › Importar texto |
| Integrações › Enriquecimento | Importação › Enriquecimento |
| Integrações › Logs | Importação › Bot de Discord › Relatórios |
| Conteúdo › systems/platforms/scenarios/tables | Catálogo (mesmos, header+tabs) |
| Comunidade | Comunidade (mantém) |
| Sistema › ferramentas (DevFeedback) | Sistema › Erros reportados |
| Sistema › jobs/logs/erros/config (stub) | **removido** |

## 4. Bot de Discord (sub-área, 3 tabs) — R5/R6/R7

### Configuração (persistente, round-trip)
- Form de `chat-exporter/config` (GET→PUT→GET confirma): padrão global de autenticação (`user`/`bot`) + token de usuário/session global (status `is_set`/preview). Perfis definem canal, agenda e podem sobrescrever token/modo. O campo antigo "Cookies" vira explicação leiga de **token de usuário/session**; o CLI oficial do DiscordChatExporter usa `-t token`, não `--cookies`.
- Seção **Bot token** (`settings`, PUT/DELETE `settings/bot-token`).
- Seção **Canais monitorados** (`sources` CRUD + `discovery/guilds`).
- Persistência provada: após Salvar, re-GET e refletir `updated_at`. (R5)

### Importação (dry-read antes)
- Botão "Executar agora" (`chat-exporter/run`) **precedido de leitura**: mostrar, por canal monitorado (`sources` + `last_synced_at`), quantos estão **a atualizar / desatualizados** (delta desde `last_message_id`/`last_synced_at`). (R6)
- Filtros (canal, janela de data) antes de disparar.
- Resultado da execução (`run` retorna incoming/processed/errors) listado.

### Relatórios (manipulável)
- `discord/metrics` (runs + totals + top_corrected_fields) com filtro/ordenação por origem, data, status. (R7)
- Quando spec 052 ativar: `metrics/shadow` + `automation/eval` aqui (read-only).

## 5. Mesas central — fila unificada (R4)
- Tab **Rascunhos**: une `discord_import_table_drafts` via `discordSyncApi` + `inboxApi` (já mistura em ModeracaoSection). Colunas: título, **origem** (Bot/Exporter/Texto — derivar de `source_kind`/`source_type`), **status** (rascunho/revisão/sincronizado/descartado), confiança, campos faltantes. Filtro por origem+status. **Ações em lote** (revisar/rejeitar/limpar descartados — já existem `drafts/batch`, `drafts/rejected`). Ação por linha: editar → sync, reparse, **refresh-image** (👻 hoje → ligar aqui).
- Tab **Mensagens**: `discord_import_messages` cru (MessagesView), parse/parse-batch/diagnose.

## 6. Disposição dos endpoints órfãos (R10 — decisões a confirmar com mantenedor)

| Endpoint | Recomendação |
|---|---|
| `GET /admin/users`, `/admin/users/:id`, `PATCH /admin/users/:id/covil` | **DECIDIDO: construir** Sistema › Usuários (lista com `<AdminTable>` R15 + marcar Covil do Lich por usuário). |
| `GET/POST/PUT/DELETE /admin/setting-suggestions` | **DECIDIDO: NÃO remover, construir telinha.** É `setting_style_suggestions` (cenário→estilos de jogo sugeridos); a **DATA é usada** pela rota pública `settings.ts` + form de cadastro de mesa (`SettingStylesField`). Só faltava UI de gestão → Catálogo › Estilos por cenário (`<AdminTable>`). |
| `POST /admin/discord/drafts/:id/refresh-image` | **Ligar** na ação por linha de Mesas › Rascunhos (re-baixar imagem do anúncio). |
| `POST /admin/discord/import-json/reparse` | **Ligar** no resultado de Importar arquivo, ou remover se redundante com `drafts/:id/reparse`. |
| `GET /admin/import/metrics` | **DECIDIDO: remover** (breaking documentado via `verify:api`). Redundante — `discord/metrics` já agrega inbox+discord; wrapper `inboxApi.getMetrics` sem caller. |
| `POST /admin/tables/auto-archive` | Manter (cron). Sem UI. |
| `automation/*`, `metrics/shadow` | Manter; expor read-only em Relatórios quando 052 ativar. |

## 7. Tokens de design (R11)
- Definir em `index.css` (já há `[data-theme]`): `--admin-rail` (sidebar), `--admin-surface` (cards), reusar `--surface/--fg/--fg-muted/--fg-faint/--border/--brand`.
- Substituir nas Sections: `#0E1A38`→`--admin-rail`, `#16223E`→`--admin-surface`, `bg-blue-600`→`bg-[var(--brand)]`, `bg-white/5`→token.
- Componentes reusados: `StatusPill`, `MetricCard`, `DataTableToolbar` (filtro+busca), `SectionCard` (settings) — extrair locais em `features/admin/components/ui/`.

### 7.1 `<AdminTable>` — padrão único de lista (R15)
Toda lista usa o MESMO componente. Contrato:
- **Filtros:** barra com busca textual + facetas declaradas por tela (status, origem, data, tipo, kind). Estado de filtro na URL (query params) p/ deep-link.
- **Seleção múltipla:** checkbox por linha + "selecionar todos" (respeita filtro) → barra de ações em lote: **Apagar** (confirm) e **Arquivar**.
- **Ações por linha:** **Abrir** (drawer/preview read-only) e **Editar** (form), + ações específicas da entidade (ex.: draft → sync/reparse/refresh-image; mesa → ativar/cancelar; usuário → covil).
- **Estado:** loading, empty (convite à ação), erro.
- Props: `columns`, `rows`, `filters`, `bulkActions` (delete/archive sempre; extras opcionais), `rowActions`, `onOpen`, `onEdit`.

**Cobertura backend (criar onde faltar — contrato via `verify:api`):**
| Entidade | apagar lote | arquivar | hoje |
|---|---|---|---|
| Drafts | ✅ `drafts/batch`+`drafts/rejected` | usar status `rejected`/novo `archived` | ok |
| Mensagens | ✅ `messages/batch` (status `ignored`) | `ignored` = arquivar | ok |
| Mesas | ⚠️ só `DELETE /admin/tables/:id` (1×1) | `status` cancelled; falta `archived` | criar batch + archive |
| Sistemas/Plataformas/Cenários | ⚠️ DELETE 1×1 | sem archive | criar batch (+archive se fizer sentido) |
| Sugestões | ✅ approve/reject 1×1 | reject = arquivar | criar batch reject |
| Usuários | ⚠️ sem delete | sem archive | decidir (R10) |
| Notificações | falta delete | falta archive | criar delete/archive lote |
| Perfis ChatExporter (R13) | criar | `enabled=false` | novo |
| Runs (relatórios) | read-only (sem delete) | — | ok |

> "Arquivar" = status terminal não-destrutivo (esconde da lista padrão, recuperável via filtro "Arquivados"). "Apagar" = destrutivo, com confirmação. Definir por entidade quais fazem sentido (runs/metrics não apagam).

## 8. Correção do ruído de request (DEB-057-03)
- Centralizar contagem de pendências numa única fonte (TanStack Query `useQuery(['pendencias'])` compartilhada por GestaoLayout + Visão geral), com dedup natural do cache — elimina os 3 GETs concorrentes montados em paralelo.

## 9. Unificação das árvores (R9)
- Mover `modules/admin/{activity,hydration,platforms,systems,dev-feedback}` → `features/admin/` (ou consolidar sob `features/admin/sections/*` + `features/admin/components/ui/*`). `features/discord-sync` + `features/inbox` permanecem como features de domínio, consumidas pelas Sections novas. Uma árvore só de UI admin.

## Veredito
IA aprovável: 7 grupos (Visão geral · Mesas · Catálogo · Comunidade · Importação · Sistema) com Moderação→Mesas e Integrações→Importação. Bot de Discord ganha 3 tabs reais. Drafts unificados na Mesas. Órfãos resolvidos (construir/ligar/remover). Pendente: **aprovação nominal (G1)** + confirmação das 3 decisões de remoção em §6.

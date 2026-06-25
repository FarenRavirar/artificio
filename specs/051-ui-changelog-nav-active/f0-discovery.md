# 051 — F0 Discovery (Onda 0): mapa de duplicação real

> Entregável da Onda 0. Varredura executada 2026-06-25 (`rg` + leitura direta; `jscpd` não necessário — duplicação localizada e confirmável por inspeção). **Define o escopo final de F4/F5/F6 antes de qualquer extração.** Sem código de produção.

## Método

- `rg` por símbolo/nome em `apps/*` + `packages/*`; leitura direta dos candidatos.
- Critério de extração (R-F5.1): **2+ consumidores reais** OU padrão de admin claramente compartilhável. Sem 2+ e sem padrão → **manter local** (extração especulativa = retrabalho).
- Regra inversa (anti-poluição): domínio mesas/Discord **não** entra em pacote compartilhado.

---

## 1. F4 — Wrappers de changelog → veredito: **PEQUENO** (trim, não grande extração)

O trabalho pesado **já foi feito na spec 041**: `DynamicChangelogModal`, `StaticChangelogModal`, `useChangelogData`, `useChangelogBadge`, `normalizeChangelogEntries` já vivem em `packages/ui` (`index.ts:39-42`). Os 4 wrappers restantes já são finos:

| Wrapper | Linhas | O que varia | Veredito |
|---|---|---|---|
| `apps/site/.../SiteChangelogModal.tsx` | 13 | nada além do nome | **idêntico ao de links** |
| `apps/links/.../LinksChangelogModal.tsx` | 13 | nada além do nome | **idêntico ao de site** |
| `apps/mesas/.../ChangelogModal.tsx` | 27 | fetcher (`fetch` nativo) | mínimo específico |
| `apps/glossario/.../ChangelogModal.tsx` | 31 | fetcher (`axios api`) + `LABELS` | mínimo específico |

**Achado:** `site` e `links` são **100% idênticos** (só muda o nome do export) — montam `normalizeChangelogEntries(rawChangelogs)` + `<StaticChangelogModal>`. Dup real, mas trivial.

**Escopo F4 fechado:**
- **Extrair agora:** um helper/componente compartilhado para o caso estático (`site`+`links`) — ex.: `StaticChangelogModal` aceita `rawChangelogs` direto e normaliza internamente, eliminando os 2 wrappers idênticos. Ganho: −2 arquivos duplicados.
- **Manter local (mínimo):** `mesas` e `glossario` — divergem no fetcher (fetch vs axios) e labels; já estão no mínimo. Não forçar unificação (fetch≠axios é diferença legítima).
- **F1 (bug) entra na fonte `ChangelogModal.tsx`** — não nos wrappers (já confirmado: causa provável é compartilhada).
- **R-F4.6:** atualizar nota da spec 020 marcando extração do changelog como concluída (a base já saiu na 041; F4 fecha o resto).

---

## 2. F5 — Primitivas de admin do mesas → veredito: **REDIMENSIONADO**

Cada candidato reavaliado por consumidores reais:

### 2.1 ConfirmDialog → **EXTRAIR (alto valor, 3 apps)**
- mesas tem `ConfirmProvider` + `useConfirm` + `confirmDialogContext` acessível (focus trap, scroll lock, `role=alertdialog`, ESC/Enter) em `apps/mesas/frontend/src/components/ui/`.
- **`window.confirm` cru em 10 lugares**:
  - `site-admin`: PostsList, PagesList, FeedbackPage, MediaLibrary (×4)
  - `glossario`: ResultCard (×2), AdminFeedbackPage (×1)
  - `mesas`: ProfileEditPage, SystemSuggestionResolutionDrawer, GestaoPage (×3 ainda crus, apesar de ter o provider)
- **Justificativa 2+ consumidores: cumprida (3 apps).** Maior valor de F5.
- **Custo/risco confirmados na varredura:**
  - `ConfirmDialog.css` é **dark-only hardcoded** (`#1a1a1a`, `white`, `#ef4444`, `#e65c00`) — **precisa migrar p/ tokens de tema** (`var(--surface)/--fg/--state-*` + `var(--color-artificio-orange)` que já usa) antes de servir apps light (site-admin/glossario claros).
  - **`site-admin` NÃO depende de `@artificio/ui`** (ausente no `package.json`) — adicionar a dep é pré-requisito p/ consumir lá.
- **Plano:** extrair `ConfirmProvider`/`useConfirm`/contexto/CSS p/ `packages/ui` com tokens de tema; migrar os `window.confirm` crus dos apps que já consomem `@artificio/ui` (mesas, glossario) no mesmo PR; **site-admin = rollout futuro** (débito) por exigir nova dep + verificação de bundle.

### 2.2 GestaoStateWrapper → **CONSOLIDAR (não extrair novo)**
- `packages/ui/src/primitives.tsx` **já exporta** `LoadingState`, `EmptyState`, `ErrorState`, `SuccessState`, `Banner`, `Modal`, `Drawer`.
- mesas duplica isso **2×**: `features/discord-sync/components/GestaoStateWrapper.tsx` **e** `components/ui/LoadingState.tsx`.
- **Não é extração — é consolidação:** deletar os locais do mesas e consumir os primitives compartilhados. `GestaoStateWrapper` é só um if-ladder loading/error/empty que `primitives.tsx` já cobre (pode virar um helper fino que compõe os 3 states shared, ou ser substituído nos call-sites).
- **Atenção:** `GestaoStateWrapper` usa cores dark hardcoded (`text-white/40`, `bg-red-900/20`); os primitives shared já são theme-aware — a troca melhora consistência.

### 2.3 FileDropzone → **EXTRAIR (2 apps, médio)**
- mesas: `features/discord-sync/components/FileDropzone.tsx` (controlado, JSON-específico: `id="discord-json-input"`, placeholder "Cole o JSON aqui", `accept=".json"`).
- glossario: `pages/ImportPage.tsx:520` tem drag-drop inline (`onDrop`/`onDragOver`).
- **Justificativa 2+: cumprida.** Mas o do mesas tem texto/id/accept específicos; o do glossario é inline (não componente).
- **Plano:** extrair um `FileDropzone` genérico p/ `packages/ui` com props (`accept`, `placeholder`, `label`, handlers) + tokens de tema (hoje `#0F1A2E` hardcoded); mesas e glossario consomem. Médio esforço.

### 2.4 ImportResultGrid + StatCard → **MANTER LOCAL (domínio mesas)**
- `ImportResultGrid` depende de `ImportResult` (de `useJsonImport`) + labels "Importação concluída"/"drafts"/stats de import → **domínio mesas/Discord**.
- `StatCard`: 3 consumidores, **todos internos do mesas** (MasterStats, ImportResultGrid, MessagesToolbar).
- **Veredito:** não vão p/ `packages/ui`. Se quiser dedup, é **dentro do mesas** (StatCard já é o componente comum local). Mover poluiria o pacote com domínio.

---

## 3. F6 — Schemas Zod cross-app → veredito: **NULO**

Varredura de TODOS os schemas Zod candidatos + uso de zod no repo:

| Schema | Onde vive | Consumidores |
|---|---|---|
| `updateDraftSchema`/`patchDraftSchema` | `apps/mesas/backend/src/routes/{inbox,discord}/` | **só mesas** |
| `discordChatExporterExportSchema` | `apps/mesas/backend/src/discord/` | **só mesas** |
| schemas de sugestão (system/scenario), table/profile validators, discovery, ingest, etc. | `apps/mesas/backend` + `apps/mesas/frontend` | **só mesas** |
| env schema | `packages/config/src/env.ts` | já compartilhado (config) |

- **TODO schema de domínio vive exclusivamente em `apps/mesas`.** Nenhum serve 2+ apps.
- `packages/content` hoje exporta só SEO/meta/jsonld/sitemap (`index.ts`) — **zero zod**.
- **Veredito: F6 não produz nada.** Não tocar `packages/content`. Confirma a hipótese do mantenedor ("F6 pode dar pequeno ou nulo"). D17/D18 da spec 049 já deduplicaram o que havia, **dentro** do mesas — correto que fiquem lá.

---

## 4. Escopo final das ondas (pós-F0)

| Onda | Frente | Escopo fechado | Tamanho |
|---|---|---|---|
| **A** (`packages/ui`) | **F5.ConfirmDialog** | extrair provider+ctx+css c/ tokens; migrar mesas+glossario; site-admin = débito rollout | médio-alto |
| **A** | **F5.StateWrapper** | consolidar c/ `primitives.tsx` existente (deletar locais mesas) | pequeno |
| **A** | **F5.FileDropzone** | extrair genérico (props+tokens); mesas+glossario consomem | médio |
| **A** | **F5.ImportResultGrid/StatCard** | **manter local** (domínio mesas) — sem ação | nulo |
| **A** | **F4** | colapsar wrappers idênticos site+links; mesas/glossario ficam no mínimo | pequeno |
| **A** | **F1** | fix na fonte `ChangelogModal.tsx`/`styles.css` (causa comum) | pequeno |
| **B** (`packages/content`) | **F6** | **NULO** — não tocar pacote | nulo |
| **C** (nav) | **F2** | fix de `currentHref` (glossario não passa; mesas mismatch) | pequeno |
| **D** (shell) | **F3** | DEB-050-02 convergência `[`→`[[`/`>&2` | pequeno |

**Onda B cai** (F6 nulo) — a sequência de PRs vira: Onda A (`packages/ui`) → Onda C (nav) → Onda D (shell). Sem PR de `packages/content`.

---

## 5. Constraint transversal descoberto (vale p/ toda Onda A)

Primitivas locais do mesas usam **paleta dark hardcoded**, não os tokens de tema que a spec 047 (REV-026) adotou:
- `text-white/40`, `bg-red-900/20`, `bg-green-900/20`, `#0F1A2E`, `#1a1a1a`.
- **Qualquer coisa promovida a `packages/ui` deve migrar p/ tokens** (`--surface`/`--fg`/`--state-*`/`--color-artificio-orange`) senão quebra em apps light (site-admin, glossario claro) e no dark-readiness.
- Isto é pré-requisito de F5.ConfirmDialog e F5.FileDropzone — registrado no plano.

---

## 6. Achados fora de escopo → backlog

1. **`site-admin` não depende de `@artificio/ui`** (ausente no `package.json`). Bloqueia rollout do ConfirmDialog extraído para o site-admin (4 `window.confirm` crus ficam). → **débito de rollout futuro** (`BL-051-...` ou item próprio) — adicionar a dep + smoke de bundle do site-admin é trabalho separado.
2. **`window.confirm` crus remanescentes no mesas** (ProfileEditPage, SystemSuggestionResolutionDrawer, GestaoPage) apesar do `ConfirmProvider` existir — migrar para `useConfirm` cabe na Onda A junto da extração.
3. **F6 nulo** não é débito (é veredito de não-mover); registrado aqui e no project-state ao fechar.

> Itens 1-2 a registrar em `specs/backlog.md` quando a Onda A for autorizada (não criar débito especulativo antes da implementação começar).

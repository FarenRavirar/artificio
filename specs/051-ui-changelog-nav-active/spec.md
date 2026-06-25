# 051 — Changelog (overflow/z-index) + indicador de projeto ativo na nav + convergência scripts deploy

- **Módulo/Pacote:** `packages/ui` (compartilhado: `ChangelogModal`, `Nav`, `Header`, `styles.css`) + consumidores (`apps/mesas`, `apps/glossario`, `apps/site`, `apps/links`) + infra (`scripts/deploy/*` — frente herdada do DEB-050-02)
- **Gate relacionado:** nenhum gate de programa; qualidade transversal (UI compartilhada) + infra
- **Tipo:** SDD Completo (toca `packages/ui` = compartilhado; pétrea Artifício)
- **Origem:** mantenedor (2026-06-25) — 3 frentes acumuladas + transferência do DEB-050-02 da spec 050
- **Status:** planejada; **Onda 0 (F0 discovery) executada 2026-06-25** — mapa em `f0-discovery.md`. Escopo F4/F5/F6 fechado: **F6 = nulo** (Onda B cai), F4 = pequeno, F5 redimensionado. Ondas A/C/D pendentes de autorização de implementação (DeepSeek).

> **Nota de governança:** este `spec.md` descreve **o quê e por quê** (problema + requisitos testáveis). A solução técnica (CSS, props, edição de arquivo) vive em `plan.md`/`tasks.md`. **Sem código nesta fase.**

---

## Escopo: 3 frentes + 1 débito herdado

A spec agrupa frentes de baixo risco mas alto incômodo visual na UI compartilhada, mais um follow-up de infra transferido da spec 050.

| Frente | Tema | Risco | Origem |
|---|---|---|---|
| **F1** | Bug de visualização do changelog | baixo (CSS) | evidência: imagens do mantenedor |
| **F2** | Indicador visual de projeto ativo na nav | baixo (CSS+dados) | pedido de feature do mantenedor |
| **F3** | Convergência de estilo dos scripts de deploy antigos (`[`→`[[`) | baixo (shell) | **DEB-050-02** transferido da spec 050 |
| **F4** | Consolidar os wrappers de changelog duplicados por app → `packages/ui` | médio (compartilhado) | extração adiada da spec 020 (`header-nav-actions.md`), duplicação real em 4 apps |
| **F5** | Extrair primitivas de admin criadas locais no mesas → `packages/ui` (`GestaoStateWrapper`, `ResultGrid`/`ImportResultGrid`, `ConfirmDialog`, `FileDropzone`) | médio (compartilhado) | **G01** da spec 049 (`proposta-reorganizacao.md` §4) — prevista, não executada |
| **F6** | Centralizar schemas Zod **genuinamente cross-app** → `packages/content` (auditar antes; mover só os compartilhados, não os de domínio mesas) | médio (compartilhado) | **G02** da spec 049 (§5) — prevista, não executada |
| **F0** | **Varredura de duplicação** pré-extração: mapear toda primitiva/schema duplicado entre apps que deveria ser compartilhado (não só os já listados) | discovery | pedido do mantenedor: pré-lançamento, evitar bagunça depois |

## Estratégia de execução (ordem que evita retrabalho)

Pré-lançamento: extrair o que é compartilhado **antes** de consumir/corrigir, para não duplicar e depois apagar.

| Onda | Frentes | Por quê nesta ordem |
|---|---|---|
| **0 — Discovery** | F0 | Mapear toda duplicação real ANTES de extrair. Decide o conteúdo final de F4/F5/F6 e evita extração parcial que vira retrabalho. |
| **A — `packages/ui` consolidation** | F4 + F5, **depois** F1 | Tudo toca `packages/ui` e é "extrair dup local → fonte única". Fazer junto = **um** review do pacote compartilhado + **um** smoke dos consumidores, em vez de tocar `packages/ui` 3× separadas. **F1 (fix do bug) entra por último, na fonte já consolidada** — corrige uma vez, não 4×. |
| **B — `packages/content` schemas** | F6 | Independente da UI. Auditar quais schemas Zod são de fato cross-app (D17/D18 já dedup dentro do mesas; F6 só move o que serve 2+ apps). Pode resultar pequeno — a auditoria decide. |
| **C — nav** | F2 | Fix de dados (`currentHref`) independente; sem acoplamento com extrações. |
| **D — shell** | F3 | Totalmente ortogonal (bash). PR/commit próprio. |

**Regra anti-duplicação (pétrea Artifício, reforçada aqui):** nenhuma frente cria componente/schema novo local quando já existe (ou vai existir na Onda A/B) versão compartilhada. Em caso de extração, o consumidor passa a **importar** do pacote; cópia some no mesmo PR.

---

## F1 — Changelog quebra a visualização

### Evidência (imagens do mantenedor, 2026-06-25)

- **Mesas:** o conteúdo do changelog aparece **sobreposto** a outros elementos da página (hero "Encontre uma mesa de RPG em 30 segundos" + barra de busca + cards SISTEMA renderizando uns por cima dos outros, "um na frente do outro"). Sintoma de **empilhamento/z-index** ou de o modal não estar isolando o fundo (scroll lock / portal / opacidade do backdrop).
- **Glossário:** a **parte de cima** do changelog fica **escondida** atrás do header fixo do app (sticky/fixed) — o topo do primeiro card/data não é alcançável por scroll.

### Componentes envolvidos

- Fonte compartilhada: `packages/ui/src/ChangelogModal.tsx` (modal via `createPortal` para `document.body`, `fixed inset-0 z-[9999]`, `overflow-y-auto`, container `max-h-[calc(100dvh-2rem)]`).
- Wrappers por app: `apps/mesas/frontend/src/components/ChangelogModal.tsx`, `apps/glossario/frontend/src/components/ChangelogModal.tsx`, `apps/site/.../SiteChangelogModal.tsx`, `apps/links/.../LinksChangelogModal.tsx`.

### Requisitos testáveis (F1)

- **R-F1.1** Ao abrir o changelog em **mesas**, nenhum elemento da página de fundo (hero, busca, cards) renderiza **na frente** do modal nem do backdrop; o modal cobre/escurece a página inteira.
- **R-F1.2** Ao abrir o changelog em **glossário**, a **primeira data e o primeiro card** do changelog ficam totalmente visíveis e alcançáveis por scroll, sem ficarem cortados pelo header do app.
- **R-F1.3** A correção é feita **na fonte compartilhada** quando a causa for comum (não duplicar fix em cada wrapper); fix por app só se a causa for específica do app (ex.: header sticky do glossário). Registrar em `plan.md` qual caso é qual.
- **R-F1.4** Sem regressão de tema: modal correto em **light e dark** nos apps afetados.
- **R-F1.5** Validação visual registrada (screenshot/preview) dos dois casos corrigidos.

---

## F2 — Indicador de projeto ativo na nav

### Estado atual (auditado no código)

O mecanismo de marcador ativo **já existe**, mas está **inerte/inconsistente** por dados:

- `packages/ui/src/Nav.tsx` marca `aria-current="page"` quando `item.href === currentHref`.
- `packages/ui/src/styles.css:254` e `:1197` já desenham o marcador: `border-bottom-color: var(--artificio-brand)` (laranja `#FF5722`) em **light e dark** — ou seja, o "traço laranja embaixo do nome" pedido **já está estilizado**.
- **Problema:** os apps passam `currentHref` de forma inconsistente:
  - `apps/glossario/.../GlossarioHeader.tsx` **não passa `currentHref`** → nenhum item de nav marca.
  - `apps/mesas/.../AppShell.tsx` passa `currentHref={publicOrigin}` → marca só se `publicOrigin` casar **exatamente** com o `href` do item de nav do mesas (provável mismatch por barra final/origin vs URL canônica) → nas imagens não há marcador.
  - `apps/links/.../LinksHeader.tsx` passa `currentHref="https://links.artificiorpg.com"`.
  - `apps/site` passa via `Base.astro`/`SiteHeader.astro`.

### Requisitos testáveis (F2)

- **R-F2.1** Estando em um projeto (ex.: mesas), o item correspondente na **nav cross-projeto** do header (`Portal/Glossário/Mesas/Downloads/Esferas/SRD/WhatsApps`) exibe marcador visual de "você está aqui".
- **R-F2.2** O marcador é consistente em **todos** os apps que usam o `Header` compartilhado (mesas, glossário, site, links) — a correção garante o `currentHref` correto em cada um, casando com o `href` do item de nav canônico.
- **R-F2.3** Solução visual definida e aprovada em `plan.md`: ponto de partida = **traço laranja inferior** já existente; avaliar reforço (peso/realce do label) se o traço sozinho ficar fraco. Decisão final fica no plano (não inventar no código).
- **R-F2.4** Funciona e tem contraste adequado em **light e dark** (laranja de marca `#FF5722`, regra de contraste: acento, nunca texto de corpo).
- **R-F2.5** Acessibilidade preservada: `aria-current="page"` continua no item ativo (não regredir o já existente).
- **R-F2.6** Sem marcação dupla nem item ativo errado quando o app também tem `moduleNav` (subnav própria).
- **R-F2.7** Validação visual registrada (screenshot/preview) com o marcador correto em pelo menos mesas + glossário, light e dark.

---

## F3 — Convergência de estilo dos scripts de deploy antigos (DEB-050-02 transferido)

Herdado da spec 050 (`specs/050-.../debitos.md` §DEB-050-02). Os 3 scripts novos do guard nasceram best-practice (`[[`, erros em `>&2`); os antigos não. Convergir é refactor próprio, fora da PR #95.

### Requisitos testáveis (F3)

- **R-F3.1** Padronizar `[`→`[[` e erros para `>&2` em `scripts/deploy/{lib_migrations,apply_required_migrations,test_migration_lock,validate_branch_invariant}.sh` (lista a confirmar com `rg` no plano — pode haver outros).
- **R-F3.2** `ShellCheck` limpo (via `_lint-shell.yml` local + CI) após a convergência.
- **R-F3.3** Os 3 self-tests de shell continuam verdes: `test_migration_guard.sh`, `test_migration_reconcile.sh`, `test_migration_lock.sh`.
- **R-F3.4** Mudança puramente estilística — **zero alteração de comportamento** do guard/lock/reconcile.

---

## F4 — Consolidar wrappers de changelog duplicados em `packages/ui`

### Origem (extração adiada da spec 020)

A spec 020 deixou explícito: *"`ChangelogAction`, `NotificationBell`, `FeedbackButton` e modais seguem por app até existir duplicação real em 2+ apps"* (`specs/020-.../header-nav-actions.md:99`; idem `backlog-b2-b7-review.md:53`). A condição-gatilho **já ocorreu**: existem **4 wrappers** de changelog quase idênticos:

- `apps/mesas/frontend/src/components/ChangelogModal.tsx`
- `apps/glossario/frontend/src/components/ChangelogModal.tsx`
- `apps/site/src/components/SiteChangelogModal.tsx`
- `apps/links/src/components/LinksChangelogModal.tsx`

Todos envolvem o `ChangelogModal`/`DynamicChangelogModal`/`StaticChangelogModal` de `packages/ui`, mudando só fetcher/labels. Já existe base compartilhada (`DynamicChangelogModal`, `useChangelogData`, `useChangelogBadge`) — F4 termina o trabalho, removendo a duplicação remanescente por app.

### Requisitos testáveis (F4)

- **R-F4.1** Auditar os 4 wrappers e mapear o que é genuinamente específico do app (fetcher/endpoint/labels) vs duplicado (estrutura, estados, badge).
- **R-F4.2** Reduzir cada wrapper ao mínimo específico, consumindo a API compartilhada de `packages/ui` (sem reescrever o modal). Onde a configuração couber em props, eliminar o wrapper.
- **R-F4.3** A correção de **F1** entra na fonte consolidada (não duplicada nos 4 wrappers) — F1 e F4 coordenadas.
- **R-F4.4** Sem regressão funcional: badge "novidade", fetch/erro/retry, truncamento, light/dark — em todos os 4 apps.
- **R-F4.5** `pnpm run lint` + `pnpm run build` verdes; smoke proporcional nos 4 consumidores (compartilhado = SDD Completo).
- **R-F4.6** Atualizar a nota da spec 020 (`header-nav-actions.md`) marcando a extração do changelog como executada nesta spec.

## F5 — Extrair primitivas de admin do mesas → `packages/ui` (G01 da spec 049)

### Origem

A spec 049 criou **localmente no mesas** (Fase E, débito D04 resolvido) componentes que ela mesma marcou como candidatos a `packages/ui`, mas deixou a extração para SDD próprio (G01, `proposta-reorganizacao.md` §4):

| Componente | Local atual (mesas) | Consumidores potenciais |
|---|---|---|
| `GestaoStateWrapper` | `apps/mesas/.../components` | todo app admin (loading/error/empty) |
| `ResultGrid` / `ImportResultGrid` | idem | glossário, site-admin |
| `ConfirmDialog` | idem | todos os apps (confirmação destrutiva) |
| `FileDropzone` | idem | downloads, site |

### Requisitos testáveis (F5)

- **R-F5.1** Confirmar na varredura F0 quais desses (e possíveis outros) têm de fato 2+ consumidores ou são padrão de admin — extrair só os justificados; registrar decisão por componente.
- **R-F5.2** Mover o componente para `packages/ui` com API genérica (props da tabela do §3 da proposta 049), **sem domínio mesas** vazando (nada de tipos/labels específicos de Discord/mesas no pacote).
- **R-F5.3** mesas passa a **importar** de `packages/ui`; cópia local removida no mesmo PR (zero duplicação remanescente).
- **R-F5.4** Reusar nos outros consumidores quando trivial; caso contrário registrar como rollout futuro (sem deixar duplicado o que já foi extraído).
- **R-F5.5** Sem regressão: gestão do mesas (loading/error/empty, grids de import, confirmação destrutiva, upload) funcionando.
- **R-F5.6** `pnpm run lint` + `pnpm run build` verdes; smoke proporcional nos consumidores (compartilhado = SDD Completo).

## F6 — Centralizar schemas Zod cross-app → `packages/content` (G02 da spec 049)

### Origem

Spec 049 §5 listou schemas Zod candidatos a `packages/content`. **Atenção:** D17/D18 da 049 já deduplicaram schemas **dentro** do backend do mesas. F6 trata só o que é **genuinamente cross-app**.

| Schema | Local | Observação |
|---|---|---|
| `updateDraftSchema`/`patchDraftSchema` | mesas backend | já unificado dentro do mesas (D18) — **domínio mesas/Discord**, provavelmente **não** vai para content |
| `discordChatExporterExportSchema` | `chatExporterAdapter.ts` | "já compartilhado, verificar se move" |
| schemas de sugestão (system/scenario) | mesas backend | duplicado entre routers do mesas — avaliar se é mesas-only |

### Requisitos testáveis (F6)

- **R-F6.1** Auditar cada schema: é usado por 2+ apps/pacotes ou é domínio do mesas? Só migra o que é de fato compartilhado. Registrar veredito por schema (mover vs manter local com justificativa).
- **R-F6.2** O que migrar vai para `packages/content` com tipos exportados; consumidores **importam**; definição local removida no mesmo PR.
- **R-F6.3** Não acoplar domínio mesas/Discord em `packages/content` se o schema não for realmente genérico — preferir manter local a poluir o pacote compartilhado.
- **R-F6.4** `pnpm run lint` + `pnpm run build` verdes; testes dos backends afetados verdes.

## F0 — Varredura de duplicação (discovery, antes de extrair)

### Requisitos testáveis (F0)

- **R-F0.1** Rodar varredura de duplicação (`jscpd`/`rg`/`ast-grep`) focada em: componentes React quase idênticos entre apps; schemas Zod repetidos; helpers de UI/estado repetidos. Não limitar à lista já conhecida (changelog, gestão).
- **R-F0.2** Produzir um mapa curto (no fechamento/sessão) classificando cada achado: **extrair agora** (entra em F4/F5/F6), **manter local** (com motivo), ou **rollout futuro** (débito registrado).
- **R-F0.3** O resultado de F0 **define o escopo final** de F4/F5/F6 antes de qualquer extração — evita extrair pela metade e retrabalhar.
- **R-F0.4** Achados que não couberem nesta spec viram débito acionável (em `specs/backlog.md`), não somem no chat.

## Fora de escopo

- Reescrever o `ChangelogModal` ou trocar a stack de modal.
- Refatorar a nav/header além do necessário para o marcador.
- Dark-readiness de apps que ainda não têm dark CSS (specs próprias).
- Qualquer deploy/promote (gated por aprovação nominal, fora desta fase de planejamento).

## Critério de conclusão da spec (quando for implementada)

R-F0.* a R-F6.* satisfeitos; `pnpm run lint` + `pnpm run build` verdes; validação visual registrada; **zero duplicação remanescente** do que foi extraído; G01/G02 da spec 049 marcados executados; `specs/backlog.md` + `project-state.md` atualizados; DEB-050-02 fechado aqui.

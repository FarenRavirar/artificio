# 051 — debitos.md

> **Começa zerado.** Débito = só o que **aparecer durante a implementação** (bug colateral, regressão, achado inesperado, divergência). O trabalho planejado das frentes F1–F4 vive em `spec.md`/`tasks.md`, não aqui.
>
> Formato ao registrar: `DEB-051-NN | origem | estado | evidência | escopo | próximo passo`.

- **2026-06-25 — Onda A concluída.** F4, F5 e F1 implementados com lint+build verdes. Ondas C/D pendentes.

---

## DEB-051-01 — ConfirmDialog extraído mas não adotado no site-admin (parte órfã)

- **Origem:** Onda A spec 051 (F5.2a). Cross-ref backlog `BL-051-CONFIRMDIALOG-SITEADMIN-ROLLOUT`.
- **Estado:** **fechado (2026-06-26).** **Severidade: baixa-média.**
- **Evidência:** `ConfirmProvider`/`useConfirm` extraídos p/ `packages/ui`; mesas + glossario migrados. Mas `apps/site-admin` mantém **4 `window.confirm` crus** — todos ações destrutivas/irreversíveis:
  - `apps/site-admin/src/pages/PostsList.tsx:50` ("Apagar permanentemente")
  - `apps/site-admin/src/pages/PagesList.tsx:44` ("Apagar permanentemente")
  - `apps/site-admin/src/pages/FeedbackPage.tsx:46` ("Excluir definitivamente")
  - `apps/site-admin/src/media/MediaLibrary.tsx:40` ("Apagar")
- **Causa de não ter migrado junto:** `site-admin` não depende de `@artificio/ui` (ausente no `package.json`). Adicionar a dep puxa React/UI p/ o bundle → exige smoke de bundle próprio. Por isso virou rollout separado, não migração na Onda A.

### Riscos de qualidade de código

1. **Inconsistência de UX/marca (concreto):** `window.confirm` é popup nativo do SO — sem identidade Artifício, sem tema lua/sol. Admin que circula entre apps vê 2 padrões de confirmação destrutiva. Fere o design system (marca vem de `packages/ui`, pétrea).
2. **Acessibilidade desigual:** dialog compartilhado tem focus trap, `role=alertdialog`, ESC/Enter, restauração de foco; `window.confirm` depende da a11y do browser. Pior: as 4 são ações **irreversíveis** — justo onde prevenção de erro (Nielsen H5) mais importa.
3. **Divergência crescente (débito que apodrece):** estado "extraído mas não adotado em toda parte" = fonte única **e** cópia velha coexistem. Risco real = próximo dev do site-admin copiar o `window.confirm` vizinho em vez do shared → débito cresce. Mitigado por estar rastreado.
4. **Falsa conclusão:** F5.2a parece 100% mas 1 dos 3 apps-alvo ficou fora. **Por isso F5.2a deve ser marcada "parcial — site-admin pendente" no fechamento da spec, não total.**

### Mitigadores (por que é débito aceitável, não bug)
- Funcionalmente OK: `window.confirm` ainda bloqueia ação destrutiva. Falha de padrão, não de função. Não é segurança nem perda de dado.
- Escopo isolado e conhecido: 4 call-sites, 1 app, listados acima.
- Custo do fix não-trivial (dep nova + bundle smoke) justifica adiar.

- **Fechamento (2026-06-26):** 6 tasks executadas via DeepSeek (T-DEB01.1–T-DEB01.6). `@artificio/ui` adicionado como dep, CSS importado antes do `styles.css`, `<ConfirmProvider>` no root, 4 `window.confirm` → `await confirm({...})`. 8 arquivos, +50/-5 linhas. Lint 15/15 ✅, build ✅. `BL-051-CONFIRMDIALOG-SITEADMIN-ROLLOUT` fechado no backlog. F5.2a agora **total** (3/3 apps migrados: mesas, glossario, site-admin).

### Achado da investigação (2026-06-26) — colisão de tokens de tema

`site-admin` é **light** (`body { background:#f6f7fb; color:var(--ink) }`) e define no próprio `:root` (`apps/site-admin/src/styles.css`) tokens com **nomes iguais** aos do `@artificio/ui`, porém significado/valor diferentes:

| token | site-admin | @artificio/ui `:root` | colisão real? |
|---|---|---|---|
| `--surface` | `#1b2a4a` (navy) | `var(--artificio-light-surface)` | **Não** — `--surface` é **definido mas nunca consumido** (`var(--surface)`) no site-admin. Pode até ser removido. |
| `--line` | `#e3e6ef` (cinza claro) | `rgba(2,7,64,0.14)` (navy claro) | **Sim** — `--line` usado **12×** no site-admin (`styles.css` ×11 + `FeedbackPage.tsx:93` inline). Ambos são bordas claras → visualmente compatíveis, mas o vencedor depende da **ordem de import**. |

`ui/styles.css` traz o conjunto completo de tokens em `:root` (light default) + override `[data-theme="dark"]`. Os tokens que o `ConfirmDialog` consome: `--surface`, `--fg`, `--fg-muted`, `--fill`, `--line`, `--state-{danger,warning,info}-{bg,fg}`, `--artificio-brand`, `--artificio-brand-deep`, `--artificio-danger-text`. **site-admin não define** `--fg/--fill/--state-*/--artificio-*` → virão do `ui/:root` (corretos). Só `--line` é compartilhado e ambos claros.

**Decisão de tema:** site-admin é light e fica light. NÃO setar `data-theme="dark"` — o `ConfirmDialog` renderiza no tema claro do `ui/:root`, casando com o admin claro.

<details><summary>📋 Plano de implementação (executado 2026-06-26 — mantido como registro)</summary>

**T-DEB01.1 — dependência** ✅
- Adicionar em `apps/site-admin/package.json` → `dependencies`: `"@artificio/ui": "workspace:*"` (ordem alfabética).

**T-DEB01.2 — CSS (resolver colisão por ordem de import)** ✅
- Em `apps/site-admin/src/main.tsx`, importar `@artificio/ui/styles.css` **ANTES** de `./styles.css`.
- Removido `--surface: #1b2a4a;` morto do `styles.css` (bônus, não obrigatório).

**T-DEB01.3 — provider no root** ✅
- `<ConfirmProvider>` em `App.tsx` envolve `<Routes>`.

**T-DEB01.4 — migrar os 4 `window.confirm`** ✅
- PostsList, PagesList (guarda `a.del` preservada), FeedbackPage, MediaLibrary.
- Todos `variant:'danger'`, títulos/messages/confirmText conforme tabela abaixo.

**T-DEB01.5 — validação** ✅
- `pnpm run lint` 15/15 ✅. `pnpm --filter @artificio/site-admin run build` ✅.
- Smoke visual/bundle: pendente (requer dev server/browser — ressalva não-bloqueante).

**T-DEB01.6 — fechamento** ✅
- DEB-051-01 + BL-051-CONFIRMDIALOG-SITEADMIN-ROLLOUT fechados. F5.2a total (3/3 apps).

| arquivo | título | message | confirmText |
|---|---|---|---|
| `PostsList.tsx` | `Apagar post` | `Apagar permanentemente "${p.title}"? Esta ação não pode ser desfeita.` | `Apagar` |
| `PagesList.tsx` | `Apagar página` | `Apagar permanentemente "${p.title}"? Esta ação não pode ser desfeita.` | `Apagar` |
| `FeedbackPage.tsx` | `Excluir feedback` | `Excluir "${it.title}" definitivamente?` | `Excluir` |
| `MediaLibrary.tsx` | `Apagar mídia` | `Apagar "${it.title \|\| it.url}"? Referências no conteúdo (por URL) não são removidas.` | `Apagar` |

</details>

---

## DEB-051-RABBIT-04 — CLASS sem validação de domínio em apply_required_migrations.sh

- **Origem:** REV-051-RABBIT-04 (CodeRabbit no PR #96, 2026-06-26). Commit `971bc3f`.
- **Estado:** **fechado (2026-06-26).** **Severidade: média.**
- **Evidência:** `scripts/deploy/apply_required_migrations.sh:+45-48` — `load_header_vars` valida `CLASS` só com `-z` (vazio). Um typo no header (`-- @artificio/class: online-sfe`) produz `CLASS="online-sfe"` — não vazio, mas inválido. `validate_sql_against_class` só age para `online-safe`; outras classes passam silenciosamente e a migration é auto-aplicada em vez de ir para `MANUAL_PENDING`.
- **Risco:** migration com header digitado errado pode ser aplicada sem revisão manual. Nenhum typo conhecido hoje.
- **Correção:** allowlist explícita fail-closed em `load_header_vars` — `CLASS` fora de `{online-safe, manual-risk}` → `::error::` + `return 1`. Domínio real corrigido (o fix proposto pelo bot citava `offline-safe/requires-backup`, classes inexistentes; o header só aceita `online-safe|manual-risk`, ver `parse_header` em `lib_migrations.sh:24`). shellcheck ✅, `test_migration_guard.sh` 39/39 ✅. Ver reviews.md §11.

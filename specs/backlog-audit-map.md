# Mapa de Auditoria de Débitos e Tarefas — Artifício RPG

> **View consolidada para visualização rápida.** A fonte **canônica** é [`specs/backlog.md`](backlog.md); este arquivo é um resumo derivado — manter em sync ao fechar/abrir débitos.
> Criado 2026-06-16 (Gemini); revisado/corrigido 2026-06-17.
>
> ⚠️ **SHAs e reescrita de histórico:** o repo foi tornado público com **reescrita de histórico** para evitar vazamento (ver memória `repo-public-history-rewrite`). Commits antigos podem **não existir mais**. **NUNCA reabrir uma task só porque um SHA não existe** — verificar pelo **estado atual** (código em `origin/main`, container/healthcheck na VM, smoke HTTP). Um SHA ausente = histórico reescrito, não trabalho desfeito.

## 🗺️ Débitos e tarefas

| Referência (canônica) | Tipo | Status | Evidência / Estado atual | Ação |
| :--- | :--- | :--- | :--- | :--- |
| `BL-CDX-310` (Spec 026 F5) | Infra | ✅ Fechado (prod) | deploy run `27656716758` verde; accounts via `_deploy-module` do clone git, healthcheck `healthy`, snowflake aposentado | — |
| Spec 009 **T10 / R6** | Infra | ✅ Feito (live) | R6 presente em `origin/main` (`apps/site/docker-entrypoint.sh`, commit `c2aaae9` pós-reescrita) | confirmar se site foi redeployado com R6 |
| `BL-INFRA-CI-EFFICIENCY-F11` | Infra | 🟡 Local | cache pnpm/turbo NÃO está em `origin/main` ainda | commit/push + provar CI quente mais rápido |
| `BL-QA-MESAS-PERF` (Spec 025) | Qualidade | 🟡 Dirty (local) | lazy-load `App.tsx`/`FeedbackModal` no working tree, não commitado | abrir PR p/ dev + deploy beta + Lighthouse mesasbeta |
| `BL-INFRA-DEFAULT-BRANCH` | Infra | ⚪ Aberto | débito novo 2026-06-16 | tornar `dev` o default; verificar/corrigir workflows (refs main/dev, invariante, cron) antes |
| `BL-ACCOUNTS-PORT` (Spec 026 F6) | Infra | ⚪ Aberto | accounts ainda publica `ports:3000:3000` | trocar por `expose`; smoke SSO |
| `BL-MESAS-AUTO-ARCHIVE-CF` (F7) | Infra | ⚪ Aberto | cron 403 Cloudflare challenge antes da API | caminho interno seguro ou bypass WAF nomeado |
| `D-DEP2` (Spec 026 F8) | Infra | ⚪ Aberto | toolchain | atualizar apt/Node/pnpm/imagens base (janela + backup VM) |
| `D-DEP1`/`BL-MESAS-EXPRESS5-016` (F9) | App | ⚪ Aberto | Spec 016 | migrar backends p/ Express 5 sem big-bang |
| `BL-INFRA-GHCR-F12` | Infra | ⚪ Aberto | Spec 026 F12 | build em CI → push GHCR → VM `pull` (tira `--no-cache` da VM) |
| `BL-INFRA-SEC-SCAN` | Infra | ✅ Mergeado (PR #40) | scans nativos em `dev`/`main` (`4c8128a`) | resíduos: `BL-CI-ESLINT-FLAT-CONFIG` |
| `BL-CI-ESLINT-FLAT-CONFIG` | Infra | ⚪ Aberto | `pnpm lint` quebra (ESLint 9 sem flat config); lint advisory no `ci.yml` | criar `eslint.config.js` flat (PR) + remover `continue-on-error` |
| `BL-BETA-HYDRATE` (Spec 005) | Infra | 🔴 Bloqueado | falta `PROD_DB_URL` no mesasbeta | mantenedor fornece segredo + restart/deploy |
| `BL-SHELL-B13` / `D-SHELL1` | UI | ⚪ Aberto | nav/footer: fonte de dados feita; resíduo Astro/accounts | unificar shell restante |
| `BL-UI-PRIMITIVES` (Spec 020 B3/B4) | UI | ⚪ Aberto | primitives no core; falta consumidor | piloto em `site-admin`/apps |
| Spec 022 (rollout vars semânticas) | UI | ⚪ Aberto | tokens prontos | aplicar em telas do mesas (catálogo/painel/forms) |
| Spec 011 F3–F5 | App | ⚪ Aberto | CMS site | dashboard, curadoria, agendamento, moderação de comentários |
| `BL-LINKS-013` | App | 🔴 Bloqueado | sem GitHub | localizar código de `links.`/`servidorvirtual.` ou aprovar rebuild |
| `BL-DEP-MESAS-LEGACY-SCRIPTS` | Infra | ⚪ Aberto | `apps/mesas/scripts/deploy/*` morto no monorepo | fatia mesas: arquivar + limpar refs em docs |
| Spec 001 T4/T6/T7/T13 | Infra | ⚪ Aberto | backup WP final, órfãos, rotação de secrets, teste de restore | pós-fase 3 / mantenedor |

Legenda: ✅ feito · 🟡 local/parcial/pausado · 🔴 bloqueado · ⚪ aberto.

---

## 🔍 Direção e pivôs (resumo)

1. **Infra (Spec 026):** esteira unificada (manifesto + matrix); `accounts` (F5) entrou e está em prod. Próximos: F6 (expose), F7 (cron CF), F12 (build CI→GHCR).
2. **Site (Spec 011):** CMS pivotou de "paridade total" para "MVP operacional primeiro". Fases 3–5 = maior volume de app pendente. Site ainda só em beta (Gate C adiado).
3. **UI (Spec 020/022):** migração de cor via **vars semânticas**; débito = rollout nas telas do mesas.
4. **Qualidade (Spec 025):** foco em baseline + CLS/bundle; imagens Cloudinary em hold por custo/risco.

---

## 🚩 Bloqueios / decisões pendentes

- **`BL-BETA-HYDRATE`**: sem `PROD_DB_URL` no mesasbeta, não dá p/ testar perf real com volume de prod (segredo/write VM = mantenedor).
- **`BL-INFRA-DEFAULT-BRANCH`**: trocar default p/ `dev` exige auditar workflows antes (não quebrar resolução de env/cron/invariante).
- **`BL-LINKS-013`**: código de `links.` não está no GitHub — localizar ou rebuild.

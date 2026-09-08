# 045 — Débitos pendentes em limbo (deploy / aprovação / limpeza)

- **Módulo/Pacote:** transversal — `apps/accounts`, `apps/links`, `.github/workflows`, `.gitignore`, governança/backlog
- **Gate relacionado:** Gate D (links/accounts em prod); nenhum Gate novo
- **Status:** aberto (investigação concluída 2026-06-22; aguarda aprovação para executar resíduos)
- **Sessão:** `sessoes/26-06-22_8_debitos-pendentes-deploy.md`
- **Investigação:** `investigacao.md` (evidência por débito)
- **Tasks:** `tasks.md`

## Problema

Cinco débitos foram listados pelo mantenedor como "🟡 Local / código pronto", todos travados em deploy, aprovação nominal ou limpeza mecânica:

| ID original | Snapshot do mantenedor |
|---|---|
| `BL-ACCOUNTS-PORT` | T1-T4 OK · falta deploy prod (`expose:["3000"]`) |
| `BL-LINKS-MEDIA-038` | T1-T11 mergeado · falta T12 nav + T13 smoke + reidratar prod |
| `BL-LINKS-GROUP-LOGOS` | código pronto · T4 reidratar prod (13 logos null) |
| `BL-BUILD-CACHE-PRUNE-ALL` | código pronto · trocar `--all` em 2 arquivos |
| `BL-033-SECRET-BLOCK` | incidente OK · trocar `.gitignore` + destrackear 16 arquivos |

A spec investiga cada um **no código e em prod (read-only)** antes de planejar, porque o backlog é um snapshot e pode estar desatualizado. **Achado central: 3 dos 5 já estão resolvidos ou quase-resolvidos em produção** — só 2 são trabalho real claramente pendente, mais resíduos pequenos. Detalhe e evidência em `investigacao.md`.

## Resultado da investigação (resumo)

| Débito | Estado real verificado (2026-06-22) | Trabalho restante |
|---|---|---|
| `BL-BUILD-CACHE-PRUNE-ALL` | **RESOLVIDO.** `docker builder prune --all -f` já em `_deploy-module.yml:502` e `docker-cleanup.yml:159`; commit `bfa98be`, ancestral de `origin/dev` E `origin/main` (prod). | Só fechar no backlog (stale). |
| `BL-LINKS-NAV-CROSSAPP` (T12) | **RESOLVIDO.** Nav "WhatsApps"/`links.artificiorpg.com` servido em site (raiz, Astro), glossário e mesas (bundle JS). accounts não renderiza nav cross-app por design (`main.tsx` importa só logo/tema). | Só fechar no backlog. |
| `BL-LINKS-GROUP-LOGOS` (T4) | **QUASE.** 13 grupos em prod: **12 com logo Cloudinary**, 1 null = "Canal de Notícias" (canal WhatsApp). Reidratação já rodou. | Decidir/reidratar o canal; fechar. |
| `BL-ACCOUNTS-PORT` (T5) | **PENDENTE real.** `expose:["3000"]` aplicado em ambos os composes; falta deploy prod + smoke. | Deploy accounts prod (aprovação nominal). |
| `BL-033-SECRET-BLOCK` | **PENDENTE real.** `.gitignore:45` ainda `artifacts/lighthouse/`; 16 arquivos trackeados sob `artifacts/`. | Trocar `.gitignore` + `git rm --cached` (SDD Lite, branch+PR). |
| `BL-LINKS-MEDIA-038` (T13) | Resíduo. Código mergeado (PR #78); falta smoke E2E final em prod. | Smoke E2E + fechar guarda-chuva. |

## Requisitos

- **R1:** Cada débito tem veredicto com evidência (arquivo:linha, run, curl, commit) em `investigacao.md`. Nada de "parece resolvido" sem prova.
- **R2:** `BL-033-SECRET-BLOCK` — `.gitignore` ignora `artifacts/` (não só `artifacts/lighthouse/`) + os 16 arquivos saem do índice (`git rm --cached`), conteúdo permanece no disco. SDD Lite, branch+PR.
- **R3:** `BL-ACCOUNTS-PORT` — accounts deploya em prod com `expose:["3000"]`; smoke `/health`=200, `/login`=200, `/api/auth/me`=401. Aprovação nominal por deploy.
- **R4:** `BL-LINKS-GROUP-LOGOS` — decidir o destino do logo null de "Canal de Notícias": reidratar se og:image existir, ou aceitar null como degradação legítima (placeholder) e documentar.
- **R5:** `BL-LINKS-MEDIA-038` — smoke E2E em prod (logos, report ponta-a-ponta, cron VM ativo, nav propagado) e fechamento do guarda-chuva 038.
- **R6:** Reconciliação de backlog/`project-state.md`: fechar `BL-BUILD-CACHE-PRUNE-ALL` e `BL-LINKS-NAV-CROSSAPP` com evidência; atualizar status dos demais. Nenhum registro apagado sem justificativa (regra append/evidência).

## Critérios de aceite

- `investigacao.md` com veredicto + evidência dos 5 débitos.
- `.gitignore` ignora `artifacts/`; `git ls-files artifacts/` = 0 (após T executada e mergeada).
- accounts prod: smoke 200/200/401 registrado.
- links prod: `curl /api/groups` sem `logo_url:null` indevido (ou null documentado como legítimo); report E2E ok.
- backlog + `project-state.md` reconciliados com evidência; débitos resolvidos marcados fechados.

## Fora de escopo

- Otimização de imagem/Cloudinary além da reidratação dos grupos existentes.
- `BL-INFRA-GHCR-F12` (build em CI→GHCR) e `BL-DEPLOY-SSH-KEEPALIVE` (spec 040) — deploy hardening próprio, não entram aqui.
- Qualquer cutover de raiz / Gate C / WordPress.
- Mudar comportamento do nav do accounts (decisão de produto separada, se um dia precisar).

## Notas de governança

- Tudo que envolve `git commit`/`push`/PR/deploy/write na VM = **aprovação nominal por ação** (não acumula). Esta etapa é só investigação + documentação.
- `dev` tem branch protection: tudo via branch + PR + check `lint + build + test`. Promoção `dev→main` por fast-forward.
- Itens já em prod (cache prune, nav) só precisam de fechamento documental — não há código a mexer.

# Tasks — 045 (débitos pendentes em limbo)

> **SDD Lite por fatia** (cada débito é isolado). Tudo que muda lógica/infra entra por **branch + PR** (`git switch -c <tipo>/045-<slice>` → push → `gh pr create --base dev`). `dev` tem branch protection: push direto **falha**; PR exige check `lint + build + test` verde. Promoção `dev→main` por fast-forward.
> **Commit/push/PR/deploy/write-VM = aprovação nominal por ação (não acumula).**
> Esta spec foi escrita em etapa de **investigação/documentação**: nenhuma task abaixo foi executada ainda. Ver `investigacao.md` para evidência.

---

## CONTEXTO PARA AGENTE FRIO

**T0 obrigatório:** `project-state.md` + `context-capsule.md` + `decisions.md`. Depois `spec.md` + `investigacao.md` desta spec.

Origem: 5 débitos listados como "🟡 Local". Investigação (2026-06-22) provou que **3 já estão resolvidos/quase em prod**; só 2 são trabalho real claro. Não re-investigar do zero — a evidência está em `investigacao.md`.

---

## T1 — BL-033-SECRET-BLOCK: `.gitignore` + destrackear (PENDENTE, mecânico)

- [x] Trocar em `.gitignore` `artifacts/lighthouse/` → `artifacts/`. · ✅ aplicado local 2026-06-22.
- [x] `git rm --cached` nos 16 arquivos trackeados sob `artifacts/` (conteúdo permanece no disco):
  - 15 em `artifacts/033/*` + 1 `artifacts/cloudinary/inventory-2026-06-17T14-21-49-005Z.json`. · ✅ feito (16 `rm --cached`).
- [x] Validar: `git ls-files artifacts/` → **0** ✅; conteúdo no disco intacto (34 arquivos em `artifacts/033/`). `git status`: `.gitignore` M + 16 deletions no índice.
- **Aceite:** `git ls-files artifacts/` vazio após merge. Conteúdo no disco intacto. · **LOCAL ✅; falta commit+branch+PR (aprovação nominal).**
- **Tipo:** SDD Lite, branch `chore/045-gitignore-artifacts` + PR. Commit/push = aprovação nominal.
- **Risco:** baixo. Não toca runtime. Confirma que nenhum dos 16 é secret ativo (o dump perigoso já saiu do histórico — E007).

## T2 — BL-ACCOUNTS-PORT (spec 035 T5): deploy accounts prod + smoke (PENDENTE, deploy)

- [ ] Código já pronto (`expose:["3000"]` nos dois composes — `investigacao.md` §4). **Nada a editar.**
- [ ] Deploy: `gh workflow run deploy --ref dev -f module=accounts -f mode=deploy -f env=prod`. **Aprovação nominal por deploy.**
- [ ] Smoke (read-only pós-deploy): `/health`=200, `/login`=200, `/api/auth/me`=401.
- [ ] Confirmar SSO vivo (auth sagrado): login/me/logout em ao menos 1 app consumidor (D042: beta reusa accounts prod).
- **Aceite:** smoke 200/200/401 + 1 consumidor SSO ok, registrado na sessão. Fechar `BL-ACCOUNTS-PORT`.
- **Risco:** accounts = SSO central PROD-only. Snapshot/rollback do `_deploy-module` armado. Não recriar volume (E009).

## T3 — BL-LINKS-GROUP-LOGOS (spec 038 T4): canal de notícias null (RESÍDUO)

- [ ] 12/13 logos já em prod (`investigacao.md` §3). Único null = "Canal de Notícias" (`kind=channel`).
- [ ] Investigar (read-only): `whatsapp.com/channel/...` serve og:image pelo nosso UA? (testar `fetchOgImage` no invite do canal).
- [ ] Se serve: reidratar (admin "Reidratar imagens" ou `docker exec links-app tsx server/rehydrate-cli.ts --force`, aprovação nominal). Se não serve: aceitar null como degradação legítima (placeholder) e documentar na spec — pipeline degrada gracioso por design.
- **Aceite:** canal com logo Cloudinary OU null documentado como esperado. Fechar `BL-LINKS-GROUP-LOGOS`.
- **Risco:** baixo. WhatsApp é fonte hostil read-only; nunca autenticar/entrar.

## T4 — BL-LINKS-MEDIA-038 (T13): smoke E2E + fechar guarda-chuva (RESÍDUO)

- [ ] Home links com fotos Cloudinary reais — ✅ já observado (12/13).
- [ ] Nav cross-app propagado — ✅ já verificado (site/glossário/mesas; accounts sem nav by design). Ver `investigacao.md` §2.
- [ ] Report ponta-a-ponta em prod: `POST /api/groups/:slug/report` (rate-limit, sanitização) → aparece na fila admin.
- [ ] Cron VM: confirmar crontab instalado — `ssh faren 'crontab -l'` deve conter `... docker exec links-app tsx server/rehydrate-cli.ts ...` (read-only). Se ausente, registrar como pendência de instalação (write VM = aprovação).
- **Aceite:** evidência (curls/runs) na sessão; fechar `BL-LINKS-MEDIA-038`.

## T5 — Reconciliação de backlog + project-state (DOCUMENTAL)

- [ ] Fechar `BL-BUILD-CACHE-PRUNE-ALL` com evidência (commit `bfa98be`, ancestral de origin/main — `investigacao.md` §1). Corrigir as linhas stale 494/159 → 502/159 na nota de fechamento.
- [ ] Fechar `BL-LINKS-NAV-CROSSAPP` com evidência (nav em prod; accounts sem nav by design — §2).
- [ ] Atualizar `BL-LINKS-GROUP-LOGOS` (12/13), `BL-LINKS-MEDIA-038`, `BL-ACCOUNTS-PORT` conforme T2-T4.
- [ ] Refletir em `project-state.md` "Próximo passo" (itens 2/4 da lista atual = spec 038 T4/T13).
- [ ] **Não apagar registro sem justificativa** (regra append/evidência). Doc-only entra em `dev` por branch+PR (D073).
- **Aceite:** backlog sem débito falso-aberto; cada fechamento com origem rastreável.

---

### Ordem sugerida
T5 (fechar os 2 resolvidos) pode ir primeiro — é documental e destrava ruído. T1 (mecânico) independe de aprovação de deploy. T2 (deploy accounts) e T3/T4 (links) exigem aprovação nominal e podem agrupar num PR por app. Nenhuma task bloqueia outra.

### Notas de governança
- Itens "resolvidos" (cache prune, nav) **não têm código a mexer** — só fechamento documental.
- Deploy/commit/push/PR/write-VM sempre pedem aprovação nominal própria, a cada vez.
- Auth (accounts) é sagrado: smoke SSO obrigatório no T2.

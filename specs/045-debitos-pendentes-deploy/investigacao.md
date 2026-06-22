# Investigação — 045 (débitos pendentes em limbo)

> Veredicto + evidência por débito. Investigação read-only em código + prod (2026-06-22).
> Regra: nada de "parece resolvido" sem prova (arquivo:linha, run, curl, commit).

---

## 1. BL-BUILD-CACHE-PRUNE-ALL → **RESOLVIDO (backlog stale)**

**Snapshot do mantenedor:** "trocar `--all` em 2 arquivos (`_deploy-module.yml:494` + `docker-cleanup.yml:159`)".

**Evidência:**
- `git grep "builder prune"`:
  - `.github/workflows/_deploy-module.yml:502` → `docker builder prune --all -f`
  - `.github/workflows/docker-cleanup.yml:159` → `docker builder prune --all -f` (comentário em :152)
- O `--all` já está aplicado nos dois. As linhas do backlog (494/159) estão desatualizadas (real: 502/159).
- `git log -S "builder prune --all" -- .github/workflows/_deploy-module.yml` → commit `bfa98be` (2026-06-20 22:46, "fix(037): pnpm --prod nao instala deps de workspace — corrige cloudinary"). A troca pegou carona nesse commit.
- `git merge-base --is-ancestor bfa98be origin/dev` → **YES**; `... origin/main` → **YES**. Ou seja: **já está em produção** (main).

**Veredicto:** trabalho já feito e deployado. Backlog lista como "aberto" indevidamente. → **fechar no backlog com esta evidência.** Zero código a mexer.

---

## 2. BL-LINKS-NAV-CROSSAPP (spec 038 T12) → **RESOLVIDO**

**Snapshot:** "T12 nav cross-app — `modules.ts` lista 'WhatsApps' mas apps em prod servem nav sem ele (curl glossario/site = 0)".

**Evidência (curl read-only via `ssh faren`):**
- `packages/ui/src/modules.ts:15` → `{ label: "WhatsApps", href: "https://links.artificiorpg.com" }` presente em `defaultNavItems`.
- site (raiz, Astro): `curl https://artificiorpg.com/` → `links.artificiorpg.com` presente + `WhatsApps` (grep -c = 1). ✅ (atenção: site vive na **raiz**, não em `site.artificiorpg.com` — medição anterior do backlog usou host errado.)
- glossário (SPA React): bundle `/assets/index-BAon2UPM.js` → `links.artificiorpg.com` ref = 1. ✅
- mesas (SPA React): bundle `/assets/index-C5rxnGaz.js` → ref = 1. ✅
- accounts (SPA React): bundle `/assets/index-BNXiJDyl.js` → ref = 0. ❌ — **mas por design:** `apps/accounts/frontend/src/main.tsx:3` importa de `@artificio/ui` só `brandLogoNavy, brandLogoNeg, applyFavicon, ThemeIcon, useTheme`. **Não** importa `Header`/`defaultNavItems`. accounts é a tela de login SSO com chrome mínimo (logo + tema), não renderiza nav cross-app.

**Caveat de medição:** grep de `curl /` para SPA é falso-negativo — o nav vem no bundle JS, não no HTML inicial. Por isso a medição original do backlog (glossario/site=0) estava errada para SPA + host errado do site.

**Veredicto:** nav propagado em todos os apps que têm nav (site/glossário/mesas). accounts não tem nav por design → não é alvo. → **fechar BL-LINKS-NAV-CROSSAPP.**

---

## 3. BL-LINKS-GROUP-LOGOS (spec 038 T4) → **QUASE RESOLVIDO (12/13)**

**Snapshot:** "13 grupos com `logo_url: null`; reidratar em prod".

**Evidência (`curl https://links.artificiorpg.com/api/groups`, read-only):**
- 13 grupos no total (`grep -o '"id":' | wc -l` = 13).
- `logo_url:null` = **1**.
- `res.cloudinary.com/dnln0btbo/.../artificio/links/...` = **12**.
- Grupo null = `"Canal de Notícias"` (é um **canal** do WhatsApp, `kind=channel`, não grupo). Ex. de logo resolvido: "Mundo Artifício RPG" → `.../v1782019856/artificio/links/b9b5d9f2...jpg`.

**Interpretação:** a pipeline de reidratação (T1-T3, `rehydrate-logos.ts`/`rehydrate-cli.ts`) **já rodou em prod** — 12 dos 13 têm logo Cloudinary. O único null é o canal de notícias, cujo og:image pode não estar disponível pelo mesmo caminho de grupo (`whatsapp.com/channel`), ou degradou gracioso (comportamento esperado da pipeline: logo null → placeholder, nunca trava).

**Veredicto:** débito ~92% resolvido em prod. Resta **decidir o canal**: investigar se `whatsapp.com/channel` serve og:image; se sim, reidratar; se não, aceitar null como legítimo e documentar (degradação prevista). → task R4.

---

## 4. BL-ACCOUNTS-PORT (spec 035 T5) → **PENDENTE real (deploy)**

**Snapshot:** "T1-T4 OK; falta deploy prod (`expose:["3000"]`)".

**Evidência (código):**
- `apps/accounts/docker-compose.yml:35-36` → `expose: ["3000"]` (sem `ports:` host mapping). ✅
- `apps/accounts/docker-compose.prod.yml:61-62` → `expose: ["3000"]` + comentário (`docker-compose.prod.yml:12`) explicando a troca (spec 035, Tunnel usa Docker DNS `accounts-api:3000`). ✅
- Healthcheck presente no compose prod (`:63-68`).

**Estado em prod:** não verificável a fundo só por curl externo (a porta host não é exposta de qualquer forma — esse é o ponto). Precisa de deploy real + smoke interno.

**Veredicto:** código pronto (T1-T4). Falta **T5: deploy accounts prod + smoke** `/health`=200, `/login`=200, `/api/auth/me`=401. Exige **aprovação nominal** (deploy = write na VM). → task R3.

**Risco:** accounts é PROD-only e SSO central (D042) — auth é sagrado. Deploy precisa snapshot/rollback armado (já no `_deploy-module`). Smoke obrigatório.

---

## 5. BL-033-SECRET-BLOCK → **PENDENTE real (limpeza mecânica)**

**Snapshot:** "incidente OK; trocar `.gitignore` `artifacts/lighthouse/` → `artifacts/` + destrackear 16 arquivos".

**Evidência:**
- `.gitignore:45` → `artifacts/lighthouse/` (só lighthouse ignorado; resto de `artifacts/` é trackeável).
- `git ls-files artifacts/` = **16 arquivos** trackeados:
  - 15 em `artifacts/033/` (configs glossário, locks pnpm pré-033, dep-lists, docker-images/ps pré-f5).
  - 1 em `artifacts/cloudinary/inventory-2026-06-17...json`.
- Incidente original (push `chore/033-f4b-majors` rejeitado por `artifacts/033/pre-f3-mesas-beta-dump.sql`) já encerrado: dump removido do histórico, E007 em `errors.md`.

**Veredicto:** trabalho mecânico real e pendente. Ação: `.gitignore` `artifacts/lighthouse/` → `artifacts/` + `git rm --cached` nos 16 (conteúdo fica no disco). SDD Lite, branch+PR. → task R2.

**Por que importa:** evita que artefatos de build/dump entrem no índice por engano de novo (prevenção do incidente E007). Atualmente esses 16 são ruído versionado, não secret ativo (o dump perigoso já saiu).

---

## 6. BL-LINKS-MEDIA-038 (guarda-chuva, T13) → **RESÍDUO (smoke)**

**Evidência:** spec 038 `tasks.md` — T1-T11 mergeados via PR #78 (confirmado em `project-state.md` e backlog). T4/T12 cobertos pelos itens 2 e 3 acima (em prod). Resta **T13: smoke E2E final** (home com fotos Cloudinary reais ✅ já observado; report ponta-a-ponta; cron VM ativo; nav ✅) + fechar o guarda-chuva.

**Veredicto:** fechar após smoke E2E (report + cron) — ver task R5. Cron foi decidido via crontab da VM (`0 6 * * 0 docker exec links-app tsx server/rehydrate-cli.ts`), precisa confirmar que está instalado na VM (read-only: `ssh faren 'crontab -l'`).

---

## Conclusão geral

| Débito | Veredicto | Próximo passo |
|---|---|---|
| BL-BUILD-CACHE-PRUNE-ALL | resolvido (prod) | fechar backlog (R6) |
| BL-LINKS-NAV-CROSSAPP | resolvido (prod) | fechar backlog (R6) |
| BL-LINKS-GROUP-LOGOS | 12/13 (prod) | decidir canal null (R4) |
| BL-ACCOUNTS-PORT | pendente | deploy+smoke (R3, aprovação) |
| BL-033-SECRET-BLOCK | pendente | gitignore+untrack (R2) |
| BL-LINKS-MEDIA-038 (T13) | resíduo | smoke E2E + fechar (R5) |

**2 trabalhos reais** (BL-033 limpeza + BL-ACCOUNTS-PORT deploy) + **2 resíduos pequenos** (canal logo + smoke E2E) + **2 fechamentos documentais** (cache prune + nav). O snapshot do backlog estava majoritariamente stale.

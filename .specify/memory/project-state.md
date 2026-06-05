# Estado do Projeto — Artifício G1

> Atualizar a cada mudança de estado operacional. Fonte de verdade do "onde estamos".

## Fase atual
**Fase 2 — monorepo + SSO ✅ Gate B APROVADO (D037, 2026-06-04).** Fase 1 ✅. `accounts.artificiorpg.com` no ar (SSO Google/JWT), cross-subdomínio provado, CI/CD `deploy-accounts.yml`. CDX-307/D038 design system real em mudanças locais. **CDX-308A+B concluídos localmente; CDX-308C deploy técnico concluído:** `mesas.artificiorpg.com` agora roda build monorepo, usa UI G1, backend valida `artificio_session` via `@artificio/auth`, `JWT_SECRET` igual ao accounts, smoke `200/200/401` e login legado redireciona para `accounts.`. **Falta p/ fechar Gate D:** E2E browser real Google/logout + allowlist prod de `accounts` (D037 local ainda precisa redeploy).

## Gates (ativos: A, B, D · Gate C adiado — D016)
- ✅ **Gate A** — Backups completos/verificados/off-VM. **APROVADO pelo mantenedor 2026-06-04.** Libera Fase 1.
- ✅ **Gate B** — SSO (`accounts.`) no ar + cross-subdomínio provado. **APROVADO pelo mantenedor 2026-06-04 (D037).** Libera import de conteúdo / construir módulos. (Integração de módulo real ao SSO = Gate D.)
- [ ] **Gate D** — (por módulo) smoke → próximo módulo.
- ⏸️ **Gate C (adiado/futuro)** — Site validado em beta → cutover DNS raiz + desligar WP. **Fora do escopo destes ~3 meses.** WP intocável todo o projeto.

## Decisões fechadas
- Monorepo único `artificio` (pnpm + Turborepo).
- **Topologia: subdomínio-por-módulo (D017, supera D002/D015).** Cada módulo no próprio subdomínio (`glossariorpg.`, `mesas.`, `downloads.`, `esferas.`, `srd.`, `links.`), root próprio, sem basename. Blog em `beta.artificiorpg.com` (→ raiz futuro). WP na raiz `artificiorpg.com` (intocável). Cloudflare Tunnel hostname→container.
- **SSO central em `accounts.artificiorpg.com` (D018):** 1 OAuth Google, cookie JWT `Domain=.artificiorpg.com` (vale em todos subdomínios).
- Blog na raiz = aposta SEO (D019). Search Console Domain property + GA4 cross-subdomínio (D020).
- **Blog beta→raiz adiado (D016/Gate C)** — só o blog converge; módulos não. Fora do escopo agora.
- WordPress roda em paralelo; corte DNS só no Gate C.
- CMS: store nativo Postgres + importador WP one-shot (descartável pós-cutover).
- Blog: pré-render estático (SSG) com rebuild incremental disparado pelo admin (não SSR).
- Stack canônica = stack do mesas (React19/Vite/Tailwind + Express/Kysely/PG16/Cloudinary).
- Infra: Oracle 24GB/200GB, Docker, Cloudflare Tunnel, GHCR, Watchtower(beta).
- Backup destino: `C:\projetos\artificiobackup` (local, 300GB livres). uploads WP ≈ 6.34GB.
- Acesso DB da VM via RaiDrive (read-only por padrão).
- Site sobe primeiro como `beta.artificiorpg.com`; demais serviços integram em versão principal.

## Ativos existentes (origem)
- `C:\projetos\mesas_rpg_artificio` — referência de robustez (SDD, Actions, deploy). Repos beta+prod no GitHub.
- `C:\projetos\glossario_rpg_artificio` — glossário. Repos beta+prod no GitHub.
- `links.artificiorpg.com` + `servidorvirtual.artificiorpg.com` — página TS única, **sem GitHub** (backup pendente).
- Site `artificiorpg.com` — WordPress, **sem GitHub**, 300+ posts (backup + import pendente).
- Tradução Spheres of Power (Drop Dead Studios) → módulo `esferas` (`esferas.artificiorpg.com`), multi-sistema D&D 2014/2024 + Pathfinder futuro (D028).
- SRD DnD 5.2.1 (regras 2024) → futuro módulo `srd`.

## Construído neste monorepo
- Governança: `AGENTS.md`, `.specify/memory/{constitution,project-state,errors,decisions}.md`, `.specify/arquiteture.md`, `docs/agents/{operating-model,context-capsule,token-economy}.md`, `.claude/agents/*` (3), `.claude/skills/*` (2), `README.md`, `.gitignore`, `sessoes/index.md`. ✅ coração de governança + economia de contexto fechado.
- Código de aplicação: `packages/{config,auth,ui}`; `apps/accounts` SSO; `apps/mesas` importado do legado (`frontend` + `backend` + DB/scripts/docs), ainda pendente de integração SSO/UI.

## Próximo passo
**Fase 2 CDX-301..306 executados e Gate B aprovado:** monorepo + `packages/{config,auth,ui}` + `apps/accounts` SSO deployado. `accounts-api`/`accounts-db` rodam em `/opt/artificio/accounts` na `artificio_net`; Cloudflare `accounts.artificiorpg.com` smoke 200/200/401; OAuth criou user; `/me` com sessão válida 200; cross-subdomínio via `@artificio/auth verifyToken` OK. **CDX-308A+B+C técnico:** `apps/mesas` importado/buildado/integrado e deployado em `mesas.artificiorpg.com`; smoke técnico OK. **CDX-309B:** PR #1 aberto/verde com CI/CD canonico de modulos; falta Opus revisar fluxo/redundancias antes de merge/Parte C. Próximo: teste browser Google real + logout + allowlist prod para Opus validar Gate D mesas. Pendência segurança (mantenedor trata): rotacionar tunnel token, PAT, WP creds.

## Log
- 2026-06-03 — Plano G1 aprovado em decisões macro. Camada de governança criada (13 arq).
- 2026-06-03 — Coração de economia de contexto: `decisions.md` (append-only), `token-economy.md` (reload T0/T1/T2, caveman default), `arquiteture.md` (contratos por seção). Reload contract em tiers ativo.
- 2026-06-03 — Revisão de consistência vs requisitos. Achada contradição topologia (path único × WP fica × site beta). Resolvida 1ª via D015/D016 (interim híbrido). Gaps menores (páginas não-importáveis→rebuild manual; versão principal=branch main) corrigidos.
- 2026-06-03 — **Virada de topologia (mantenedor):** path único → **subdomínio-por-módulo (D017)**, SSO em `accounts.` (D018), blog na raiz (D019), analytics/SC cross-subdomínio (D020). Supera D002/D015. Dissolve a contradição WP-raiz e a dança de cutover dos módulos. Re-propagado em 11 arquivos. Grep limpo.
- 2026-06-03 — Spec `001-infra-backup-runbook` criada (spec+plan+tasks T1–T13) + sessão `26-06-03_1`. Primeira spec SDD real.
- 2026-06-03 — **T1 executada** via `ssh faren` (D023). Mapa em `docs/agents/infra-map.md`. 4 bancos G1, WP externo, telegram/foundry fora (D021).
- 2026-06-03 — Escopo backup final: **VM only** (WP fora=Hostinger cloud D024; uploads on-demand D025; secrets→`secrets.7z` D026). Criado `access-registry.md`. tasks T3 dropada, T4 diferida p/ Fase 3, T7 = `.env` dos serviços.
- 2026-06-03 — Módulo **`esferas`** (`esferas.artificiorpg.com`), multi-sistema sistema×edição (D&D 2014/2024 principal, PF futuro) — D028. Rename `spheres`/`wiki-sop`→`esferas` em todos os docs.
- 2026-06-04 — **CDX-308A concluído:** legado `C:\projetos\mesas_rpg_artificio` importado para `apps/mesas` sem segredos reais. `pnpm install` OK; `pnpm --filter @artificio/mesas build` OK; frontend tests 13/13; backend tests 104/104 com env dummy local. VM/deploy não tocados.
- 2026-06-04 — **CDX-308B concluído local:** mesas usa `@artificio/ui` + `@artificio/auth`; backend valida `artificio_session`; OAuth local aposentado. Turbo build OK; accounts tests 6/6; auth tests 3/3; mesas frontend 15/15; mesas backend 106/106. VM/deploy não tocados.
- 2026-06-04 — **CDX-308C deploy técnico concluído:** `mesas-api`, `mesas-app`, `mesas-cron` rebuildados na VM com Docker no-cache; `mesas-api` e `mesas-app` healthy; smoke `internal_api=200`, `public_home=200`, `private_no_cookie=401`, `/api/v1/auth/google` → `302 accounts.artificiorpg.com/login`. Falta E2E browser real para fechar Gate D.
- 2026-06-05 — **CDX-309B PR #1 verde:** CI/CD canonico de modulos via GitHub Actions (`_deploy-module`, `deploy-mesas`, lint/enforce migration, break-glass, scripts migration). Amazon Q blockers corrigidos. Deploy job skipped em PR. Sem VM.

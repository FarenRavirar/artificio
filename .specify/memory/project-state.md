# Estado do Projeto — Artifício G1

> Atualizar a cada mudança de estado operacional. Fonte de verdade do "onde estamos".

## Fase atual
**Fase 0 — Governança + Backup.** Gate atual: **pré-A** (nada destrutivo autorizado).

## Gates (ativos: A, B, D · Gate C adiado — D016)
- [ ] **Gate A** — Backups completos/verificados/off-VM → libera recriar instância Oracle.
- [ ] **Gate B** — SSO (`accounts.`) no ar + 1º módulo em subdomínio → libera import de conteúdo / construir módulos.
- [ ] **Gate D** — (por módulo) smoke → próximo módulo.
- ⏸️ **Gate C (adiado/futuro)** — Site validado em beta → cutover DNS raiz + desligar WP. **Fora do escopo destes ~3 meses.** WP intocável todo o projeto.

## Decisões fechadas
- Monorepo único `artificio` (pnpm + Turborepo).
- **Topologia: subdomínio-por-módulo (D017, supera D002/D015).** Cada módulo no próprio subdomínio (`glossariorpg.`, `mesas.`, `downloads.`, `spheres.`, `srd.`, `links.`), root próprio, sem basename. Blog em `beta.artificiorpg.com` (→ raiz futuro). WP na raiz `artificiorpg.com` (intocável). Cloudflare Tunnel hostname→container.
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
- Tradução Spheres of Power 5e (Drop Dead Studios) → futura `wiki-sop`.
- SRD DnD 5.2.1 (regras 2024) → futuro módulo `srd`.

## Construído neste monorepo
- Governança: `AGENTS.md`, `.specify/memory/{constitution,project-state,errors,decisions}.md`, `.specify/arquiteture.md`, `docs/agents/{operating-model,context-capsule,token-economy}.md`, `.claude/agents/*` (3), `.claude/skills/*` (2), `README.md`, `.gitignore`, `sessoes/index.md`. ✅ coração de governança + economia de contexto fechado.
- Código de aplicação: **nada ainda.**

## Próximo passo
Spec de backup criada (`specs/001-infra-backup-runbook/`, sessão `26-06-03_1`). **Caminho do Gate A.** Próximo: executar **T1 (inventário, read-only)** na VM Oracle — descobre containers PG, user/db, volumes, host do WP, tunnel. Depois T2–T8 coleta (com aprovação), T9–T12 verificação, T13 Gate A. Precisa de acesso SSH à VM (ou Claude gera comandos, mantenedor cola).

## Log
- 2026-06-03 — Plano G1 aprovado em decisões macro. Camada de governança criada (13 arq).
- 2026-06-03 — Coração de economia de contexto: `decisions.md` (append-only), `token-economy.md` (reload T0/T1/T2, caveman default), `arquiteture.md` (contratos por seção). Reload contract em tiers ativo.
- 2026-06-03 — Revisão de consistência vs requisitos. Achada contradição topologia (path único × WP fica × site beta). Resolvida 1ª via D015/D016 (interim híbrido). Gaps menores (páginas não-importáveis→rebuild manual; versão principal=branch main) corrigidos.
- 2026-06-03 — **Virada de topologia (mantenedor):** path único → **subdomínio-por-módulo (D017)**, SSO em `accounts.` (D018), blog na raiz (D019), analytics/SC cross-subdomínio (D020). Supera D002/D015. Dissolve a contradição WP-raiz e a dança de cutover dos módulos. Re-propagado em 11 arquivos. Grep limpo.
- 2026-06-03 — Spec `001-infra-backup-runbook` criada (spec+plan+tasks T1–T13) + sessão `26-06-03_1`. Primeira spec SDD real. Caminho do Gate A. Aguarda execução T1.

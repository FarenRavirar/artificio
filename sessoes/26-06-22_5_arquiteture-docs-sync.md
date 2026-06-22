# 26-06-22_5_arquiteture-docs-sync

- **Data:** 2026-06-22
- **Objetivo:** Auditar e corrigir `arquiteture.md` + docs que alimentam memorias Serena (spec 046)
- **App/Projeto:** governanca documental
- **Gate:** nenhum
- **Spec:** `specs/046-arquiteture-docs-sync/`

## Vínculos

- Spec 044 (opencode-ecosystem): onboarding Serena revelou discrepancias
- Spec 024 (docs-specs-backlog-audit): auditoria documental anterior

## Plano

1. Auditar `arquiteture.md` secao por secao (9 secoes) contra realidade
2. Corrigir discrepancias com aprovacao por secao
3. Verificar consistencia cruzada com `context-capsule.md` e `project-state.md`
4. Regenerar memorias Serena
5. Fechar spec

## Arquivos a modificar

- `.specify/arquiteture.md`
- `docs/agents/context-capsule.md` (se necessario)
- `.specify/memory/project-state.md` (se necessario)
- Memorias Serena (5)

## Criterio de conclusao

- `arquiteture.md` reflete realidade 2026-06-22
- Memorias Serena atualizadas
- Backlog/project-state/sessao atualizados

---

## Progresso

### T1 — §1 Layout do monorepo ✅

Auditado e corrigido (aprovado):
- apps: removidos downloads/esferas/srd, adicionados accounts/site-admin
- packages: removido crosslink, adicionados changelog/feedback/media
- infra/ removido (diretorio nao existe); docker-compose documentado como por-app
- module.manifest.ts e CONTEXT.md: so mesas tem

### T2 — §2 Contrato de modulo ✅

Auditado. Discrepancias encontradas:
- "Cada apps/* Exporta module.manifest.ts" → so mesas tem
- site-admin zero deps @artificio/*
- accounts e excecao natural a "nao implementa login proprio"
- Nav contem apps inexistentes (Downloads, Esferas, SRD)
- skill add-module referencia deploy-beta.yml inexistente
- Mantenedor pediu para NAO corrigir §2 agora — abrir spec primeiro (esta spec)

Correcoes pendentes de aprovacao.

### Investigacao DEB-001 — metadata de verificacao ✅

Investigado (2026-06-22):
- Nenhum doc T0/T1 tem data de verificacao — padrao ausente
- `arquiteture.md:1-3`: sem linha de data
- Git log mostra ultimo update `0c30ff3` (2026-06-18)
- Conclusao: **procede** — adicionar `> **Ultima verificacao:** YYYY-MM-DD` no topo
- Classificado: procede e deve ser implementado (T11)
- `debitos.md` atualizado com evidencias e conclusao

### Investigacao DEB-002 — module.manifest.ts ausente ✅ (ja investigado)

Conteudo completo em `debitos.md:51-131`. Resumo:
- Manifest do mesas e codigo morto (zero consumidores no repo)
- Problema real: falta de fonte unica de metadata de projetos (hostnames duplicados em 8 pontos)
- Ja rastreado: spec 019 FSU-004 → spec 035 BL-CONFIG-AUTH (aberto)
- Decisao pendente do mantenedor: centralizar em `packages/config` vs manter per-app
- Classificado: procede, mas e debito separado

### Investigacao DEB-003 — Nav com apps inexistentes ✅

Investigado (2026-06-22):
- `modules.ts:12-14`: Downloads, Esferas, SRD hardcoded
- 3 hosts nao resolvem (curl 000), zero containers na VM
- 3 apps afetados (glossario, mesas, links) — Header+Footer sem override de `nav`
- Site usa header proprio — nao afetado
- Conclusao: **precisa de decisao humana** — remover (A) vs manter placeholder (B) vs marcar "em breve" (C)
- Classificado: procede, precisa de decisao humana
- `debitos.md` atualizado com evidencias, impacto e opcoes

### Investigacao DEB-004 — site-admin zero deps @artificio/* ✅

Investigado (2026-06-22):
- site-admin NAO e app independente — e SPA servida pelo Express do site em `/admin`
- Mesma origem → cookie SSO automatico → nao precisa de `@artificio/auth`
- Admin panel com sidebar propria → nao precisa de `@artificio/ui` (Header/Footer publicos)
- Admin nao deve ter GA4 → correto nao usar `@artificio/analytics`
- Unico ponto real: URL hardcoded `accounts.artificiorpg.com` em `api.ts:7` (com env override, severidade baixa)
- Conclusao: **majoritariamente falso positivo** — isolamento e arquitetonico e correto
- Classificado: falso positivo (com 1 ponto menor)
- `debitos.md` atualizado com reclassificacao; backlog DEB-046-04 reclassificado

### T3 — Auditoria §3 (SSO / Auth) ✅

Investigado (2026-06-22). 4 discrepancias:
1. **JWKS inexistente** — doc menciona "JWKS de accounts", codigo usa so `JWT_SECRET` (HS256 simetrico). Zero referencias a JWKS.
2. **Cookie duplo nao documentado** — doc fala em "cookie" singular, realidade: `artificio_session` (15min) + `artificio_refresh` (7d).
3. **WP desatualizado** — doc menciona WP na raiz; WP offline desde D074/D075, site Astro serve.
4. **Consumidores incompletos** — doc lista so mesas+glossario; realidade: accounts, mesas, glossario, links, site, site-admin.
Correcao pendente de aprovacao.

### T5 — Auditoria §5 (Banco de dados) ✅

Investigado (2026-06-22). 2 discrepancias:
1. **Tabelas do site erradas** — doc lista `categories, tags` (nao existem); nome real e `taxonomies` (unificada c/ coluna `kind`). Faltam `comments, dev_feedback, media_map, post_taxonomies, schema_migrations` (10 tabelas reais vs 6 listadas).
2. **Isolamento subdocumentado** — doc diz "schema/banco proprio"; realidade: container Docker Postgres dedicado por app (5 containers separados).
Resto verificado: Postgres 16.14 ✅, users cross-cutting ✅, migrations versionadas ✅.

### T6 — Auditoria §6 (Conteudo / SEO / SSG) ✅

Investigado (2026-06-22). 2 discrepancias:
1. **Rebuild nao e Turbo** — doc diz "Turbo rebuilda so o afetado". Realidade: `jobs.ts:36` usa `spawn("pnpm", ["run", "rebuild"])` = Astro build local, nao Turbo. Single-flight com coalescing.
2. **Sitemap por modulo incompleto** — doc diz "Cada modulo serve seu /sitemap.xml". Verificado: glossario 200, mesas 200, **links 404**. Nao e universal.
Resto verificado: SSG Astro ✅, sem render runtime ✅, SEO meta/canonical/OG/JSON-LD (`packages/content`) ✅, 301 redirects (`redirect-cache.ts`) ✅, GA4 cookie_domain `.artificiorpg.com` ✅, Search Console Domain property ✅, RSS blog ✅.

### T7 — Auditoria §7 (CI/CD / Deploy) ✅

Investigado (2026-06-22). 2 discrepancias:
1. **env_override=prod tambem no links** — doc diz "exceto accounts", mas links tambem usa `env_override=prod`. 2 excecoes, nao 1.
 2. **Campos do manifest incompletos** — doc lista 12 campos; faltam `db_user` e `_comment` (14 reais).
Tabela .env datada de 2026-06-18 — potencialmente desatualizada. Resto verificado: ci.yml/deploy.yml/_deploy-module.yml existem ✅, git clones `/opt/artificio` + `/opt/artificio-beta` OK ✅, .env por app existem ✅, flock locking (`_deploy-module.yml:321`) ✅, promote-prod-fast-forward.yml ✅, imagem buildada NA VM (zero GHCR) ✅, fluxo branch→PR→dev→promote ff→deploy prod ✅.

### T4 — Auditoria §4 (Gateway / Roteamento) ✅

Auditado (2026-06-22). 5 achados registrados em `debitos.md`:

1. **T4-F1 (ALTA)** — Tabela de hostnames desatualizada: `links` ausente, `downloads/esferas/srd` listados sem app/container/DNS, `accounts` auth errado. Evidencia: `deploy-manifest.json`, `ssh faren docker ps`, probe HTTP 11 hostnames.

2. **T4-F2 (MEDIA)** — Estado site prod/beta stale: doc diz "ainda no mesmo container", "sera ativada". Realidade: containers separados desde spec 030/031 (D076/D077).

3. **T4-F3 (BAIXA)** — "Todo app tem beta proprio" impreciso: links e accounts sao PROD-only (`env_override=prod`, D042).

4. **T4-F4 (MEDIA)** — "Nenhum host hardcoded" falso: ~15 hardcodes em 8 arquivos. Ja mapeado como BL-CONFIG-AUTH (spec 035).

5. **T4-F5 (OK)** — Contrato Real IP verificado em 7 pontos (nginx mesas/glossario + Express em 5 backends). Default `172.18.0.0/16` consistente.

---

### Investigacao DEB-002 — module.manifest.ts ausente em 5 de 6 apps ✅ (CORRIGIDA)

Investigado (2026-06-22, revisado apos verificacao de codigo):

**Evidencia no codigo (nao so documentacao):**
- `packages/ui/src/modules.ts:8-16` — `defaultNavItems`: array centralizado, **fonte unica de facto** da nav cross-app
- `packages/ui/src/static.ts:2` — barrel static-safe (sem React) p/ Astro consumir
- `apps/site/src/lib/content.ts:74-75` — comentario: "fonte unica static-safe" / `MODULES = defaultNavItems`
- `packages/config/src/` — **zero** `domains.ts`/`projects.ts`; centralizacao ficou em `packages/ui`, nao `packages/config`
- `apps/mesas/module.manifest.ts` — criado em CDX-308A (`ce0a2bf`, 2026-06-04), anterior a unificacao (spec 010/041), nunca mais tocado
- Git log: spec 010 (`67cf5e1`) "nav cross-modulo unificado" + spec 041 (`ba2b647`) "fonte unica" → direcao executada

**Conclusao corrigida:** A decisao de centralizar JA FOI TOMADA E IMPLEMENTADA — em `packages/ui/modules.ts`, nao per-app. `module.manifest.ts` e residuo pre-unificacao. O problema NAO e falta de decisao — e **documentacao desatualizada** (`arquiteture.md` §2, skill `add-module`, spec 019 FSU-004) que ainda referencia contrato que o codigo nunca adotou.

**Classificacao:** falso positivo como "debito de implementacao". O debito real e **documental**: `arquiteture.md` e skill `add-module` precisam refletir que a fonte unica e `packages/ui/src/modules.ts`, nao `module.manifest.ts` por app.

**Recomendacao:** Corrigir `arquiteture.md` §2 e skill `add-module` — remover referencia a `module.manifest.ts` como contrato. Opcional: remover `apps/mesas/module.manifest.ts` (codigo morto).

`debitos.md` atualizado com evidencias do codigo.

### T9 — Auditoria §9 (Convencoes de codigo) ✅

Investigado (2026-06-22). 1 discrepancia:
- **DOMPurify ausente** — regra existe no AGENTS.md mas `dompurify` nao esta em nenhum `package.json` e zero imports no codigo. WP offline (D074). Regra vs realidade divergem.
Resto verificado: stack canonica ✅, TS strict ✅, normalizacao unknown ✅, segredos .env ✅.

---

## Checklist de fechamento

- [x] auditoria 9 secoes concluida
- [x] correcoes aprovadas e aplicadas
- [x] consistencia cruzada verificada
- [x] memorias Serena regeneradas
- [x] backlog atualizado
- [x] project-state.md atualizado

---

## Fase 3 — Conclusao (2026-06-22)

### T10 — Correcoes aplicadas
Todas as 9 secoes corrigidas (11 edicoes):
- §1: nav cross-app centralizada em `packages/ui/modules.ts`, `module.manifest.ts` = codigo morto
- §2: contrato reescrito — metadata em `modules.ts`, nao per-app
- §3: reescrita completa com investigacao profunda (HS256, 2 cookies, 2 segredos, 5 consumidores, CSRF/CORS)
- §4: tabela hostnames corrigida (links adicionado, futuros marcados), site prod/beta atualizado (D076/D077), betas qualificados, hardcodes reconhecidos
- §5: isolamento por container Docker, tabelas site corrigidas
- §6: rebuild Astro (nao Turbo), sitemap links 404
- §7: links `env_override=prod`, 14 campos no manifest
- §8: marcado como futuro (packages/apps inexistentes)
- §9: DOMPurify removido (WP offline D074)

### T11 — Metadata de verificacao
`> **Ultima verificacao:** 2026-06-22` adicionado apos `arquiteture.md:3`.

### T12 — context-capsule.md consistencia
5 discrepancias corrigidas: subdominios futuros, GHCR→build VM, WP removido, crosslink removido, apps futuros marcados.

### T13 — project-state.md consistencia
5 discrepancias corrigidas: topologia, SSO cookies, GHCR, pacotes (changelog+feedback), links em prod.

### T14 — Memorias Serena
3 de 5 atualizadas: `core` (SSO detalhado), `tech_stack` (GHCR removido), `conventions` (DOMPurify removido). `suggested_commands` e `task_completion` sem alteracoes.

### T-final — Backlog
- DEB-046-01 fechado (metadata implementada)
- DEB-046-02 fechado (arquiteture.md corrigido; remocao de codigo morto = fora do escopo)
- DEB-046-03 permanece aberto (decisao humana pendente)
- DEB-046-04 permanece (falso positivo, menor)

---

## Fase 4 — Revisão completa contra código (2026-06-22)

Revisão cross-check: todas as claims da spec 046 verificadas contra código real (não só docs).
9 seções verificadas. 4 discrepâncias encontradas e corrigidas:

### D1 — §6: links sitemap (CORRIGIDA)
- Doc dizia "links sem sitemap (404)" mas `apps/links/astro.config.mjs:3,14` tem `@astrojs/sitemap` configurado.
- **Código:** `import sitemap from "@astrojs/sitemap"` + `integrations: [react(), sitemap({ filter: ... })]`
- **Correção:** doc atualizado para "Glossário, mesas e links servem /sitemap.xml"

### D2 — §2: add-module skill desatualizada (CORRIGIDA)
- `SKILL.md:20-33` ainda instruía criar `module.manifest.ts` (contrato abolido)
- `SKILL.md:49` ainda dizia "Imagem GHCR" (build na VM)
- **Correção:** §3 substituído por "Registrar no nav cross-app (`packages/ui/src/modules.ts`)"; GHCR→build na VM

### D3 — §4: hardcodes contagem (CORRIGIDA)
- Doc dizia "~15", contei ~25 no código real
- **Correção:** ~15 → ~25

### D4 — §5: tabela `media` omitida (CORRIGIDA)
- Lista de tabelas do site omitia `media` (migration 001_init.sql), que coexiste com `media_map`
- **Correção:** `media` adicionada à lista

### Seções OK (sem discrepâncias)
- §1: layout monorepo — verificado (modules.ts, static.ts, zero imports module.manifest)
- §3: SSO/Auth — verificado (HS256, 2 cookies, 2 segredos, CSRF, CORS, 5 consumidores)
- §4: roteamento — verificado (nginx, Vite base, sem basename)
- §7: CI/CD — verificado (read_env_value, deploy-manifest, sem GHCR)
- §8: crosslink — futuro (correto)
- §9: convenções — DOMPurify removido (correto)

# Tasks — 046

## Fase 1 — Auditoria secao por secao

- [x] T1 — Auditar §1 (Layout do monorepo) · feito quando discrepancias registradas e correcao aprovada/aplicada.
- [x] T2 — Auditar §2 (Contrato de modulo) · feito quando discrepancias registradas.
- [x] T3 — Auditar §3 (SSO / Auth) · feito quando verificada contra implementacao real de `accounts` e `packages/auth`.
  - **Investigado 2026-06-22:** 4 discrepancias encontradas (JWKS inexistente, cookie duplo nao documentado, WP desatualizado, consumidores incompletos). Correcao pendente de aprovacao.
- [x] T4 — Auditar §4 (Gateway / Roteamento) · feito quando hostnames, containers e tunnel verificados.
- [x] T5 — Auditar §5 (Banco de dados) · feito quando schemas, migrations e isolamento verificados.
  - **Investigado 2026-06-22:** 2 discrepancias: (1) tabelas do site listadas com nomes errados — `categories/tags` nao existem, e `taxonomies`; faltam `comments, dev_feedback, media_map, post_taxonomies, schema_migrations`; (2) isolamento e por container Docker, nao so schema/banco. Postgres 16.14 ✅, users cross-cutting ✅, migrations versionadas ✅.
- [x] T6 — Auditar §6 (Conteudo / SEO / SSG) · feito quando site Astro, sitemap e SEO verificados.
  - **Investigado 2026-06-22:** 2 discrepancias: (1) doc diz "Turbo rebuilda so o afetado" — rebuild usa `spawn("pnpm", ["run", "rebuild"])` (Astro build), nao Turbo; (2) "Cada modulo serve seu /sitemap.xml" — links retorna 404 (glossario 200, mesas 200). SSG Astro ✅, sem render runtime ✅, SEO (meta/canonical/OG/JSON-LD) ✅, redirects 301 ✅, GA4 cookie_domain ✅, Search Console Domain property ✅.
- [x] T7 — Auditar §7 (CI/CD / Deploy) · feito quando workflows e deploy verificados.
  - **Investigado 2026-06-22:** 2 discrepancias: (1) doc diz "exceto accounts: env_override=prod fixo" — links tambem tem `env_override=prod`; (2) campos do deploy-manifest listados como 12 mas faltam `db_user` e `_comment` (14 reais). Tabela .env datada de 2026-06-18 — potencialmente desatualizada. Resto verificado: arquivos existem ✅, git clones VM ✅, .env por app ✅, flock locks ✅, promote ff ✅, imagem buildada na VM (sem GHCR) ✅, fluxo branch→PR→merge→promote→deploy ✅.
- [x] T8 — Auditar §8 (Engine de crosslink SRD ↔ Wiki) · feito quando verificada existencia/status.
  - **Investigado 2026-06-22:** Secao inteira e aspiracional — `packages/crosslink`, `apps/srd` e `apps/esferas` nao existem. Zero referencias em decisions.md ou specs/. Descreve design de features nunca implementadas. Recomendacao: remover ou marcar como futuro.
- [x] T9 — Auditar §9 (Convencoes de codigo) · feito quando verificadas contra eslint, tsconfig e praticas reais.
  - **Investigado 2026-06-22:** 1 discrepancia: "HTML do WP sanitizado (DOMPurify)" — DOMPurify nao esta em nenhum `package.json` e zero imports no codigo (so transiente no lockfile). WP offline desde D074. Resto verificado: stack canonica (D007+D048) ✅, TS strict ✅, normalizacao unknown ✅, segredos .env ✅.

## Fase 2 — Correcoes

- [x] T10 — Aplicar correcoes aprovadas no `arquiteture.md` (secoes com discrepancias) · feito quando todas as secoes com problemas estiverem corrigidas.
  - **Aplicado 2026-06-22:** §§1,2,4,5,6,7,8,9 corrigidas. §3 reescrita com investigação profunda (HS256, 2 cookies, 5 consumidores, CSRF/CORS). 11 edições no total.
- [x] T11 — Adicionar nota de "ultima verificacao" no topo do `arquiteture.md` · feito quando metadata de auditoria estiver visivel.
  - **Investigado 2026-06-22 (revisão final):** 
    - **Origem:** DEB-001 / DEB-046-01. Auditoria §1 detectou doc desatualizado e sem indicador de frescor.
    - **Evidência no código/docs:**
      - `arquiteture.md:1-3` — sem data de verificação.
      - Nenhum doc T0/T1 (`project-state.md`, `context-capsule.md`, `decisions.md`, `errors.md`) tem metadata de verificação — padrão ausente em todo o ecossistema.
      - `AGENTS.md:292`: tabela canônica lista `arquiteture.md` como "revisar/atualizar quando mudar contrato técnico/arquitetura" — sem menção a cadência de verificação.
      - Git log: último update de conteúdo `0c30ff3` (2026-06-18). Atualizações sob demanda, sem cadência.
    - **Impacto real:** Dano comprovado — auditoria §1 achou apps/packages/infra errados. Data de verificação sinalizaria staleness.
    - **Severidade:** Média — doc fonte canônica sem indicador de frescor.
    - **Risco de regressão:** Baixo — adição de 1 linha de metadata (`> **Ultima verificacao:** YYYY-MM-DD`). Zero parsers/CI/tools consomem `arquiteture.md`.
    - **Tratamento existente:** Nenhum. Padrão ausente.
    - **Falso positivo?** Não. Procede.
    - **Fora do escopo?** Não. É T11 da spec 046.
    - **Classificação:** procede e deve ser implementado.
    - **Recomendação (DEB-001):** Adicionar `> **Ultima verificacao:** 2026-06-22` após `arquiteture.md:3`. Opcional (fora do escopo): estender padrão para `project-state.md`, `context-capsule.md`, `decisions.md`.
    - **Backlog:** DEB-046-01 já registrado.

## Fase 3 — Consistencia cruzada

- [x] T12 — Verificar `context-capsule.md` contra `arquiteture.md` corrigido · feito quando discrepancias resolvidas ou registradas.
  - **Corrigido 2026-06-22:** 5 discrepâncias encontradas e corrigidas: (1) subdomínios ativos vs futuro, (2) GHCR→build na VM, (3) "HTML do WP" removido (WP offline D074), (4) `crosslink` removido dos pacotes (não existe), (5) apps futuros marcados como tal. "Onde estamos" atualizado para 2026-06-22 com estado WP desligado (D074).
- [x] T13 — Verificar `project-state.md` contra `arquiteture.md` corrigido · feito quando discrepancias resolvidas ou registradas.
  - **Corrigido 2026-06-22:** 5 discrepâncias: (1) topologia com subdomínios futuros, (2) "cookie JWT" singular→2 cookies, (3) GHCR→build na VM, (4) pacotes faltando changelog+feedback, (5) links "em dev"→prod.

## Fase 4 — Memorias Serena

- [x] T14 — Regenerar memorias Serena com dados corrigidos · feito quando 5 memorias atualizadas e verificadas.
  - **Atualizado 2026-06-22:** `core` (SSO: 2 cookies, HS256, 2 segredos, refresh flow), `tech_stack` (GHCR→build na VM), `conventions` (DOMPurify/WP removido). `suggested_commands` e `task_completion` sem alterações necessárias.

## Fase 5 — Fechamento

- [x] T-final — Atualizar `specs/backlog.md`, sessao e `project-state.md` · feito quando pendencias novas/fechadas refletidas.
  - **Atualizado 2026-06-22:** backlog: DEB-046-01/02 fechados. Sessao: checklist completa, Fase 3 registrada. project-state.md: consistencia cross-doc aplicada (5 correcoes). Spec 046 concluida (local, sem commit).

---

## Fase 6 — Revisão cross-check contra código (2026-06-22)

- [x] R1 — Revisar §1–§9 contra código real · feito quando todas as claims verificadas.
  - **Revisado 2026-06-22:** 9 seções verificadas contra código. 4 discrepâncias encontradas (D1–D4), todas corrigidas. §§1,3,4,7,8,9 sem discrepâncias.
- [x] R2 — Corrigir D1: §6 links sitemap · `apps/links/astro.config.mjs` tem `@astrojs/sitemap`, doc dizia "sem sitemap".
- [x] R3 — Corrigir D2: add-module skill · removido `module.manifest.ts`, GHCR→build na VM.
- [x] R4 — Corrigir D3: §4 hardcodes ~15→~25.
- [x] R5 — Corrigir D4: §5 adicionar tabela `media`.
- [x] R6 — Atualizar `debitos.md`: DEB-002 status resolvido (skill corrigida), T4-F4 count ~15→~25.
- [x] R7 — Atualizar spec, sessao, backlog com status final.

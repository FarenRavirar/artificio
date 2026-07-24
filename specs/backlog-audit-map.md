# Mapa de Auditoria de Débitos e Tarefas — Artifício RPG

> **View consolidada para orientação humana rápida.** Fonte canônica = [`specs/backlog.md`](backlog.md).
> Atualizado 2026-07-24 (refresh completo pós-auditoria de 187 itens).

> **⚠️ REGRA DE MANUTENÇÃO:** ao concluir ou mudar o status de um item, **MOVA a linha para a seção correta** e reordene. Nunca deixe item ✅ sob header 🟡/⚪ nem o contrário. Mapa fora de ordem é pior que sem mapa.

## Ordenação: do mais próximo de concluir ao mais distante

| Ref | Status | O que falta |
|:---|:---|:---|
| — | — | **🟡 LOCAL — código pronto, sem commit/deploy/merge** |
| BL-084-DOWNLOADS-SCRAPER | 🟡 Local | Fases 1-9 implementadas (branch `fix/084-*`, commit `6d897c8`); sem commit/push |
| BL-ACCOUNTS-PORT | 🟡 Local | T1-T4 OK; aguarda deploy prod com smoke health/login/me |
| BL-071-STORAGE-MULTIPROVIDER | 🟡 Local | F1-F5 implementados (21 testes); falta T0.1 (contrato Fastio) + T6.2 (upload R2 real) |
| BL-072-SUBMISSAO-MODERACAO-TAXONOMIA | 🟡 Local | F0-F7 implementados (44 testes); DEB-072-05 aberto |
| BL-073-DESCOBERTA-PUBLICA | 🟡 Local | F0-F6 implementados (56 testes); DEB-073-03 placeholder |
| BL-074-PAINEL-EDICAO | 🟡 Local | F0-F6 implementados (62 testes); DEB-074-01 |
| BL-075-GESTAO-ADMIN | 🟡 Local | F0-F7 implementados (79 testes); 3 débitos abertos |
| BL-076-INFRA-DEPLOY | 🟡 Local | F0-F4 implementados; F5/F6 exigem write em VM |
| — | — | **🟡 EM ANDAMENTO** |
| BL-070-076-DOWNLOADS-SPECS-FILHAS | 🟡 Andamento | 070 ✅ deployada (PR #151); 082/083 mergeadas em dev; 071-076 locais; 084 em branch própria |
| BL-MESAS-PARSER-4BUGS-062 | 🟡 Andamento | 6/7 bugs corrigidos (PR #144 deployado); bug 3 sem causa raiz; correction-tracking corrigido local |
| BL-DEPLOY-SSH-KEEPALIVE | 🟡 Andamento | Fase 1 commitada; robusto (setsid+logfile) pendente (SDD Completo) |
| SPEC-045 | 🟡 Andamento | Investigação concluída; T1 ✅ (PR #85); T2-T4 pendentes |
| SPEC-046 | 🟡 Andamento | Auditoria `arquiteture.md` §1-§2 concluída; §3-§9 pendentes |
| SPEC-045 | 🟡 Andamento | Investigação concluída; T1 ✅ (PR #85); T2 (deploy accounts) + T3 (canal logo) + T4 (smoke links) pendentes |
| SPEC-046 | 🟡 Andamento | Auditoria `arquiteture.md` §1-§2 concluída; §3-§9 pendentes |
| — | — | **🔴 BLOQUEADO — depende de ação externa** |
| BL-ACCOUNTS-DOCKERFILE-AUTH-ESM | 🔴 Bloqueado | **SSO DOWN (outage ativo).** `jsonwebtoken` não resolve no runtime CJS do container. Espelhar Dockerfile do mesas |
| BL-CF-TUNNEL-TOKEN-SCOPE | 🔴 Bloqueado | Mantenedor: adicionar permissões `Cloudflare Tunnel:Read/Edit` no token API |
| D-AIKIDO-CSP-ARTIFICIORPG | 🔴 Bloqueado | CSP ausente em `artificiorpg.com` (WP raiz). Diagnosticar origem (WP plugin vs Cloudflare) antes de mexer |
| BL-022-FINAL | 🔴 Bloqueado | Depende da conclusão de T2-T14 (variáveis semânticas + AA por tela) |
| — | — | **⚪ ABERTO — PRIORITÁRIO (afeta múltiplos apps/segurança/infra)** |
| BL-INFRA-GHCR-F12 | ⚪ Aberto | Build CI → push GHCR → VM pull (SDD Completo) |
| BL-MIGRATION-GUARD-ACCUMULATION-E012 | ⚪ Aberto | Guard `MAX_AUTO_PENDING=5` saudável; gap de processo (promote menos frequente que deploys) |
| BL-ACCOUNTS-CONTA-STALE | ⚪ Aberto | "Lateral branca" na /conta em dark = build velho em prod; deploy accounts prod pendente |
| BL-ACCOUNTS-DOCKERFILE-MEDIA | ⚪ Aberto | Cloudinary resolvido, mas container não sobe (ver BL-ACCOUNTS-DOCKERFILE-AUTH-ESM) |
| BL-DOWNLOADS-BETA-VOLUME-MISMATCH | ⚪ Aberto | Downloads beta fora do ar: 2 volumes com nomes divergentes (`downloads-beta_pgdata_downloads_beta` vs `downloads_pgdata_downloads_beta`) |
| BL-INFRA-DEPLOY-BUILDS-MAIN-ONLY | ⚪ Aberto | Deploy SEMPRE builda main/dev na VM, ignora `--ref`; footgun documentado |
| BL-QA-SECURITY-HEADERS | ⚪ Aberto | CSP/HSTS/COOP/XFO/Permissions sem quebrar OAuth/Cloudinary/Pagefind |
| BL-CONFIG-AUTH | ⚪ Aberto | Domínios canônicos + auth HTTP client compartilhado (SDD Completo; smoke todos consumidores SSO) |
| — | — | **⚪ ABERTO — NORMAL (app/projeto específico)** |
| BL-058-T11-10-FIELD-AUDIT | ⚪ Aberto | Auditoria campo-a-campo de `DiscordTableDraftTable` contra 3 datasets reais |
| BL-MESAS-AI-AUDIT-NO-TEST-COVERAGE | ⚪ Aberto | Sem teste unitário para `runCompletenessAudit` mockando fetch do DeepSeek |
| BL-API-DIFF-PATH-REMOVE-BLANK | ⚪ Aberto | `api:diff` renderiza `path.remove` com Path/Method vazios |
| BL-MESAS-TABLEREPO-EMPTY-CONTACTS-NO-TEST | ⚪ Aberto | Guard `contacts.length > 0` sem teste de integração com DB real |
| BL-MESAS-OPENAPI-AUDIT-STATUS-CODES | ⚪ Aberto | OpenAPI não documenta 404/422/423/502 reais dos endpoints de auditoria |
| BL-CF-TOKEN-DOC-GAP | ⚪ Aberto | Documentação registrava pendência como "check later" sem item acionável no backlog |
| BL-MESAS-AUTO-ARCHIVE-CF | ⚪ Aberto | Workflow `Mesas Auto-Archive` falha com Cloudflare 403 challenge |
| D-DEP2 | ⚪ Aberto | Atualizar apt/Node/pnpm/imagens Docker na VM com plano seguro |
| BL-DEPLOY-ENV-PGPASS-FAILFAST | ⚪ Aberto | `.env` corrompido na VM + fail-fast `28P01` no deploy |
| D-LINKS-ADMIN-UUID-VALIDATION | ⚪ Aberto | UUID validation nas 6 rotas restantes do links |
| D-DOCKERFILE-CHOWN-ORDER | ⚪ Aberto | `chown -R node:node` pós-install percorre node_modules gigante via SSH |
| BL-SITE-GATED | ⚪ Aberto | Gate D site: paridade editorial, E2E admin, SEO/redirects finais |
| BL-SITE-CMS-PARITY | ⚪ Aberto | CRUD editorial, lixeira, agendamento, roles, auditoria |
| BL-SITE-PRINCIPAL-GAPS | ⚪ Aberto | GA_ID vazio, newsletter quebrada, `posts.json` git-tracked com stale refs |
| BL-SITE-VM-MEDIA-LIBRARY | ⚪ Aberto | Spec 028 escrita; re-host 6 PDFs + biblioteca VM (SDD Completo) |
| BL-MESAS-PARSER-DRAFT-PATCH-422 | ⚪ Aberto | 422 em `PATCH /admin/discord/drafts/:id`; sem corpo da resposta para diagnóstico |
| D-SYNC1 | ⚪ Aberto | Sync inteligente sistemas/cenários cross-app (SDD Completo) |
| BL-UI-PRIMITIVES-CONSUMERS | ⚪ Aberto | Piloto site-admin com Button/Badge/controles do `packages/ui` |
| BL-022-SEMANTIC-VARS | ⚪ Aberto | Variáveis semânticas + checklist AA por tela |
| BL-022-MESAS-T8-BETA | ⚪ Aberto | Prova visual do perfil com dados vivos em beta |
| BL-022-MESAS-CATALOGO | ⚪ Aberto | Paleta/tokens no catálogo público mesas |
| BL-022-MESAS-PAINEL | ⚪ Aberto | Paleta/tokens no painel mestre mesas |
| BL-022-MESAS-FORMS | ⚪ Aberto | Migrar forms multi-step, drawers, modais, toasts |
| BL-022-MESAS-REMOVE-REMAP | ⚪ Aberto | Remover `[data-theme="light"]` local após T9-T11 |
| BL-022-ACCOUNTS-R7 | ⚪ Aberto | Migrar accounts para tokens globais ou documentar exceção |
| BL-QA-MESAS-PERF | ⚪ Aberto | Reduzir TBT/main-thread, JS/CSS unused, imagens pesadas |
| BL-ACCOUNTS-CONTA-NAV | ⚪ Aberto | Adicionar header/nav compartilhado na página de conta (SSO) |
| BL-INFRA-AUTODEPLOY-FF | ⚪ Aberto | Merge/FF para dev/main não dispara deploy; documentar ou implementar detecção |
| BL-QA-A11Y-SWEEP | ⚪ Aberto | Contraste, nomes acessíveis, links ambíguos, touch targets |
| BL-QA-THIRD-PARTY | ⚪ Aberto | Inventariar scripts live por host; decidir política de terceiros |
| BL-SEO-SHARED | ⚪ Aberto | Helpers SEO por projeto (além do site) |
| BL-NORMALIZERS | ⚪ Aberto | Normalização de payload externo por app |
| BL-SITE-ADMIN-WP-PUBLISH-GUARD | ⚪ Aberto | Guard `wp-content/uploads` no save/publish do admin |
| BL-GLOSSARIO-CHANGELOG-CLEANUP | ⚪ Aberto | Dropar tabela `update_log` + scripts obsoletos |
| BL-GLOSSARIO-LEGACY-CLEAN | ⚪ Aberto | Limpar `password_hash` BCrypt legado pós-SSO |
| DEB-046-03 | ⚪ Aberto | Nav contém apps inexistentes (Downloads, Esferas, SRD) |
| DEB-048-31 | ⚪ Aberto | URL Discord CDN efêmera → preview quebra; subir ao Cloudinary no import |
| DEB-048-34 | ⚪ Aberto | Unificar UI inbox dentro de "Discord Sync" |
| DEB-048-35 | ⚪ Aberto | Onde armazenar API key DeepSeek (por-módulo vs central)? |
| — | — | **🔵 FUTURO / 🟢 BAIXO (sem urgência)** |
| BL-DEP-CONTAINER-NAMES | 🔵 Futuro | `container_name` fixo → nomes por projeto compose |
| BL-FEEDBACK-MERGE | 🔵 Futuro | Unificar feedbacks entre projetos |
| D-FEEDBACK1 | 🔵 Futuro | Validar admin/beta do feedback quando retomar site |
| BL-UI-RADIUS-SPACING | 🟢 Baixo | Escala visual radius/shadow/spacing |
| BL-UI-T5-THEME-DEDUP | 🟢 Baixo | Deduplicar helpers de tema |
| BL-SITE-RESCUE-STRIPPED | 🟢 Baixo | Avatar Jason Bulmahn; importador descartável |
| BL-SITE-ADMIN-TS-VARIANCE | 🟢 Baixo | TS2345 multer x express; runtime OK |
| BL-GLOSSARIO-NONGOOGLE-E2E | 🟢 Baixo | E2E fluxo legado não-Google |
| BL-COPY-PUBLICA | 🔵 Futuro | Textos públicos compartilhados |
| BL-FEEDBACK-MESAS-ANTIDRIFT | 🔵 Futuro | Mesas consumir `@artificio/ui/feedback` |
| DEB-046-04 | 🟢 Baixo | `site-admin` sem deps `@artificio/*`; URL hardcoded em `api.ts` |
| BL-ECOSYSTEM-SERENA | 🔵 Futuro | Serena MCP instalado; aguarda smoke test com agente real |
| BL-ECOSYSTEM-CODEBASE-MEMORY | 🔵 Futuro | Codebase-memory-mcp indexado; aguarda v1.0+ |
| — | — | **✅ CONCLUÍDO / EM PROD (fechados; lista compacta)** |
| BL-082-DOWNLOADS-FECHAMENTO-REAL | ✅ | PRs #188/#190 mergeadas (2026-07-23) |
| BL-083-REJEICAO-MOTIVO-LEGAL-EMAIL | ✅ | PR #192 mergeada (2026-07-24) |
| BL-062-SISTEMAS-CATALOGO-CANONICO | ✅ | PRs #143/#145/#149 deployados em beta/prod; I0a/I0b ativos |
| BL-047-MESAS-INBOX | ✅ | PRs #87/#88 deployados; spec fechada (2026-06-23) |
| BL-048-MESAS-DISCORD-EXPORTER | ✅ | MVP em prod (PRs #99/#101); Fase G local; DEB-048-25/26/27 pendentes |
| BL-049-MESAS-GESTAO-REVISAO | ✅ | PR #93 deployado (76 arquivos, +186 testes) |
| BL-052-MESAS-AUTOMACAO-INTELIGENTE | ✅ | PRs #116/#117 deployados; Blocos A/B/C; DEB-052-01/02 abertos |
| BL-SITE-CSP-INLINE | ✅ | PR #112 deployado em prod; residual: Cloudflare + gtag |
| BL-077-MESAS-DEDUPE-ATIVAS | ✅ | PRs #159/#162 deployados em beta/prod; smoke UI pendente |
| BL-078-MESAS-SISTEMAS-HIDRATACAO | ✅ | PRs #163/#164/#165/#166 deployados; **migrations NÃO aplicadas** (bancos reais intactos); migration 150 `manual-risk` |
| BL-079-PARSER-TEXTO | ✅ | PRs #172/#174 mergeadas; deploy beta+prod (2026-07-17) |
| BL-070-DOWNLOADS-SCHEMA-API | ✅ | PR #151 deployado em beta/prod; schema/API/ownership do downloads |
| BL-059-MESAS-COPIAR-ANUNCIO-OG | ✅ | PR #140 mergeada; deploy beta+prod (2026-07-09) |
| BL-057-GESTAO-REDESIGN | ✅ | Fases 0-9 concluídas; smoke/promote validados (2026-07-09) |
| BL-060-GESTAO-MESAS-IMPORTADAS | ✅ | T1-T9 concluídas (2026-07-09) |
| BL-058-PARSER-LEARNING-DEEPSEEK | ✅ | DEB-058-01..08 corrigidos; deploy validado (2026-07-09) |
| BL-056-MODERACAO-BATCH | ✅ | PR #107 mergeada; deploy beta+prod (2026-06-29) |
| BL-053-CONSOLIDADO | ✅ | Frentes A-E concluídas; 052 destravada (2026-06-30) |
| BL-054-GESTAO-IA | ✅ | Fases 1-4 + reviews; deploy beta+prod (2026-06-30) |
| BL-055-API-GOVERNANCE | ✅ | Modo estrito ativo; allowlist vazia; CI required check (2026-06-30) |
| BL-051-UI-CHANGELOG-NAV | ✅ | PRs #96/#97; deploy prod 4/4 apps (2026-06-26) |
| BL-MESAS-DRAFT-7ACHADOS | ✅ | PR #156 mergeada; deploy beta (2026-07-13) |
| BL-MESAS-PARSER-4BUGS-062 | ✅ | PR #144 mergeada; deploy beta+prod (2026-07-10); bug 3 residual |
| BL-ANALYTICS | ✅ | PR #185 mergeada; GA4 1 property por app (D117, 2026-07-20) |
| BL-061-DOWNLOADS-DEFINICAO | ✅ | F0-F7 concluídas; 10 perguntas bloqueantes resolvidas (2026-07-11) |
| BL-MESAS-CATALOGO-SELOS-DUP | ✅ | PR #179 mergeada; `SealToggle` extraído (2026-07-18) |
| BL-MESAS-081-POS-FECHAMENTO | ✅ | PRs #182/#183; catálogo redesign + changelog (2026-07-18) |
| BL-DUPLICATE-042 | ✅ | PR #83; cpd 5.57%→4.60% (2026-06-21) |
| BL-LINKS-013 | ✅ | PR #74; deploy prod links (2026-06-21) |
| BL-SHELL-B13 / D-SHELL1 | ✅ | Spec 041; shell único cross-app em prod (2026-06-21) |
| BL-MIGRATION-TRACKING-DUPLICATE-INSERT | ✅ | `ON CONFLICT DO NOTHING` no INSERT (2026-07-20) |
| BL-BETA-HYDRATE | ✅ | Role `mesas_ro` + `PROD_DB_URL` no .env.beta (2026-06-29) |
| BL-INFRA-CACHE-CAP-F10 | ✅ | `docker builder prune -f` em prod (2026-06-20) |
| BL-SITE-PROD-PARITY-030 | ✅ | Site em paridade total com mesas/glossario/accounts |
| BL-SITE-DATA-FLUXO-031 | ✅ | Seed, flip autoria, flip rota, noindex beta |
| BL-SITE-CUTOVER-029 | ✅ | Beta→raiz efetivado em prod |
| BL-QA-SITE-IMAGES | ✅ | Residual `wp-content/uploads` = 0 |
| BL-ROOTLESS-CONTAINERS | ✅ | `USER node` nos 5 Dockerfiles |
| BL-CLOUDINARY-SHARED | ✅ | `@artificio/media`; 3 consumidores |
| BL-SEC-AUDIT-DEPS | ✅ | `pnpm audit` 16→2; overrides (2026-06-21) |
| BL-PNPM-11 | ✅ | pnpm 11.8.0; allowBuilds enumerado (2026-06-19) |
| BL-KYSELY-029-ESM | ✅ | Kysely 0.29; mesas jest→vitest (2026-06-19) |
| D-DEP1 / BL-MESAS-EXPRESS5-016 | ✅ | Express 5 em 4/4 backends |
| BL-INFRA-WORKFLOWS-026 | ✅ | Auditoria F1-F5/F10/F-SEC fechados |
| BL-INFRA-DEFAULT-BRANCH | ✅ | `dev`=default; branch protection |
| BL-INFRA-SEC-SCAN | ✅ | 7 workflows segurança ativos |
| BL-CI-ESLINT-FLAT-CONFIG | ✅ | 16/16 `eslint.config.js`; lint = gate obrigatório |
| BL-UI-B3-HEADERACTION | ✅ | `HeaderAction` no `packages/ui` |
| BL-UI-B4-PRIMITIVES | ✅ | Button/Badge/Field/Modal/Drawer |
| BL-UI-B12-FONTS | ✅ | Fontes locais; sem Google Fonts |
| BL-UI-B2-STATIC | ✅ | `@artificio/ui/static` |
| BL-UI-COPYRIGHT-027 | ✅ | `/termos-de-uso` + rodapé universal |
| BL-UI-THEME-REACT-HEADER-VARIANT | ✅ | `applyHeaderVariant()` em prod nos 4 apps React |
| BL-UI-THEME-TOGGLE-SITE-REGRESSION | ✅ | Toggle funcional em beta; causa = cache Cloudflare |
| BL-QA-SHELL-CLS | ✅ | CLS 0.000862 |
| BL-QA-GLOSSARIO-PERF | ✅ | Perf 12→61; bundle ~340kB |
| BL-QA-ROBOTS-SEO | ✅ | robots.txt origem OK |
| BL-REALIP-023 | ✅ | Contrato Real IP |
| BL-ASTRO6-CSP | ✅ | CSP via meta tag; 46/46 páginas |
| BL-LINKS-MEDIA-038 | ✅ | Logos 12/13; report público; cron VM |
| BL-LINKS-GROUP-LOGOS | ✅ | 12/13 reidratados em prod |
| BL-LINKS-NAV-CROSSAPP | ✅ | Nav em site/glossário/mesas |
| BL-LINKS-VISUAL-AUDIT-043 | ✅ | PR #84; 14 DEBs + 17 REVs |
| BL-MESAS-MIGRATION-GUARD-FALSE-POSITIVE | ✅ | Regex estreito; 39 testes shell |
| BL-MIGRATION-RECONCILE-TOOL | ✅ | Port canônico parametrizado |
| BL-033-SECRET-BLOCK | ✅ | `.gitignore artifacts/`; 16 destrackeados |
| BL-BUILD-CACHE-PRUNE-ALL | ✅ | `prune --all` em prod desde `bfa98be` |
| D-DOCKERFILE-LONGLINES | ✅ | 5 fixes commitados |
| BL-DEP-MESAS-LEGACY-SCRIPTS | ✅ | 6 arquivos removidos |
| DEB-050-01 a DEB-050-09 | ✅ | Todos fechados (specs 050/051) |
| BL-TEST-MESAS-SSO-ENV | ✅ | `test.env` fix |
| BL-TEST-SITE-MEDIA-MOCK | ✅ | `enableCloudinary()` helper |
| DEB-048-30 | ✅ | Sync Discord→mesa 500 corrigido (PR #156 deployado) |
| DEB-048-33 | ✅ | Banner landscape em 2+ imagens (PR #159 deployado) |
| DEB-048-32 | ✅ | requestLogger→stdout |
| DEB-048-36 | ✅ | Hotfix `@artificio/config` CJS exports |
| DEB-048-37 | ✅ | → spec 053 Frente C (smoke CJS CI) |
| DEB-048-38 | ✅ | → spec 053 Frente B (tema accounts) |
| DEB-049-D06 | ✅ | → spec 053 Frente A (a11y gestão) |
| + ~50 débitos históricos (D-UX*, D-MARCA*, D-INFRA*, D-MESAS*, D-CONT*, D-SHELL*, D-NGINX*, DEB-001..014, DEB-046-01/02, etc.) | ✅ | Todos fechados/absorvidos/superados |

## Spec 037 — achados de segurança/qualidade (PRs #75, #76 mergeadas)

| Ref | Status | Descrição |
|:---|:---|:---|
| D086 | ✅ Decisão | CodeQL missing-token-validation = falso positivo |
| T34 | ✅ PR #75 | `app.disable("x-powered-by")` em 5 apps |
| T35 | 📋 Investigado | Helmet/security headers — decisão mantenedor |
| T36 | ✅ PR #75 | `csrfProtection` antes de `express.json()` nos 4 apps |
| T37 | ✅ PR #75 | Merge 2 imports `@artificio/auth` em links |
| T38 | ✅ PR #75 | `cookieParser` antes de `json` no accounts |
| T39 | ✅ PR #75 | `publicLimiter` no `express.static` do links |
| T40 | 📋 Info | `cookieParser()` sem secret — sem ação |
| T41 | ✅ PR #75 | Site CSRF allowlist: `PUBLIC_SITE_URL` + www |
| T46 | ✅ Corrigido (PR #76) | `@artificio/media` CJS → ESM |
| T47 | ✅ PR #75 | `globalRateLimiter` antes de `csrfProtection` |

## Bloqueios / decisões pendentes

- **BL-ACCOUNTS-DOCKERFILE-AUTH-ESM**: SSO down. Espelhar Dockerfile do mesas para resolver `jsonwebtoken` ESM
- **BL-CF-TUNNEL-TOKEN-SCOPE**: Mantenedor dashboard CF → permissões `Cloudflare Tunnel:Read/Edit`
- **D-AIKIDO-CSP-ARTIFICIORPG**: Diagnosticar origem do CSP ausente (WP plugin vs Cloudflare)
- **BL-078**: Código deployado em beta/prod (PRs #163-#166). Migrations 146-150 pendentes de apply (150 é `manual-risk`)
- **BL-077**: Código deployado em beta/prod (PRs #159/#162). Smoke UI pendente
- **BL-071-076**: Implementadas localmente na branch `feat/070-downloads-schema-api`; 070 deployada via PR #151; demais aguardam commit/PR
- **BL-084**: Fases 1-9 na branch `fix/084-*`; sem commit/push

Legenda: ✅ concluído · 🟡 local/parcial · ⚪ aberto · 🔴 bloqueado · 🔵 futuro · 🟢 baixo · 📋 investigado.

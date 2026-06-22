# Debitos — 046

Debitos acionaveis tambem devem aparecer em `specs/backlog.md`.

| ID | Titulo | Origem | Task | Review | Severidade | Prioridade | Status | Backlog |
|---|---|---|---|---|---|---|---|---|

## DEB-001 — arquiteture.md nao tinha metadata de ultima verificacao

- **Origem:** auditoria §1 (spec 046)
- **Task vinculada:** T11
- **Review vinculado:** —
- **Status:** ✅ **investigado — procede** (2026-06-22)
- **Classificacao:** procede e deve ser implementado

### Evidencia

- `arquiteture.md:1-3` — topo do arquivo tem instrucao T1, sem data de verificacao.
- Nenhum doc T0/T1 (`project-state.md`, `context-capsule.md`, `decisions.md`, `errors.md`) tem data de verificacao — padrao ausente em todo o ecossistema documental.
- Git log: ultimo update de conteudo em `0c30ff3` (2026-06-18). Atualizacoes sob demanda, sem cadencia.

### Impacto real

A auditoria da §1 comprovou que o doc estava desatualizado (apps/packages/infra errados). Uma data de verificacao sinalizaria staleness para qualquer agente/humano.

### Severidade real

**Media** — doc fonte canonica de arquitetura sem indicador de frescor. A prova de dano ja ocorreu (discrepancias na §1).

### Risco de regressao

Baixo — adicao de 1 linha de metadata. Nao afeta ferramentas, parsers ou onboardings.

### Recomendacao

Adicionar apos `arquiteture.md:3`:
```markdown
> **Ultima verificacao:** 2026-06-22
```

Opcional (fora do escopo): estender padrao para `project-state.md`, `context-capsule.md`, `decisions.md`.

### Criterio de resolucao

Adicionar linha `> **Ultima verificacao:** YYYY-MM-DD` no topo do `arquiteture.md`. Atualizar a data a cada auditoria/sec corrigida.

- **Backlog geral:** sim (DEB-046-01)
- **Prioridade:** media
- **Severidade:** media

## DEB-002 — module.manifest.ts ausente em 5 de 6 apps

- **Origem:** auditoria §1, §2 (spec 046)
- **Task vinculada:** T1, T2
- **Review vinculado:** —
- **Status:** ✅ **resolvido (2026-06-22)** — `arquiteture.md` §1/§2 corrigidos + `add-module` SKILL.md §3 substituído por "Registrar em packages/ui/src/modules.ts"
- **Classificacao:** procede, resolvido nesta spec

### Evidencia

- `apps/mesas/module.manifest.ts:1-8` — unico manifest existente. Define `host`, `navLabel`, `navIcon`, `requiresAuth`, `analyticsNamespace`, `sitemapProvider`.
- `apps/mesas/CONTEXT.md:1-15` — unico CONTEXT.md existente. Documenta estado, contrato G1 e proxima etapa.
- Apps sem manifest: `accounts`, `glossario`, `links`, `site`, `site-admin` (5 de 6).
- Apps sem CONTEXT.md: `accounts`, `glossario`, `links`, `site`, `site-admin` (5 de 6).

### Consumidores: zero

- `rg "module.manifest|ModuleManifest"` no repo retorna **zero resultados em codigo** (`.ts`, `.tsx`, `.js`, `.json`). O manifest do `mesas` nao e importado por ninguem — e codigo morto.
- `rg "CONTEXT.md"` no repo retorna **zero resultados em codigo**. CONTEXT.md e documentacao pura, sem consumidor runtime.
- A nav cross-app e construida por `packages/ui/src/modules.ts:8-16` — array estatico `defaultNavItems` com 7 itens hardcoded. Nao le manifest nenhum.
- O componente `Nav` (`packages/ui/src/Nav.tsx:8-30`) recebe `items: NavItem[]` como prop — e um renderizador generico, nao um registry.
- `packages/ui/src/Header.tsx:84` — Header usa `defaultNavItems` como default da prop `navItems`.

### Contrato definido vs realidade

- `arquiteture.md:31-41` define o contrato: "Cada `apps/*` [...] Exporta `module.manifest.ts`".
- `.claude/skills/add-module/SKILL.md:20-33` instrui criar `module.manifest.ts` ao adicionar modulo novo.
- Ambos sao aspiracionais — definem o que DEVERIA existir, nao o que EXISTE.
- O contrato nunca foi implementado como mecanismo runtime (sem registry, sem plugin system, sem consumer).

### Impacto real

**Baixo hoje** — a nav funciona com `modules.ts` hardcoded; os apps rodam em prod sem manifest. Porem, o drift entre contrato documentado e realidade e risco para:
1. Onboarding de novos agentes (leem `arquiteture.md` e skill `add-module`, esperam manifests que nao existem).
2. Criacao de novos apps (skill manda criar manifest, mas ele nunca sera consumido — trabalho perdido).
3. Consistencia cross-app (sem fonte unica de metadata por app).

### Decisao de centralizacao — JA TOMADA E IMPLEMENTADA no codigo

A investigacao no codigo (nao na documentacao) revela que a decisao **ja foi tomada e implementada**:

1. **`packages/ui/src/modules.ts:8-16`** — `defaultNavItems` e o array centralizado com todos os apps. E a **fonte unica de facto** para nav cross-app. Nao le `module.manifest.ts` de ninguem.

2. **`packages/ui/src/static.ts:2`** — barrel static-safe que re-exporta `defaultNavItems` (sem React/auth), permitindo que Astro (site) consuma sem quebrar D048 zero-JS.

3. **`apps/site/src/lib/content.ts:74-75`** — comentario explicito: _"Nav cross-projetos do portal (D017): fonte unica static-safe, sem barrel React/auth."_ `MODULES = defaultNavItems`. O site trata `modules.ts` como fonte unica documentada.

4. **Git log** — spec 010 (`67cf5e1`): "nav cross-modulo unificado" · spec 041 (`ba2b647`): "nav, botoes e menu de conta de fonte unica". A direcao de centralizacao em `packages/ui` foi executada em 2 specs. `module.manifest.ts` (`ce0a2bf`, CDX-308A, 2026-06-04) e anterior a unificacao e nunca mais foi tocado.

5. **`packages/config/src/`** — nao tem `domains.ts` nem `projects.ts`. A centralizacao de metadata ficou em `packages/ui/modules.ts`, nao em `packages/config` como a spec 019 especulava.

**Conclusao corrigida:** O projeto NAO precisa de "decisao" — a decisao ja foi tomada e implementada (centralizar em `packages/ui`, nao per-app). O problema real e **documentacao desatualizada**: `arquiteture.md:31` diz "Cada `apps/*` [...] Exporta `module.manifest.ts`" e a skill `add-module` manda criar — mas o codigo nunca adotou esse contrato. A spec 019 FSU-004 (`plan.md:93`) lista como "pendente de decisao" mas o codigo ja resolveu na pratica.

A documentacao (arquiteture.md, add-module skill, spec 019) esta **dessincronizada do codigo**, nao o contrario.

### Severidade real

**Baixa** — o codigo funciona (nav centralizada em `modules.ts`). O unico dano e documentacao induzindo agentes a criar `module.manifest.ts` em apps novos (trabalho inutil).

### Risco de regressao

Nenhum — remover ou manter `module.manifest.ts` do mesas nao afeta runtime (zero consumidores).

### Recomendacao

**Remover `module.manifest.ts` do contrato** — atualizar `arquiteture.md` §2 e skill `add-module` para refletir que a nav/metadata cross-app vive em `packages/ui/src/modules.ts` (fonte unica), nao em manifests por app. Opcional: remover `apps/mesas/module.manifest.ts` (codigo morto) ou mante-lo como referencia historica.

### Criterio de resolucao

1. ✅ Atualizar `arquiteture.md:31-41` — reflete `packages/ui/src/modules.ts` como fonte unica.
2. ✅ Atualizar `.claude/skills/add-module/SKILL.md:20-33` — secao `module.manifest.ts` removida, substituida por "Registrar em `packages/ui/src/modules.ts`".
3. (Fora do escopo da 046) Remover `apps/mesas/module.manifest.ts` se desejado.

- **Backlog geral:** sim (DEB-046-02, ja existente)
- **Prioridade:** baixa (sem impacto funcional)
- **Severidade:** media

## DEB-003 — Nav contem apps inexistentes (Downloads, Esferas, SRD)

- **Origem:** auditoria §2 (spec 046)
- **Task vinculada:** T2
- **Review vinculado:** —
- **Status:** ✅ **investigado — precisa de decisao humana** (2026-06-22)
- **Classificacao:** procede, precisa de decisao humana

### Evidencia

- `packages/ui/src/modules.ts:12-14` — 3 URLs hardcoded para subdominios que nao existem
- `curl` retorna `000` (DNS/connection failure) para os 3 hosts
- VM: zero containers rodando (`docker ps` sem match)
- **Header.tsx:84** — `navItems = defaultNavItems` (fallback sem override)
- **Footer.tsx:28** — `navItems = defaultNavItems` (fallback sem override)
- **3 apps afetados:** glossario (GlossarioHeader sem prop `nav`), mesas (AppShell sem prop `nav`), links (LinksHeader sem prop `nav` + Sidebar.astro usa `defaultNavItems` direto)
- Site usa header proprio (SiteHeader.astro) — nao afetado
- `project-state.md` lista downloads/esferas/srd como projetos futuros — os itens podem ser placeholders intencionais

### Impacto real

3 apps em producao exibem links quebrados na navegacao principal. Usuario recebe erro de conexao (pior que 404).

### Severidade real

**Baixa/Media** — 3 apps expoem links mortos na nav cross-app. Dano a confianca, nao a funcionalidade.

### Decisao pendente

| Opcao | Descricao |
|---|---|
| A | Remover da nav ate o app existir |
| B | Manter como placeholder aspiracional |
| C | Adicionar estado `disabled`/`comingSoon` no `NavItem` e marcar "Em breve" |

### Criterio de resolucao

Decisao do mantenedor entre A/B/C → implementar → validar nav nos 3 apps.

- **Backlog geral:** sim (DEB-046-03)
- **Prioridade:** baixa
- **Severidade:** baixa/media

## DEB-004 — site-admin zero dependencias @artificio/*

- **Origem:** auditoria §2 (spec 046)
- **Task vinculada:** T2
- **Review vinculado:** —
- **Status:** ✅ **investigado — majoritariamente falso positivo** (2026-06-22)
- **Classificacao:** falso positivo (com 1 ponto menor real)

### Evidencia

- `site-admin/package.json` — zero `@artificio/*` nos deps
- `site-admin/src/` — 13 source files, nenhum importa pacotes compartilhados
- **Contexto arquitetonico:** site-admin NAO e app independente — e SPA servida pelo Express do `apps/site` em `/admin` (`site/server/server.ts`, `deploy-manifest.json`). Sem Dockerfile/docker-compose proprio. Roda na mesma origem do site.

### Por que o isolamento e correto

| Pacote | Por que nao precisa |
|---|---|
| `@artificio/auth` | Same-origin (`artificiorpg.com/admin`) → cookie SSO vai automaticamente. `api.ts` implementa `authFetch` com refresh — funcional e apropriado. |
| `@artificio/ui` | Admin panel com sidebar propria, nao pagina publica. Header/Footer compartilhados sao para apps publicos. |
| `@artificio/analytics` | Admin nao deve ter GA4 — correto. |
| `@artificio/media` | Upload proprio em `api.ts:105-119`, auto-contido, funcional. |

### Ponto real (menor)

`api.ts:7` — hardcoded `"https://accounts.artificiorpg.com"` como fallback. Tem env override (`VITE_ACCOUNTS_URL`), mas viola convencao "nunca hardcoded". Severidade baixa.

### Impacto real

Baixo. Isolamento arquitetonico intencional e correto. Admin panel com design proprio e apropriado.

### Severidade real

**Baixa** — unico ponto real e URL hardcoded com env override.

### Recomendacao

Nao integrar `@artificio/ui`/`@artificio/auth` — resolvem problemas que o admin nao tem. Item menor: usar `@artificio/config` para `ACCOUNTS_ORIGIN` (fora do escopo desta spec).

- **Backlog geral:** sim (DEB-046-04, reclassificado)
- **Prioridade:** baixa
- **Severidade:** baixa

---

## Achados T4 — Auditoria §4 (Gateway / Roteamento)

### T4-F1 — Tabela de hostnames (§4) desatualizada

- **Origem:** auditoria §4 (spec 046, T4)
- **Task vinculada:** T4
- **Status:** ✅ **investigado — procede** (2026-06-22)
- **Classificacao:** procede e deve ser implementado (correcao documental)

**Discrepancias na tabela `arquiteture.md:54-64`:**

| Hostname | Doc diz | Realidade | Evidencia |
|---|---|---|---|
| `links.artificiorpg.com` | **ausente** da tabela | Em prod, container links-app/links-db healthy, 200 | `deploy-manifest.json:93-114`, `ssh faren 'docker ps'`, probe HTTP 200 |
| `downloads.artificiorpg.com` | listado, auth "opcional" | Sem app, sem container, sem DNS | `apps/` sem diretorio, probe DNS falha |
| `esferas.artificiorpg.com` | listado, auth "publico" | Sem app, sem container, sem DNS | `apps/` sem diretorio, probe DNS falha |
| `srd.artificiorpg.com` | listado, auth "publico" | Sem app, sem container, sem DNS | `apps/` sem diretorio, probe DNS falha |
| `accounts.artificiorpg.com` | Auth "—" | Auth e SSO (sim) | E o proprio servico de autenticacao |

**Impacto:** tabela canonical de roteamento lista 3 hostnames que nao existem e omite 1 (links) que esta em producao.

**Severidade:** alta — doc fonte de roteamento incorreto induz agentes e onboardings a erro.

**Recomendacao:** corrigir tabela: adicionar `links`, remover/marcar downloads/esferas/srd como "futuro", corrigir auth do accounts para "SSO".

### T4-F2 — Estado site prod/beta desatualizado

- **Origem:** auditoria §4 (spec 046, T4)
- **Task vinculada:** T4
- **Status:** ✅ **investigado — procede** (2026-06-22)
- **Classificacao:** procede e deve ser implementado (correcao documental)

**Evidencia:**
- `arquiteture.md:66` — "raiz e beta ainda no mesmo container `site-beta-app` (D075). A separacao em containers distintos (`site-prod-app`+`site-prod-db`) esta codificada (spec 030 Fase 0, PR #58 em `dev`) e **sera ativada** nas Fases 1-4"
- `arquiteture.md:67` — "**Atualmente** mesmo container+DB da raiz (D075). **Apos spec 030:** container isolado"
- **Realidade:** `ssh faren 'docker ps'` mostra `site-prod-app` E `site-beta-app` como containers separados, ambos healthy. Spec 030/031 ja executadas em prod. D075 superado por D076/D077.

**Impacto:** doc diz que separacao "sera ativada" — ja foi. Agentes podem tomar decisoes erradas baseadas em estado desatualizado.

**Severidade:** media — doc operacional stale; projetos citados (D075, spec 030) ja foram superados.

**Recomendacao:** reescrever §4 linhas 66-67 para refletir estado atual: containers prod/beta separados, D076/D077 em vigor.

### T4-F3 — "Todo app tem beta proprio" impreciso

- **Origem:** auditoria §4 (spec 046, T4)
- **Task vinculada:** T4
- **Status:** ✅ **investigado — procede** (2026-06-22)
- **Classificacao:** procede e deve ser implementado (correcao documental)

**Evidencia:**
- `arquiteture.md:68` — "Todo app tem beta proprio: `mesasbeta.artificiorpg.com`, `glossariobeta.artificiorpg.com` etc."
- `deploy-manifest.json` — `links` e `accounts` usam `env_override: "prod"` (PROD-only, sem beta)
- `ssh faren 'docker ps'` — sem containers links-beta ou accounts-beta
- D042: accounts beta reusa accounts PROD (`.env.beta` so tem `JWT_SECRET`)

**Impacto:** afirmacao universal falsa. 2 de 5 apps nao tem beta proprio.

**Severidade:** baixa —澄清 para precisao documental.

**Recomendacao:** qualificar: "Mesas, glossario e site tem beta proprio. Links e accounts sao PROD-only (D042)."

### T4-F4 — "Nenhum host hardcoded fora de env/config" falso

- **Origem:** auditoria §4 (spec 046, T4)
- **Task vinculada:** T4
- **Status:** ✅ **investigado — procede, mas e debito separado** (2026-06-22)
- **Classificacao:** procede, mas e debito separado (BL-CONFIG-AUTH, spec 035)

**Evidencia — hardcodes encontrados (todos tem fallback env, mas default e string literal):**
- `apps/mesas/backend/src/routes/auth.ts:5-6` — `getAccountsOrigin()`, `getMesasOrigin()` com default hardcoded
- `apps/mesas/backend/src/routes/og.ts:9` — `SITE_URL` default hardcoded
- `apps/mesas/frontend/src/utils/auth.ts:3` — `DEFAULT_MESAS_PUBLIC_ORIGIN` hardcoded
- `apps/site-admin/src/api.ts:7` — `ACCOUNTS_ORIGIN` hardcoded
- `apps/links/server/server.ts:46` — public URL default hardcoded
- `apps/links/astro.config.mjs:11` — site URL default hardcoded
- `apps/links/src/components/LinksHeader.tsx:22` — `currentHref` hardcoded
- `apps/glossario/frontend/src/components/GlossarioHeader.tsx:52` — `brandHref` hardcoded
- `packages/ui/src/modules.ts:10-15` — todos os 7 hostnames hardcoded
- `packages/auth/src/client.ts:4` — `DEFAULT_ACCOUNTS_ORIGIN` hardcoded

**Impacto:** claim "nenhum host hardcoded" e falsa. ~25 hardcodes em 8 arquivos.

**Severidade:** media — ja mapeado como BL-CONFIG-AUTH (spec 035).

**Recomendacao:** remover claim da linha 76 ou qualificar. A correcao dos hardcodes e escopo do BL-CONFIG-AUTH (fora da 046).

### T4-F5 — Contrato Real IP verificado OK

- **Origem:** auditoria §4 (spec 046, T4)
- **Task vinculada:** T4
- **Status:** ✅ **verificado — OK** (2026-06-22)
- **Classificacao:** ja resolvido / sem discrepancia

**Evidencia:**
- `apps/mesas/frontend/nginx.conf:24-26` — `set_real_ip_from ${TRUSTED_REAL_IP_FROM}`, `real_ip_header CF-Connecting-IP`, `real_ip_recursive on` ✅
- `apps/glossario/frontend/nginx.conf.template:1-3` — identico ✅
- `apps/accounts/src/app.ts:63` — `app.set("trust proxy", env.TRUSTED_PROXY_CIDR)` ✅
- `apps/mesas/backend/src/server.ts:65` — `app.set('trust proxy', ...)` ✅
- `apps/glossario/backend/src/index.ts:30` — `app.set('trust proxy', ...)` ✅
- `apps/site/server/server.ts:27` — `app.set("trust proxy", ...)` ✅
- `apps/links/server/server.ts:28` — `app.set("trust proxy", ...)` ✅
- Default `172.18.0.0/16` em todos, consistente com `artificio_net` verificada (D069)

**Conclusao:** contrato Real IP implementado corretamente em todos os 7 pontos. Doc alinhado com codigo.

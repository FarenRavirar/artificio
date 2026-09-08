# Plano — 008 Módulo `site` (fundação)

> SDD Completo (toca `packages/*`, banco, importador, SEO estrutural, contrato público). Spec antes de código.
> Esta fase = **levantamento + decisão + documentação** (D044). Execução é fases F2→F7, Codex executa, Opus valida.

## Arquitetura da solução

```
                 WP REST (read-only GET)
artificiorpg.com ──────────────► [importador one-shot]  (F3, descartável pós-cutover)
  (intocável)                          │  sanitiza HTML, puxa mídia
                                       ▼
                              [store nativo Postgres]  (F2)
                               posts/taxonomies/media/
                               pages/comments/redirects
                                       │
                          publish/edit │ trigger rebuild (admin, F4)
                                       ▼
                              [SSG pré-render]  (F4)
                               /blog/<slug>/ , /<slug>/ , arquivos cat/tag
                               + sitemap/robots/JSON-LD (packages/content, F5)
                               + GA4 cross (packages/analytics, F6)
                                       │
                          deploy canônico (D039) │ git-pull + turbo build
                                       ▼
                          beta.artificiorpg.com  (F7, Cloudflare Tunnel)
                          SSO accounts. · @artificio/ui · artificio_net
```

**Princípios:**
- **Store é a fonte da verdade** pós-import; o importador é **descartável** (some no cutover, D005). Não acoplar app ao formato WP.
- **SSG, não SSR** (D006): runtime serve estático; rebuild incremental disparado pelo admin. Menos superfície de runtime quebrando.
- **REST read-only** sobre o WP (D045): zero escrita, zero credencial DB, WP intocável (D004).
- **Slug imutável** = chave de SEO (D047). 301 preparado, ativado só no cutover.
- **Pacotes compartilhados** (`content`/`analytics`) nascem aqui mas servem todos os módulos → contrato estável e versionado.

## Arquivos afetados (por módulo/pacote)

| Caminho | F | Natureza |
|---|---|---|
| `specs/008-site-foundation/*` | F1 | spec/plan/tasks (este passo) |
| `docs/agents/wp-content-inventory.md` | F1 | levantamento (✅) |
| `.specify/memory/decisions.md` | F1 | D044–D047 (✅) |
| `apps/site/` (frontend Vite + backend Express) | F2 | novo módulo (contrato add-module) |
| `apps/site/backend/db/migrations/*` | F2 | schema store (Kysely/PG16) |
| `apps/site/backend/src/importer/*` | F3 | importador REST one-shot (descartável) |
| `packages/content/` | F5 | novo pacote (meta/sitemap/robots/JSON-LD) |
| `packages/analytics/` | F6 | novo pacote (GA4 cross D020) |
| `.github/workflows/deploy-site.yml` | F7 | deploy canônico via `_deploy-module.yml` (env=beta) |
| `apps/site/docker-compose.*.yml` | F7 | container + `artificio_net` |
| `pnpm-workspace.yaml` / `turbo.json` | F2 | registrar app/pacotes novos |

## Contratos/interfaces tocados

- **Auth/accounts:** consome (não altera) o SSO — `@artificio/auth` (`verifyToken`/`requireAuth`/`logout`). Admin do site (rebuild trigger) protegido por `role==='admin'`. **Não quebrar a sessão compartilhada** (regra pétrea).
- **Subdomínio/DNS:** `beta.artificiorpg.com` → container do site via Cloudflare Tunnel (ingress hostname→container). Raiz `artificiorpg.com` **não tocada** (WP). DNS = ação do mantenedor.
- **Schema:** novo DB do site (próprio, na `artificio_net`); não compartilha schema com mesas/accounts.
- **Pacotes novos** (`content`/`analytics`): API pública estável; outros módulos passam a depender → mudança futura = breaking, exige cuidado.
- **Cookie raiz:** GA4 usa `cookie_domain=.artificiorpg.com` (D020); não colidir com cookie de sessão `artificio_session`.

## Impacto em consumidores

- `packages/content` e `packages/analytics` serão consumidos por **todos os módulos** (mesas/glossário/esferas/srd) depois → desenhar API mínima e estável agora evita refactor cross-módulo.
- `@artificio/ui` e `@artificio/auth`: o site é mais um consumidor; valida o contrato `add-module` para um módulo **novo** (vs mesas que foi importado do legado).
- WP da raiz: **zero impacto** (read-only). Usuários do site WP continuam vendo o WP até o cutover.

## Rollback

- **F1–F6** são código no monorepo (branch `dev`); rollback = reverter PR. Nada em produção.
- **F7 (deploy beta):** snapshot DB pré-deploy + rollback de containers/banco (padrão D039/D041). `beta.` é isolado; rollback não afeta mesas/accounts/glossário nem o WP.
- **Importador (F3):** roda contra DB do site (sandbox/beta), **nunca** escreve no WP. Re-rodável (idempotente por slug); em falha, truncar tabelas do store e reimportar.
- **WP:** nada a reverter — só leitura.

## Validação (como provo que funciona)

- **Build/test:** `turbo build` + testes por pacote verdes antes de qualquer SSH (padrão D039).
- **Paridade do import:** relatório automático (R9) — contagem origem vs store, diff de slugs, 0 perdas (CA2).
- **SEO:** sitemap/robots válidos; JSON-LD no Rich Results Test; script que cruza todo slug WP → destino (post/page/301), falha se algum slug ficar órfão (CA4/R15).
- **Sanitização:** teste que injeta `<script>`/`onerror`/iframe no HTML de entrada e verifica remoção (CA3/R6).
- **Smoke beta (Gate D):** home 200, `/blog/<slug>/` 200, sitemap.xml 200, rota inexistente 404, login redireciona p/ `accounts.`, GA4 dispara (CA5).
- **WP inalterado:** diff de resposta de `artificiorpg.com` antes/depois (CA6).
- **Gate D:** Opus valida smoke + paridade + SEO antes de marcar o módulo.

## Sequência e dependências

- F2 (store) bloqueia F3 (importer) e F4 (SSG).
- F5 (content) e F6 (analytics) são paralelizáveis a F4.
- F7 (deploy) depende de F2+F4 mínimos (pode subir esqueleto antes do import completo).
- Agente `wp-importer` conduz F3; agente `seo-usability-auditor` valida F5/F7 (gate SEO).
- Cada fase grande pode virar **spec-filha** (ex.: `009-site-importer`, `010-site-ssg`) se o detalhe exigir.

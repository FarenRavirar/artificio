# Plano — 080

## Arquitetura da solução

**Sitemap dinâmico (mesas, glossario):**
- Nova rota backend `GET /sitemap.xml` em cada app (`apps/mesas/backend/src/routes/sitemap.ts`, `apps/glossario/backend/src/routes/sitemap.ts`), montada em `server.ts` sem prefixo (`app.use('/', sitemapRoutes)` ou rota direta).
- Query no banco: mesas publicadas ativas (mesas) / verbetes publicados (glossario) → array de `{ loc, lastmod }` → `sitemapXml()` de `packages/content/src/sitemap.ts` (reaproveitar, não reescrever).
- Cache curto em memória (padrão já usado em `og.ts`: `CACHE_TTL_MS`) pra não bater no banco a cada crawl.

**Pré-requisito descoberto em implementação — `@artificio/content` precisa ser consumível por CJS e ESM:**
`apps/mesas/backend` é ESM, importa `@artificio/content` direto. `apps/glossario/backend` é CommonJS — pacote ESM-only não é importável lá sem erro de resolução. Correção: dar a `@artificio/content` build dupla (`dist/` ESM + `dist-cjs/` CJS), no mesmo padrão que `@artificio/feedback` já usa no monorepo. Ao implementar, apareceu problema em cadeia: `content/src/site.ts` importa `@artificio/config`, que só declara `exports` moderno (sem `main`/`types` legados) — inconsistente com a resolução `node10` que o build CJS exige pra emitir CommonJS de verdade (`node10` não lê `exports` map, só campos legados). Correção raiz avaliada: adicionar `main`+`types` legados em `@artificio/config/package.json`, aditivo ao `exports` moderno existente (dual-publishing, padrão documentado do ecossistema Node/TS — não workaround). Decisão final e aplicação ainda pendentes no momento deste registro; ver `tasks.md` Fase 1a para o estado exato e o histórico de tentativas.

**Sitemap site (Astro):** investigar por que `/sitemap.xml` 404 (se ainda 404 — reconfirmar primeiro). Provável causa: `@astrojs/sitemap` gera só `sitemap-index.xml` + `sitemap-N.xml`, e `robots.txt`/expectativa aponta pro nome errado. Corrigir referência no `robots.txt` do site pro nome real gerado, OU configurar astro pra também servir `/sitemap.xml` — decidir pela investigação, não assumir.

**Open Graph:**
- Mesas: já tem `apps/mesas/backend/src/routes/og.ts` com `/og/:type/:slug`. Investigar se o SPA real usa essa rota pra bots (provável: precisa de detecção de user-agent de bot no `server.ts`/nginx, servindo `/og/...` em vez do `index.html` puro pra crawlers de social media). Se não existir esse roteamento por UA, é o gap raiz do "OG não funciona".
- Glossario: replicar o padrão de `og.ts` de mesas (SSR meta tags por verbete) — é o app mais simples, menor escopo.
- Site: auditar página real (view-source em produção) pra confirmar se Astro já renderiza `og:title`/`og:description`/`og:image` corretamente (Astro SSR deveria fazer isso nativo se o template tiver as tags) — provavelmente só falta o template ter as tags, sem precisar de rota especial (site não é SPA client-side puro).

**GSC verification:**
- Método recomendado: meta tag `google-site-verification` no `<head>` de cada app (mais simples que DNS TXT pra subdomínio, e site/mesas/glossario já servem HTML controlável). Mantenedor gera o código de verificação no dashboard GSC — spec só entrega onde colar (index.html de cada app / template Astro).

## Arquivos afetados (por módulo/pacote)

- `apps/mesas/backend/src/routes/sitemap.ts` (novo)
- `apps/mesas/backend/src/server.ts` (registrar rota)
- `apps/mesas/frontend/index.html` (meta tag GSC)
- `apps/mesas/backend/src/routes/og.ts` (possível extensão: garantir cobertura de todos os tipos de mesa)
- `apps/glossario/backend/src/routes/sitemap.ts` (novo)
- `apps/glossario/backend/src/routes/og.ts` (novo, espelhando mesas)
- `apps/glossario/backend/src/server.ts` (registrar rotas)
- `apps/glossario/frontend/index.html` (meta tag GSC)
- `apps/site/*` (investigar template Astro de meta tags + `robots.txt`; arquivo exato depende do achado)
- `packages/content/src/sitemap.ts` (reaproveitar; só editar se achado exigir, com aprovação — é pacote compartilhado)

## Contratos/interfaces tocados

- Nenhuma mudança em auth/accounts/SSO.
- Nenhuma mudança de schema de banco (leitura apenas — sitemap/OG consultam dados existentes).
- Se `packages/content/src/sitemap.ts` precisar de ajuste: checar consumidores antes (grep `sitemapXml` em todo o repo) — hoje só teórico, confirmar na implementação.

## Impacto em consumidores

- Rotas novas (`/sitemap.xml`, `/og/...` em glossario) são aditivas, sem quebrar nada existente.
- Meta tag GSC é aditiva no `<head>`.

## Rollback

- Rotas novas: reverter commit/remover rota, sem efeito em dado (só leitura).
- Meta tag GSC: remover linha, sem efeito funcional (só quebra verificação, não quebra app).

## Validação (como provo que funciona)

- `curl -s https://mesas.artificiorpg.com/sitemap.xml` e equivalente glossario/site → XML válido, 200, contém URLs esperadas.
- Facebook Sharing Debugger ou Discord/WhatsApp real: colar link de mesa/verbete/página → screenshot do preview com título/imagem corretos.
- `robots.txt` continua `Allow: /` nos 3 apps (regressão check).
- GSC dashboard mostra propriedade verificada (mantenedor confirma, fora do repo).

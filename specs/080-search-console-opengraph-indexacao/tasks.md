# Tasks — 080

## Fase 0 — Investigação (antes de codar) — CONCLUÍDA 2026-07-17

- [x] T0.1 — `artificiorpg.com/sitemap.xml` = 404 real (confirma gap ainda aberto). `/sitemap-index.xml` = 200, `robots.txt` já aponta pro nome certo (`sitemap-index.xml`, não `sitemap.xml`). Sitemap **funciona de fato** via `sitemap-index.xml` → `sitemap-0.xml` com conteúdo completo (blog, categorias). **Ação real necessária: nenhuma** — é só nomenclatura, GSC aceita `sitemap-index.xml` normalmente. `BL-SITE-PRINCIPAL-GAPS` item D pode fechar como "não é bug, é o nome esperado do Astro".
- [x] T0.2 — `og.ts` de mesas **já funciona 100%** em produção. `nginx.conf` já detecta bot por user-agent (`$is_crawler`, lista Discordbot/WhatsApp/Facebook/etc) e já roteia pro backend `/og/:type/:slug`. Confirmado com `curl -A "Discordbot/2.0" https://mesas.artificiorpg.com/mesas/<slug>` → título/imagem/descrição corretos da mesa real. **Fase 4 vira só validação (T4.2), sem código novo.**
- [x] T0.3 — Site: OG já funciona (confirmado via `document.querySelector` em página real de blog — title/description/image/canonical corretos, Cloudinary image real). Falta só `google-site-verification` (confirmado ausente). **Fase 6 vira não-aplicável — só GSC tag, que já é Fase 7.**
- [x] T0.4 — Não perguntado ainda (não bloqueou o resto da investigação); resultado real substitui a pergunta — `BL-SITE-PRINCIPAL-GAPS` item D é resolvível como "não-bug" nesta spec (T8.2).

**Glossario (checado fora do escopo original de T0, mas necessário pra Fases 2/5):**
- `glossario.artificiorpg.com/sitemap.xml` retorna 200 mas é fallback SPA (`<!doctype html>`, não XML) — gap real confirmado, Fase 2 segue como planejada.
- OG glossario: só tag genérica (`og:title` fixo, sem `og:image`, sem descrição dinâmica) — sem infra tipo `og.ts`. Gap real confirmado, Fase 5 segue como planejada.
- GSC: `google-site-verification` ausente em mesas e glossario (confirmado); site idem.

**Resumo do escopo real pós-investigação:** trabalho de código fica concentrado em **glossario** (sitemap.ts + og.ts, do zero) e **GSC tags** nos 3 apps. Mesas e site não precisam de código de OG/sitemap novo — só validação + GSC tag.

## Fase 1a — Pré-requisito: modernizar Glossário para ESM — CONCLUÍDA LOCALMENTE

**Decisão corrigida pelo mantenedor (2026-07-17):** não perpetuar CommonJS nem adicionar exports/fallbacks legados. `apps/glossario/backend` migrou para `type: module` + `NodeNext`; imports relativos e `__dirname` foram modernizados. `@artificio/content` permanece ESM moderno, sem `dist-cjs`. Build, lint e 22 testes verdes.

**Contexto:** `packages/content` (pacote SEO já existente, tem `sitemapXml()` pronto) só publicava build ESM (`"type": "module"`, `exports` só com `import`). `apps/mesas/backend` é ESM (`NodeNext`), consegue importar direto. `apps/glossario/backend` é **CommonJS** (`"type": "commonjs"`, `tsconfig` com `module: "CommonJS"`) — não consegue importar pacote ESM-only sem erro de resolução.

**Decisão do mantenedor (2026-07-17):** corrigir a causa raiz agora, sem gambiarra/workaround temporário — não "cada app implementa sitemap inline" nem fallback improvisado só pra destravar.

**Caminho de correção (em andamento):**
1. Adicionar dependência `@artificio/content` em `apps/mesas/backend/package.json` e `apps/glossario/backend/package.json` — feito.
2. Dar a `@artificio/content` uma build dupla ESM+CJS, no mesmo padrão que `@artificio/feedback` já usa no monorepo (`dist/` ESM + `dist-cjs/` CJS, `exports` com `import`/`require`, script `build` gera os dois) — `package.json`, `tsconfig.cjs.json` criados, replicando o padrão de `packages/feedback`.
3. **Bug achado nesse processo:** build CJS de `content` falha — `site.ts` importa `@artificio/config`, e a resolução `moduleResolution: "node10"` (exigida pelo TS pra emitir CJS clássico) **não lê o campo `exports` do `package.json`** de `@artificio/config` (só lê `main`/`types` legados, que `@artificio/config` não declara, só tem `exports` moderno). `@artificio/feedback` nunca bateu nisso porque não importa nenhum outro pacote workspace.
4. Tentativa 1 (revertida): adicionar `main`/`types` top-level em `@artificio/config/package.json` como fallback — funcionalmente correto (é o padrão de dual-publishing documentado do Node/TS, dado que `dist/` já existe do build ESM), mas parei porque o mantenedor pediu explicitamente pra não fazer gambiarra e confirmar antes.
5. Tentativa 2 (revertida): trocar `moduleResolution` do `tsconfig.cjs.json` de `content` pra `Node16` (lê `exports` map moderno) — TS exige `module` e `moduleResolution` pareados como `Node16`/`Node16`; mudei os dois, mas o `tsc` então emite sintaxe ESM mesmo com `module: "Node16"` porque decide pelo `package.json` mais próximo do **arquivo fonte** (`src/`, que herda `"type": "module"` da raiz do pacote), não do `outDir`. Escrever `dist-cjs/package.json` com `type:commonjs` antes do `tsc` não muda esse comportamento (só afeta como Node interpreta o `.js` gerado em runtime, não a sintaxe que o `tsc` decide emitir em compile-time).
6. Estado no momento da pausa: `tsconfig.cjs.json` de `content` revertido pro padrão `CommonJS`/`node10` (igual `feedback`, que comprovadamente emite CJS real — `"use strict"`, `exports.x`). **Falta decidir e aplicar a correção real pra resolução de `@artificio/config` sob `node10`** antes de re-buildar `content` e prosseguir.

**Próximo passo concreto:** confirmar com o mantenedor se a correção certa é (a) adicionar `main`+`types` legados em `@artificio/config/package.json` (dual-publish, aditivo, não quebra `exports` moderno — é o padrão oficial do ecossistema pra este exato problema), ou (b) outra abordagem. Não prosseguir pra Fase 1/2 sem isso resolvido, já que ambas dependem de `@artificio/content` importável nos dois formatos.

## Fase 1 — Sitemap mesas (bloqueada por Fase 1a)

- [x] T1.1 — Criar `apps/mesas/backend/src/routes/sitemap.ts` usando `sitemapXml()` de `packages/content/src/sitemap.ts`, consultando mesas publicadas ativas.
- [x] T1.2 — Registrar rota em `server.ts`, sem exigir auth.
- [ ] T1.3 — Smoke: `curl` local/beta retorna XML válido com mesas reais.

## Fase 2 — Sitemap glossario (bloqueada por Fase 1a)

- [x] T2.1 — Criar rota sitemap, consultando somente verbetes verificados.
- [x] T2.2 — Registrar rota em `index.ts` e proxy exato no nginx.
- [ ] T2.3 — Smoke: `curl` local/beta retorna XML válido.

## Fase 3 — Sitemap site — NÃO-APLICÁVEL (T0.1 confirmou que já funciona)

- [x] T3.1 — Sem ação de código. `sitemap-index.xml` já é servido corretamente e já é o que `robots.txt` referencia.
- [ ] T3.2 — Registrar em `BL-SITE-PRINCIPAL-GAPS` que o item D não é bug real (T8.2).

## Fase 4 — Open Graph mesas (T0.2 confirmou meta tags OK; Facebook Debugger achou gap extra)

- Achado extra (mantenedor, 2026-07-17): Facebook Sharing Debugger em `mesas.artificiorpg.com` (home) — sem aviso de `og:image` (já explícito, correto), mas aviso "Propriedades ausentes: fb:app_id" (propriedade obrigatória do Facebook Debugger, não crítica pra WhatsApp/Discord, mas Facebook pede).
- [ ] T4.1 — Avaliar se cria Facebook App só pra obter `fb:app_id` (baixo valor sem uso de Facebook Login/Insights) — perguntar ao mantenedor se vale o esforço ou se ignora o aviso (produto não usa Facebook API, só compartilhamento).
- [ ] T4.2 — Smoke real: colar link de mesa publicada no Discord/WhatsApp (app real, não curl), confirmar preview com título/descrição/imagem.

## Fase 5 — Open Graph glossario (gap real confirmado em T0 + Facebook Sharing Debugger)

- Achado extra (mantenedor, 2026-07-17): Facebook Sharing Debugger em `glossario.artificiorpg.com` confirma aviso "Propriedade inferida — a propriedade og:image deve ser fornecida explicitamente". Bate com achado T0 (glossario só tem `og:title` fixo, sem `og:image`/`og:description` dinâmicos).
- [x] T5.1 — Criar rota OG SSR por verbete verificado, com imagem fallback explícita.
- [x] T5.2 — Adicionar detecção de bot por user-agent + proxy no nginx do glossario.
- [ ] T5.3 — Smoke real: colar link de verbete no Discord/WhatsApp + Facebook Sharing Debugger, confirmar preview sem aviso de propriedade inferida.

## Fase 6 — Open Graph site (achado do mantenedor reconferido via curl — só a home/índice do blog tem gap, artigos não)

- Achado extra (mantenedor, 2026-07-17): Facebook Sharing Debugger em `artificiorpg.com` (redireciona pro canonical `/blog/`, índice) mostra "Propriedade inferida — og:image deve ser fornecida explicitamente".
- **Reconferido via curl** (2026-07-17): página de artigo real (`/blog/como-anunciar-mesa-de-rpg/`) **já tem `og:image` explícito** (`<meta property="og:image" content="https://res.cloudinary.com/...">`), confirma achado T0.3 original. O gap do Debugger é específico da rota `/blog/` (página-índice), que provavelmente não define `og:image` de artigo nenhum (não tem imagem "dona" natural) — precisa confirmar com curl na própria `/blog/` antes de decidir fix.
- [x] T6.0 — `curl https://artificiorpg.com/blog/` confirmado: **zero `og:image`** na página (grep vazio). Gap real, não é falso-positivo do Debugger.
- [x] T6.1 — Adicionar `og:image` fallback fixo no `Base.astro`; páginas com imagem própria continuam sobrescrevendo.
- [ ] T6.2 — Smoke real: colar link de `/blog/` e de artigo individual no Discord/WhatsApp + Facebook Sharing Debugger, confirmar preview sem aviso de propriedade inferida em nenhum dos dois.

## Fase 7 — GSC verification

- **Achado confirmado (mantenedor, 2026-07-17, screenshot GSC dashboard "Arquivos robots.txt"):** propriedades GSC hoje cadastradas são `glossariorpg.artificiorpg.com` (domínio nunca buscado desde 18/06/2026 — é o alias histórico pré-monorepo documentado em `AGENTS.md` como "não é hostname ativo a preservar") e `accounts.artificiorpg.com` (robots.txt 404 — accounts é SSO interno, não devia nem estar no GSC). **Nem `mesas.artificiorpg.com` nem `glossario.artificiorpg.com` (nomes corretos/ativos) têm propriedade GSC cadastrada.** Confirma a pergunta original do mantenedor: GSC realmente não pega mesas/glossario hoje — porque a propriedade certa nunca foi criada, não só por falta de sitemap/verificação técnica.
- [ ] T7.0 — Mantenedor decide: remove/ignora propriedades obsoletas (`glossariorpg.`, `accounts.`) e cria as 4 propriedades corretas (`artificiorpg.com`, `mesas.`, `glossario.`, e demais subdomínios ativos conforme roadmap) — ação no dashboard GSC, fora do repo.
- [x] T7.1 — Não aplicável: propriedade de domínio `artificiorpg.com` já verificada por DNS cobre raiz e todos os subdomínios; nenhum código meta individual necessário.
- [x] T7.2 — Não aplicável pelo mesmo motivo; evitar tags redundantes.
- [x] T7.3 — Propriedade de domínio confirmada no dashboard GSC pelo mantenedor em 2026-07-17.
- [ ] T7.4 — Mantenedor submete os 3 sitemaps no GSC (fora do repo, ação humana).

## Fase 8 — Fechamento

### Correções de revisão PR #174 (2026-07-17)

- [x] Mesas migrado integralmente para ESM/NodeNext; imports relativos e cinco usos de `__dirname` atualizados. Remove o runtime CommonJS que impediria `@artificio/content` ESM.
- [x] Imagens runtime Mesas/Glossário copiam `packages/content/dist`.
- [x] OG Glossário gera documento HTML próprio; não depende de arquivo frontend ausente no container. Cache público curto aplicado.
- [x] Nginx Glossário intercepta crawler somente em `/termo/`; demais rotas continuam fallback SPA. Nginx Mesas passa headers proxy completos no sitemap.
- [x] Nota inline sobre `String.replace` descartada: rota não faz mais replace de HTML, portanto não existe interpretação de `$` em metadata.
- [x] Guard CLI de `processLinkMetadataJobs` migrado de `require.main` para `import.meta.url`; backend Mesas ESM inicia sem `require` indefinido.
- [x] Sitemap Glossário não lista mais `/termo/:id`: a SPA ainda não possui rota pública de detalhe; URLs serão incluídas quando a página real existir.

- [x] T8.1 — `verify:api`, `pnpm run lint` e `pnpm run build` verdes localmente (2026-07-17).
- [ ] T8.2 — Atualizar `specs/backlog.md`: fechar/ajustar `BL-SITE-PRINCIPAL-GAPS` item D e `BL-SITE-CUTOVER-029` T10 conforme resultado real.
- [ ] T8.3 — Atualizar `project-state.md` se mudar estado operacional.
- [ ] T8.4 — Registrar sessão em `sessoes/` com evidência de todos os smokes reais (screenshots de preview, curl outputs).

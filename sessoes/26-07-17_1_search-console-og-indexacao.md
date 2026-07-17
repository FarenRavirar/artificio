# Sessão 26-07-17_1 — Search Console + Open Graph + indexação (spec 080)

**Objetivo:** corrigir sitemap/OG/GSC pros 3 apps públicos (site, mesas, glossario).
**App/projeto:** mesas, glossario, site
**Gate:** D

## Vínculos

- Spec: `specs/080-search-console-opengraph-indexacao/`
- Motivada por pergunta do mantenedor sobre GSC não achar glossario/mesas.

## Plano

Ver `specs/080-search-console-opengraph-indexacao/plan.md`. Fase 0 = investigação (sem código), depois sitemap → OG → GSC.

## Estado

- **Retomada Codex 2026-07-17:** objetivo nominal = terminar spec 080. Próximo bloco: concluir dual publish `config/content`, implementar sitemaps Mesas/Glossário, OG dinâmico Glossário, fallback OG Site; depois validações locais/repo-wide e levantar somente gates externos GSC/smoke humano. Arquivo alheio `.claude/settings.local.json` preservado.

- Spec criada (spec.md + plan.md + tasks.md), sem commit.
- Branch atual (`fix/mesas-import-texto-fase6`) tem mudança pendente não commitada em `specs/079-mesas-import-texto-polimento/tasks.md` (correção de doc do T6.3, fora do escopo desta sessão) — não tocar, não é desta spec.
- **Fase 0 (investigação) concluída** via curl real + browser (site/mesas em produção). Achados:
  - Site: sitemap (`sitemap-index.xml`) e OG já funcionam de fato. `/sitemap.xml` puro é 404 mas não é bug — `robots.txt` já referencia o nome certo. `BL-SITE-PRINCIPAL-GAPS` item D parece não ser mais problema real.
  - Mesas: OG já funciona de fato (nginx detecta bot por UA, roteia pro backend `og.ts`, confirmado com `curl -A Discordbot`). Sitemap real (`/sitemap.xml`) ainda é gap — SPA fallback, não XML.
  - Glossario: sitemap `/sitemap.xml` é fallback SPA (gap real). OG é só tag genérica, sem infra tipo `og.ts` (gap real).
  - Nenhum dos 3 tem `google-site-verification` (GSC) configurado.
  - Escopo real de código ficou menor que o previsto: principal trabalho é sitemap+OG pra glossario (do zero) + sitemap pra mesas + GSC tag nos 3.
- Mantenedor achou mais 3 gaps reais via Facebook Sharing Debugger (og:image inferido em glossario e em `/blog/` do site; fb:app_id ausente em mesas) e 1 gap crítico via GSC dashboard (propriedades cadastradas são `glossariorpg.` e `accounts.` — nenhuma é mesas/glossario reais). Todos registrados em `tasks.md` Fases 5/6/7 com evidência.
- Mantenedor autorizou início de implementação (edição de arquivo local, sem commit/push/PR).
- Branch `feat/080-search-console-og-indexacao` criada a partir de `origin/dev` sincronizado. Mudança pendente de `specs/079-.../tasks.md` (outra spec) ficou de fora — revertida nesta branch antes de prosseguir.
- **Fase 1a (pré-requisito, bloqueante) iniciada e em andamento — bug de infra achado durante implementação:**
  - `@artificio/content` (pacote SEO, tem `sitemapXml()` pronto) é ESM-only. `glossario/backend` é CommonJS, não consegue importar.
  - Dependência `@artificio/content` adicionada em `mesas/backend` e `glossario/backend` package.json.
  - Tentativa de dar build dual ESM+CJS a `content` (padrão já usado por `packages/feedback`) expôs bug em cadeia: `content/src/site.ts` importa `@artificio/config`, que só declara `exports` moderno — `moduleResolution: node10` (exigida pra emitir CJS clássico) não lê `exports` map, só `main`/`types` legados, que `config` não tem.
  - 2 tentativas de correção feitas e **revertidas** por decisão do mantenedor ("sem gambiarra, se precisar atualizar pacote, atualiza direito"): (1) adicionar `main`/`types` fallback em `config` — revertida a pedido antes de confirmar como definitiva; (2) trocar `moduleResolution` pra `Node16` no `tsconfig.cjs.json` de `content` — não funcionou tecnicamente (`tsc` decide sintaxe ESM/CJS pelo `package.json` mais próximo do arquivo-fonte, não do outDir; `dist-cjs/package.json` com `type:commonjs` escrito antes não muda isso).
  - Estado atual: `tsconfig.cjs.json` de `content` revertido pro padrão original (`CommonJS`/`node10`, igual `feedback`, que comprovadamente emite CJS real). Falta decidir a correção definitiva pra `@artificio/config` ser resolvível sob `node10` — provável caminho é dual-publish (`main`+`types` legados, aditivo ao `exports` existente), mas não confirmado/aplicado ainda.
  - Achados completos, decisões e histórico de tentativas: `specs/080-search-console-opengraph-indexacao/tasks.md` Fase 1a; arquitetura: `plan.md`.

## Checklist de fechamento

- [x] Glossário modernizado de CommonJS para ESM/NodeNext; consumidores/imports relativos atualizados; nenhum fallback legado adicionado a `config/content`.
- [x] Sitemap Mesas + Glossário implementados e proxied; OG Glossário implementado; fallback OG Site adicionado.
- [x] `verify:api`, lint repo-wide, build repo-wide e 22 testes Glossário verdes.
- [x] GSC esclarecido: propriedade de domínio `artificiorpg.com` já verificada por DNS cobre subdomínios; meta tags descartadas. Sitemap Site confirmado publicamente como XML 200 em `sitemap-index.xml`; mantenedor iniciou submissão no dashboard.
- [ ] Bloqueios externos restantes: deploy beta, smokes reais e submissão dos sitemaps Mesas/Glossário após deploy.

- [x] Fase 0 investigação completa (T0.1-T0.4, achados registrados em `tasks.md`)
- [ ] Fase 1a: `@artificio/content` consumível por CJS+ESM (bloqueante, em andamento — decisão de correção de `@artificio/config` pendente)
- [ ] Fases 1,2,5,7 implementação (glossario sitemap+OG, mesas sitemap, GSC tags — bloqueadas por Fase 1a)
- [ ] Fases 4,6 validação real de OG (Discord/WhatsApp) mesas/site — sem código, não bloqueadas
- [ ] Fase 8 fechamento (lint/build, backlog, project-state)

## Critério de conclusão

Ver `specs/080-search-console-opengraph-indexacao/spec.md` — critérios de aceite.

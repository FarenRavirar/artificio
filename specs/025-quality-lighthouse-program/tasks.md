# Tasks — 025

- [x] T1 — Harness Lighthouse limpo e executavel · feito quando: `pnpm quality:lighthouse --url https://beta.artificiorpg.com/ --profile mobile --runs 1` roda de ponta a ponta em ambiente limpo, salvando JSON/HTML e `summary.json`. Fechado em 2026-06-16.
  - [x] T1a — Script/config criados: `scripts/quality/lighthouse-harness.mjs` + `pnpm quality:lighthouse`, mobile+desktop, 3 repeticoes, perfil temporario sem extensoes, artefatos e mediana.
  - [x] T1b — Dependencia/binario disponivel: `lighthouse` instalado como devDependency root (`pnpm add -Dw lighthouse`).
  - [x] T1c — Smoke real minimo: `pnpm quality:lighthouse --url https://beta.artificiorpg.com/ --profile mobile --runs 1 --out artifacts/lighthouse/smoke-025-t1` gerou JSON/HTML/trace/devtoolslog/`summary.json`.
- [x] T2 — Baseline limpo dos betas · feito quando: `pnpm quality:lighthouse --out artifacts/lighthouse/baseline-025-<data>` roda default completo (`beta`, `glossariobeta`, `mesasbeta`; mobile+desktop; 3 repeticoes), `summary.json` e achados comparaveis sao registrados em documento da spec. Fechado em 2026-06-16: ver `baseline-2026-06-16.md`.
- [ ] T3 — Site imagens · feito quando: cards/posts/footer do site reservam dimensoes, usam tamanhos adequados e reduzem transferencia/LCP sem quebrar zero-JS.
- [ ] T4 — Shell/CLS · feito quando: logos/footer/header/session reservam espaco em Astro e React; CLS regressivo fica coberto por teste/smoke. Parcial local 2026-06-16: glossario renderiza badge/landing desde o primeiro paint e reserva tamanho do footer logo no consumidor; build verde; Lighthouse local mobile com API beta configurada caiu para CLS 0.0002. Falta validar em `glossariobeta` apos deploy.
- [ ] T5 — Robots/SEO hosts · feito quando: `robots.txt` por host retorna texto valido, content-type correto, sem SPA fallback indevido, e sitemap/canonical continuam corretos.
- [ ] T6 — Acessibilidade transversal · feito quando: contraste, nomes acessiveis, links repetidos e touch targets dos achados Lighthouse ficam corrigidos ou viram debito especifico.
- [ ] T7 — Glossario performance · feito quando: bundle inicial e `/api/terms` deixam de bloquear primeira renderizacao; busca/termos seguem corretos.
- [ ] T8 — Mesas performance · feito quando: bundle inicial/main-thread/CSS unused caem sem quebrar catalogo, login e painel.
- [ ] T9 — Headers e terceiros · feito quando: contrato CSP/HSTS/COOP/XFO/Permissions/Trusted Types e scripts permitidos estao documentados, testados e sem quebrar apps.
- [ ] T-final — Atualizar `specs/backlog.md`, sessao e `project-state.md` · feito quando: pendencias novas/fechadas estao refletidas no mapa geral e na memoria operacional.

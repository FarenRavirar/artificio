# Sessao 26-06-15_7 — Lighthouse quality specs

- **Data:** 2026-06-15
- **Objetivo:** analisar anexos Lighthouse, definir specs/debitos para resolver performance/acessibilidade/best-practices/SEO sem chute.
- **Escopo:** documentacao/specs/backlog; leitura de anexos e codigo local relevante; sem codigo runtime.
- **Gate:** Gate C/WP raiz intocaveis. Sem VM/prod/deploy.
- **Restricoes:** sem Chrome; sem commit/push; nao sobrescrever diff local B12/B3/B4.

## Pergunta-guia
- Compartilhar o atual ou o possivel?
- Resposta a registrar: compartilhar o **contrato comum real e aprovado**, com extensoes orientadas por evidencia. Nao copiar CSS local bruto nem criar mega-design-system especulativo. Quando o Lighthouse/produto exigir padrao novo, promover para `packages/ui` por spec/fatia, com consumidor real e teste.

## Plano
- [x] Ler anexos Lighthouse completos.
- [x] Extrair problemas por categoria e pagina.
- [x] Cruzar com specs/backlog existentes.
- [x] Definir spec(s) e debitos para as proximas semanas.
- [x] Registrar docs e validação.

## Evidencia dos anexos
- `mesasbeta`: Performance 43 / A11y 91 / Best Practices 77 / SEO 92. Problemas de primeira parte: CSS render-blocking, JS inicial ~309 KiB, unused JS ~303 KiB, TBT 6140ms, imagens ~530 KiB savings, robots 42 erros, contraste/touch targets/links, headers.
- `glossariobeta`: Performance 5 / A11y 90 / Best Practices 73 / SEO 92. Problemas de primeira parte: JS inicial ~1.14 MiB, `/api/terms` ~612 KiB no caminho critico, CLS 0.652 no footer/logo/session, Google Fonts visto no relatorio mas nao confirmado no codigo atual, unused JS ~761 KiB, robots 37 erros, a11y/headers.
- `beta.artificiorpg.com`: Performance 62 / A11y 95 / Best Practices 73 / SEO 100. Problemas de primeira parte: imagens Cloudinary grandes demais para cards (~472 KiB savings), footer logo sem dimensao, contraste, headers/terceiros.
- Todos os relatorios avisam extensoes/storage interferindo. Decisao: score bruto e alarme, nao baseline final. Primeiro debito = harness limpo.

## Specs/debitos criados
- Spec guarda-chuva: `specs/025-quality-lighthouse-program/`.
- Achados detalhados: `specs/025-quality-lighthouse-program/lighthouse-findings.md`.
- Backlog atualizado com:
  - `BL-QA-LH-HARNESS`
  - `BL-QA-SITE-IMAGES`
  - `BL-QA-SHELL-CLS`
  - `BL-QA-GLOSSARIO-PERF`
  - `BL-QA-MESAS-PERF`
  - `BL-QA-ROBOTS-SEO`
  - `BL-QA-SECURITY-HEADERS`
  - `BL-QA-A11Y-SWEEP`
  - `BL-QA-THIRD-PARTY`

## Cruzamento local
- `packages/ui/src/styles.css` ja nao contem `@import` Google Fonts depois da B12.
- `apps/accounts/frontend/src/styles.css` ainda contem Google Fonts; fora do shell publico/site B12, mas entra em auditoria futura se accounts for medido.
- `apps/site/src/components/SiteFooter.astro` tem logos sem `width`/`height`; `packages/ui/src/Footer.tsx` ja reserva dimensoes.
- `apps/site/src/components/Card.astro` renderiza card image sem dimensao/srcset/sizes.
- `packages/content/src/robots.ts` existe, mas robots invalido em glossario/mesas precisa prova live por host; pode ser SPA fallback/content-type/build antigo.

## Decisoes registradas
- Compartilhar o atual ou o possivel: compartilhar contrato comum real/aprovado; promover novas primitivas so com evidencia, piloto e teste.
- A proxima task recomendada e `BL-QA-LH-HARNESS` / 025 T1. Sem ela, qualquer "melhora" pode ser chute por extensao/browser.
- Backlog atualizado: sim.

## Arquivos provaveis
- `specs/025-quality-lighthouse-program/spec.md`
- `specs/025-quality-lighthouse-program/plan.md`
- `specs/025-quality-lighthouse-program/tasks.md`
- `specs/025-quality-lighthouse-program/lighthouse-findings.md`
- `specs/backlog.md`
- `sessoes/index.md`
- `.specify/memory/project-state.md` se mudar estado operacional/documental relevante.

## Criterio de conclusao
- [x] Anexos lidos e resumidos com evidencias.
- [x] Specs/debitos criados e rastreaveis.
- [x] Proximas fatias claras, pequenas, testaveis.
- [x] `git diff --check` OK.

## Validacao
- `git diff --check` OK (apenas avisos LF -> CRLF do Git no Windows).
- `rg -n "BL-QA-|Spec 025|025-quality"` confirmou referencias em backlog, T0 e sessao.

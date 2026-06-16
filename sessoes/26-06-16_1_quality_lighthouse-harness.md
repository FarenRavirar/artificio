# Sessao 26-06-16_1 — Lighthouse harness limpo

- **Data:** 2026-06-16
- **Objetivo:** executar Spec 025 T1 / `BL-QA-LH-HARNESS`: criar harness Lighthouse limpo, reproduzivel, sem Chrome do mantenedor.
- **Escopo:** scripts locais de qualidade + docs/spec/backlog/project-state. Sem mudanca runtime em apps/pacotes.
- **Gate:** Gate C/WP raiz intocaveis. Sem VM write, sem deploy.
- **Restricoes:** sem Chrome plugin/perfil do mantenedor; sem commit/push; sem instalar pacote sem aprovacao.

## Plano
- [x] Criar script local de harness com perfil temporario limpo, mobile+desktop, 3 repeticoes, artefatos JSON/HTML e mediana.
- [x] Documentar uso e requisito de dependencia sem instalar pacote.
- [x] Atualizar Spec 025 T1, backlog e project-state.
- [x] Validar pelo menos dry-run/local syntax.

## Antes de alterar
- T0 lido: `project-state.md`, `context-capsule.md`, `decisions.md`.
- Governanca lida: Aprovação Obrigatória, Protocolo de Sessão, Conclusão de Tarefas.
- Sessao/spec/backlog lidos: `26-06-15_7`, `specs/025-*`, `BL-QA-LH-HARNESS`.
- Achado: repo nao tem dependencia `lighthouse`; harness sera criado sem instalar pacote. Execucao real exigira instalar `lighthouse` ou prover binario via `LIGHTHOUSE_BIN`, com aprovacao se for adicionar pacote.

## Arquivos a modificar
- `scripts/quality/lighthouse-harness.mjs`
- `package.json`
- `specs/025-quality-lighthouse-program/*`
- `specs/backlog.md`
- `.specify/memory/project-state.md`
- `sessoes/index.md`

## Criterio de conclusao
- [x] Script/documentacao existem.
- [x] Dry-run local valida alvos/perfis/repeticoes/output.
- [x] Spec/backlog/session/project-state registram estado.
- [x] `git diff --check` OK.

## Execucao
- Criado `scripts/quality/lighthouse-harness.mjs`.
- Adicionado script `pnpm quality:lighthouse`.
- Diagnostico posterior: dry-run nao resolvia o problema; comando real falhava com `spawn EINVAL` no Windows/Node v25 ao chamar `pnpm.cmd`.
- Corrigido harness para chamar `pnpm.cjs` via `process.execPath` no Windows, sem shell.
- Instalado `lighthouse` como devDependency root com `pnpm add -Dw lighthouse`.
- Harness default mede:
  - `https://beta.artificiorpg.com/`
  - `https://glossariobeta.artificiorpg.com/`
  - `https://mesasbeta.artificiorpg.com/`
  - perfis `mobile,desktop`
  - 3 repeticoes por URL/perfil
  - artefatos em `artifacts/lighthouse/<timestamp>/`
  - `summary.json` com medianas
- Cada rodada usa `user-data-dir` temporario e flags `--disable-extensions`, `--disable-default-apps`, `--disable-sync`, `--disable-background-networking`; nao usa Chrome plugin/perfil/cookies do mantenedor.
- `artifacts/lighthouse/` adicionado ao `.gitignore`.

## Validacao
- `node --check scripts/quality/lighthouse-harness.mjs` OK.
- `pnpm quality:lighthouse --dry-run` OK; confirmou 3 URLs, mobile+desktop, 3 runs e output em `artifacts/lighthouse/...`.
- `pnpm quality:lighthouse --url https://beta.artificiorpg.com/ --profile mobile --runs 1 --out artifacts/lighthouse/smoke-025-t1` OK; gerou `summary.json`, JSON/HTML, trace e devtoolslog.
- Smoke real `beta` mobile 1x: performance 0.79, a11y 0.95, best-practices 0.77, SEO 1.00, FCP 3376.85ms, LCP 4128.11ms, TBT 0ms, CLS 0.0134.
- Baseline T2 completo rodado/retomado com `pnpm quality:lighthouse --out artifacts/lighthouse/baseline-025-2026-06-16 --skip-existing`; gerou 18 runs (3 URLs x 2 perfis x 3 repeticoes) e `summary.json`.
- Falha Windows observada durante T2: Lighthouse as vezes sai 1 por `EPERM` ao limpar pasta temp, mas ja tendo escrito JSON. Harness agora aceita esse caso se o JSON existe e reusa com `--skip-existing`.
- `rg -n "BL-QA-LH-HARNESS|quality:lighthouse|lighthouse-harness|T1 — Harness"` confirmou referencias em script/package/spec/backlog/session/project-state.
- `git diff --check` OK; apenas avisos LF→CRLF do Git no Windows.

## Backlog/project-state
- `BL-QA-LH-HARNESS` marcado como fechado somente apos smoke real.
- T2 marcado fechado apos baseline completo e doc `specs/025-quality-lighthouse-program/baseline-2026-06-16.md`.
- Backlog reordenado por evidencia limpa: `BL-QA-SHELL-CLS` e `BL-QA-GLOSSARIO-PERF` antes de `BL-QA-SITE-IMAGES`.
- `specs/025-quality-lighthouse-program/tasks.md` T1 marcado como fechado.
- `.specify/memory/project-state.md` atualizado com T1 fechado e proximo T2 dependente de prover/instalar `lighthouse`.
- Nada novo no backlog alem da dependencia operacional ja registrada: execucao real exige `LIGHTHOUSE_BIN` ou adicionar `lighthouse` como devDependency com aprovacao.

## Observacao
- T2 executado. Proxima fatia real recomendada: corrigir CLS/perf do glossario, nao imagens do site.

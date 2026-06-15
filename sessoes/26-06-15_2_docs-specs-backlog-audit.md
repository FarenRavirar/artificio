# Sessao 26-06-15_2 — Auditoria specs/tasks/backlog

- Data: 2026-06-15
- Escopo: governanca documental, specs, backlog, sessoes
- Spec: `specs/024-docs-specs-backlog-audit/`
- Tipo: SDD Lite documental
- Gate: nenhum
- Estado: concluída

## Objetivo
Auditar `specs/backlog.md`, `tasks.md`, `specs/README.md`, `project-state.md` e sessoes para alinhar pendencias acionaveis, fechadas, absorvidas ou obsoletas.

## Plano
- Ler T0 e mapas centrais.
- Buscar tasks abertas/pendencias sem abrir todas as specs por completo.
- Abrir arquivos completos somente quando houver risco de divergencia.
- Atualizar docs locais apos autorizacao do mantenedor.
- Validar com `git diff --check` e buscas finais.

## Arquivos a modificar
- `specs/backlog.md`
- `specs/README.md`
- `specs/024-docs-specs-backlog-audit/*`
- `sessoes/26-06-15_2_docs-specs-backlog-audit.md`
- `sessoes/index.md`
- `.specify/memory/project-state.md`, se necessario
- `AGENTS.md`, se necessario
- `.agents/skills/new-spec/SKILL.md`, se necessario

## Criterio de conclusao
- Backlog representa estado atual.
- Tasks abertas relevantes tem item no backlog ou justificativa registrada.
- Specs/sessoes nao contradizem RealIP/specs recentes.
- Regras documentais estao no topo dos arquivos certos.
- Validacao read-only verde.

## Log
- 2026-06-15 — T0 lido. `specs/README.md`, `specs/backlog.md`, `sessoes/index.md` e secoes-alvo de `AGENTS.md` lidos. Autorizacao do mantenedor concedida para atualizar docs e criar spec de auditoria. Spec 024 e esta sessao criadas antes das demais edicoes.
- 2026-06-15 — Varredura de todos os `specs/**/tasks.md` com `- [ ]` e `[~]`. Classificacao:
  - `005` T2 e hydrate: cobertos por `BL-BETA-HYDRATE` e nota de branch protection.
  - `008`/`011` site: abertos grandes cobertos por `BL-SITE-GATED` e `BL-SITE-CMS-PARITY`; Gate C/301/SEO final continuam fora do agora.
  - `009` T2-T6 estavam abertos por marca antiga, mas texto/proj-state/D050 provam feito; fechados. T9 virou `BL-DEP-CONTAINER-NAMES` futuro.
  - `007` T9 e `010` bloqueio antigo foram absorvidos por releases posteriores; docs ajustadas para nao instruir deploy antigo.
  - `013`/`014` continuam bloqueados por `BL-LINKS-013`/`BL-NAV-LINKS-014`.
  - `016` continua `BL-MESAS-EXPRESS5-016`.
  - `019` B1-B8 continuam como backlog derivado (`BL-UI-*`, `BL-CONFIG-AUTH`, `BL-ANALYTICS`, `BL-SEO-SHARED`, `BL-NORMALIZERS`, `BL-COPY-PUBLICA`, CDX-310).
  - `020` T12 fechado: `D-UX2`/`D-MARCA2` ja estao no backlog/fechados; B2/B3/B4/B6/B7/B12/B13 cobertos por linhas ativas.
  - `022` T8 duplicado fechado como substituido pela T8 consolidada; demais T2-T15 cobertos por `BL-022-*` e `BL-UI-B12-FONTS`.
  - `023` alinhado como fechado em prod; residual `BL-ACCOUNTS-PORT`.
- 2026-06-15 — Backlog atualizado: `D-FEEDBACK1` normalizado para `validacao`; `D-CONT1` e `D-MESAS-UI1` movidos para fechados/absorvidos; adicionado `BL-DEP-CONTAINER-NAMES`; `BL-DOCS-AUDIT-024` registrado como fechado. `project-state.md` alinhado: B7 nao e mais fix local, falta so E2E autenticado.
- 2026-06-15 — Validacao: `git diff --check` sem erros (apenas avisos CRLF do Windows); busca por divergencias ativas nao encontrou status ativo incorreto. Ocorrencias restantes de "fix local pendente"/D-NGINX2 aberto sao historicas em log antigo, nao instrucao ativa.

## Fechamento
- [x] `specs/backlog.md` atualizado.
- [x] `specs/README.md` atualizado.
- [x] `sessoes/index.md` atualizado.
- [x] Spec 024 criada e fechada.
- [x] `project-state.md` atualizado para remover instrucao stale do B7.
- [x] Backlog verificado; nada acionavel ficou apenas em chat.

# 046 — Sincronizacao do arquiteture.md e docs que alimentam Serena

- **Modulo/Pacote:** governanca documental (`.specify/arquiteture.md`, `docs/agents/context-capsule.md`, `.specify/memory/project-state.md`)
- **Gate relacionado:** nenhum
- **Status:** concluido (local, sem commit) · revisao cross-check + 4 correcoes D1–D4 + Serena core regenerado 2026-06-22
- **Sessao:** `sessoes/26-06-22_5_arquiteture-docs-sync.md`
- **Reviews:** reviews.md
- **Debitos:** debitos.md

## Problema

O `arquiteture.md` — fonte canonica de arquitetura e contratos tecnicos — esta desatualizado em varias secoes. Durante o onboarding do Serena (spec 044), foram encontradas discrepancias entre o documento e a realidade do monorepo. As memorias do Serena (`mem:core`, `mem:tech_stack`, etc.) foram escritas a partir do `project-state.md` + `context-capsule.md` (mais atualizados), mas o `arquiteture.md` como fonte canonica precisa refletir a verdade para futuros agentes e onboardings.

Alem disso, o `context-capsule.md` e o `project-state.md` precisam ser verificados quanto a consistencia entre si e com o `arquiteture.md` apos a correcao.

## Requisitos

- **R1:** Auditar `arquiteture.md` secao por secao (9 secoes + indice) contra a realidade do codigo, deploy e infra em 2026-06-22.
- **R2:** Corrigir discrepancias encontradas em cada secao, com aprovacao do mantenedor por secao.
- **R3:** Verificar consistencia cruzada entre `arquiteture.md`, `context-capsule.md` e `project-state.md` quanto a estrutura, stack e decisoes.
- **R4:** Atualizar `context-capsule.md` e `project-state.md` se necessario para consistencia pos-correcao.
- **R5:** Regerar memorias do Serena apos correcoes (re-onboarding ou atualizacao pontual).
- **R6:** Registrar evidencias, decisoes e pendencias na sessao e backlog.

## Criterios de aceite

- `arquiteture.md` reflete a realidade verificada do monorepo (apps, packages, infra, contratos, rotas) em 2026-06-22.
- `context-capsule.md` consistente com `arquiteture.md` pos-correcao.
- `project-state.md` consistente com `arquiteture.md` pos-correcao.
- Memorias do Serena (`mem:core`, `mem:tech_stack`, `mem:conventions`, `mem:suggested_commands`, `mem:task_completion`) atualizadas com dados corretos.
- Sessao registra auditoria completa com evidencias.
- Backlog atualizado com pendencias remanescentes.

## Fora de escopo

- Implementar apps/pacotes ausentes (downloads, esferas, srd, crosslink).
- Criar `module.manifest.ts` ou `CONTEXT.md` nos apps que nao tem.
- Alterar codigo, deploy, CI/CD ou infra.
- Commit, push, PR, merge sem aprovacao explicita (doc-only, requer pedido por acao).
- Auditoria de outros documentos alem dos listados em R3.

## Riscos e impacto em outros modulos

- Risco baixo: mudancas puramente documentais, sem impacto em runtime.
- Risco de deriva: se `arquiteture.md` nao for mantido atualizado apos esta spec, o problema se repete. Mitigacao: adicionar nota de "ultima verificacao" no topo do arquivo.
- Impacto em Serena: memorias desatualizadas podem induzir agentes a erro. Corrigir os docs-fonte resolve.

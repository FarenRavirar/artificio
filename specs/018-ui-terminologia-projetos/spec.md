# 018 — Terminologia de produto: projetos

- **Modulo/Pacote:** packages/ui + packages/content + apps/site + apps/accounts + docs de retomada/produto
- **Gate relacionado:** nenhum

## Problema
A linguagem publica ainda chama os produtos do Artificio RPG de "modulos", mas o mantenedor definiu que a comunicacao ao usuario deve usar "projetos". Ao mesmo tempo, "modulo" continua sendo termo tecnico valido na arquitetura do monorepo, nos gates, nos pipelines e em `apps/*`.

## Requisitos (numerados, testaveis)
- **R1** — UI publica compartilhada (`packages/ui`) e SEO compartilhado (`packages/content`) trocam rotulos, aria-labels e textos de produto de "modulos/modular" para "projetos".
- **R2** — Site Astro espelhado troca a mesma terminologia publica para "projetos".
- **R3** — Login do `accounts` troca o texto de onboarding para "projetos".
- **R4** — Documentacao de retomada/produto registra a decisao e usa "projetos" onde estiver falando com usuario/leitor sobre a suite. Termos tecnicos ("modulo" em arquitetura, gates, `_deploy-module`, `apps/*`, imports, Node module) permanecem.
- **R5** — Nenhum conteudo bruto importado do WordPress, doc legado do mesas ou identificador tecnico e renomeado mecanicamente.

## Criterios de aceite
- Busca final nao encontra "Modulo(s) do Artificio" nem "Hub modular" em UI publica.
- Builds/smokes locais da spec 017 continuam verdes para `packages/ui`, `apps/site`, `apps/accounts`, `apps/glossario` e `apps/mesas`.
- `project-state.md`, `context-capsule.md`, README e sessoes/specs relevantes registram D063 sem reescrever a arquitetura tecnica.

## Fora de escopo
- Renomear diretorios, packages, workflows, variaveis como `MODULES`, `_deploy-module` ou conceito tecnico de modulo no monorepo.
- Habilitar dark mode em glossario/mesas.
- Deploy/promote sem aprovacao explicita por acao.

## Riscos e impacto em outros modulos
- `packages/ui` e consumido por varios apps; a mudanca deve ser textual/aditiva e nao tocar contratos de Header/Footer/auth.
- Documentacao tecnica perde precisao se "modulo" for substituido cegamente. A regra desta spec e trocar apenas linguagem de produto e deixar o termo tecnico intacto.

# Plano — 046

## Arquitetura da solucao

Auditoria secao por secao do `arquiteture.md` contra evidencia real do monorepo. Cada secao verificada contra:

1. Estrutura de diretorios (`apps/`, `packages/`, `.github/workflows/`)
2. Arquivos de configuracao (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`)
3. Codigo fonte (imports, dependencias, contratos reais)
4. Deploy (`docker-compose.*.yml`, `Dockerfile`, workflows)
5. VM (`ssh faren` inspecao read-only quando necessario)

Ordem das secoes do `arquiteture.md`:
1. Layout do monorepo
2. Contrato de modulo
3. SSO / Auth
4. Gateway / Roteamento
5. Banco de dados
6. Conteudo / SEO / SSG
7. CI/CD / Deploy
8. Engine de crosslink (SRD ↔ Wiki)
9. Convencoes de codigo

## Arquivos afetados

- `.specify/arquiteture.md` — correcoes nas secoes com discrepancias
- `docs/agents/context-capsule.md` — possivel ajuste de consistencia
- `.specify/memory/project-state.md` — possivel ajuste de consistencia
- Memorias Serena (`serena_write_memory`) — regeneracao pos-correcao:
  - `mem:core`
  - `mem:tech_stack`
  - `mem:conventions`
  - `mem:suggested_commands`
  - `mem:task_completion`
- Serenas memory `core` references `mem:decisions` which may need creation

## Contratos/interfaces tocados

Nenhum contrato de codigo. Contratos documentais:
- `arquiteture.md` como fonte canonica de arquitetura
- `context-capsule.md` como T0 de retomada
- `project-state.md` como estado operacional

## Impacto em consumidores

- Agentes de IA (Claude Code, OpenCode, Codex): leem `arquiteture.md` e memorias Serena. Docs corretos = decisoes corretas.
- Onboarding Serena: futuros onboardings geram memorias precisas.
- Mantenedor: unica fonte de verdade consistente.

## Rollback

- `git checkout` do `arquiteture.md` anterior.
- `serena_delete_memory` + re-onboarding se necessario.

## Validacao

- `rg` / `Get-ChildItem` confirmam que cada claim do documento bate com a realidade.
- Memorias Serena verificadas com `serena_read_memory`.
- Sessao registra cada verificacao com evidencia.

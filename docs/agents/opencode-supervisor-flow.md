# Artifício Supervisor Flow (OpenCode only)

Fluxo específico do OpenCode com agente primário único `artificio-orquestrador`.
**Não se aplica ao Claude Code** — aqui o mantenedor conversa direto com o
agente, sem orquestrador intermediário. Governança pétrea comum (aprovação
por ação, T0/T1, gates) continua em `AGENTS.md`; este arquivo cobre só a
topologia de fases/subagentes própria do OpenCode.

## Regra central

O usuário conversa apenas com o orquestrador.
Subagentes trabalham em tarefas fechadas e devolvem relatório ao orquestrador.

## Fases

1. fix ou feature
2. registro
3. investigação
4. implementação
5. revisão de documentação atualizada
6. commit

O orquestrador deve pedir autorização antes de cada fase.
A autorização vale apenas para a fase e o escopo descritos.

## Bloqueios

- Jamais commitar sem autorização explícita.
- Jamais push sem autorização explícita.
- Jamais merge sem autorização explícita.
- Jamais abrir PR sem autorização explícita.
- Jamais avançar fase sem autorização explícita.
- Se houver dúvida, parar e perguntar em tom leigo com opções claras.

## Specs

Estrutura padrão:

```text
specs/NNN-<modulo>-<slug>/
  spec.md
  plan.md
  tasks.md
  reviews.md
  debitos.md
```

`reviews.md` deve receber apenas reviews externos: usuário, bots, PRs ou checks.
Achados internos de investigação, lint, build ou auditoria entram em `debitos.md`, salvo instrução explícita.

## Ferramentas preferidas

Ver seção **Ferramentas MCP / Agentes** em `AGENTS.md` (comum aos 3 clientes).
Resumo operacional:

1. `artificio-api-governance` para API.
2. LSP para diagnóstico automático.
3. `codebase-memory-mcp` para grafo/impacto.
4. `ast-grep`, `rtk rg`, `rtk read`, `git` e leitura direta.

Se essas ferramentas não estiverem disponíveis, usar fallback local e registrar a limitação.

## Comandos principais

```text
/fluxo-spec
/fix-spec
/feature-spec
/registrar-spec
/investigar-spec
/implementar-spec
/auditar-spec
/documentar-spec
/preparar-git-spec
/continuar-spec
```

## Formato final do orquestrador

Ao final de cada fase, responder com:

```md
## Estado
- Fase concluída:
- Próxima fase:
- Bloqueios ativos:

## Resultado
...

## Próximo command pronto
/<comando sugerido>
```

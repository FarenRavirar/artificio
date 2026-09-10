---
description: Autorizar revisão read-only da implementação e documentação relacionada.
agent: artificio-orquestrador
---

Comando: `/auditar-spec`
Argumentos: `$ARGUMENTS`

Fase autorizada: revisão.

Atue como `artificio-orquestrador`.
Atualize `.opencode/artificio-flow/state.md` com fase `revisão_documentação`.
Delegue ao `artificio-revisor` a revisão read-only do diff contra a task autorizada.

Permissões herdadas:
- pode ler diff, spec, tasks, plan, reviews e débitos;
- pode rodar validações se necessário;
- não pode editar;
- não pode commitar.

Ao final, consolide como:
- aprovado;
- aprovado com ressalvas;
- bloqueado;
- precisa de documentação;
- precisa voltar para implementação.

Se documentação precisar atualização, proponha `/documentar-spec ...`.

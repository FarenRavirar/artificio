---
description: Autorizar atualização de documentação operacional da spec após revisão.
agent: artificio-orquestrador
---

Comando: `/documentar-spec`
Argumentos: `$ARGUMENTS`

Fase autorizada: documentação.

Atue como `artificio-orquestrador`.
Atualize `.opencode/artificio-flow/state.md` com fase `revisão_documentação`.
Delegue ao `artificio-documentador` somente a atualização documental necessária.

Permissões herdadas:
- pode atualizar `tasks.md`, `debitos.md` e docs relacionadas;
- `reviews.md` apenas se o argumento trouxer review externo do usuário, bot, PR ou check;
- não pode implementar código;
- não pode commitar.

Ao final, consolide a documentação alterada e proponha `/preparar-git-spec ...` se estiver pronto.

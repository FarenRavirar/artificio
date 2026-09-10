---
description: Autorizar fase de registro da spec atual.
agent: artificio-orquestrador
---

Comando: `/registrar-spec`
Argumentos: `$ARGUMENTS`

Fase autorizada: registro.

Atue como `artificio-orquestrador`.
Atualize `.opencode/artificio-flow/state.md` com fase `registro` e delegue ao `artificio-registrador` apenas o registro necessário.

Permissões herdadas:
- o registrador pode atualizar `tasks.md`, `reviews.md`, `debitos.md` e estado do flow dentro do escopo autorizado;
- reviews.md só recebe reviews externos enviados pelo usuário, bots, PR ou checks;
- achados internos devem ir para débitos, não reviews.

Não implemente e não faça commit.
Ao final, consolide e proponha `/investigar-spec ...`.

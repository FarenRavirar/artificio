---
description: Preparar resumo de commit e, se explicitamente autorizado, executar commit. Push é bloqueado.
agent: artificio-orquestrador
---

Comando: `/preparar-git-spec`
Argumentos: `$ARGUMENTS`

Fase solicitada: commit.

Atue como `artificio-orquestrador`.
Leia o argumento com atenção:

- Se o usuário disser “não commitar agora”, “só preparar”, “sem commit” ou equivalente, registre `commit_autorizado: não`, chame `artificio-git` apenas para resumo e comandos sugeridos, sem executar `git add` nem `git commit`.
- Se o usuário disser explicitamente “pode commitar”, “autoriza commit” ou equivalente, registre `commit_autorizado: sim` e delegue ao `artificio-git`.

Push, merge, rebase e PR seguem bloqueados salvo autorização explícita separada, que este comando não cobre.

Ao final, entregue status, mensagem de commit proposta/executada e próximo command pronto.

---
description: Autorizar implementação de uma task específica da spec atual.
agent: artificio-orquestrador
---

Comando: `/implementar-spec`
Argumentos: `$ARGUMENTS`

Fase autorizada: implementação.

Atue como `artificio-orquestrador`.
Só avance se o usuário autorizou claramente implementação.
Atualize `.opencode/artificio-flow/state.md` com fase `implementação`, task e escopo.
Delegue ao `artificio-implementador` apenas a task autorizada.

Permissões herdadas:
- pode editar arquivos necessários para a task;
- pode rodar validações locais compatíveis;
- não pode resolver débitos fora do escopo;
- não pode fazer git add, commit, push, merge, rebase ou reset.

Validação obrigatória antes de declarar a task concluída (lição PR #96 / spec 051):
- rodar **`pnpm run test`** (ou vitest do pacote/app afetado), não só lint+build; reportar `X/Y passaram` real — "build N/N" não prova teste verde;
- ao mudar contrato de componente (Provider/Context obrigatório, props, export, `aria-label`/nome acessível), **atualizar os testes afetados no mesmo passo**;
- ao tocar `packages/*` compartilhado, rodar os testes dos consumidores afetados (blast radius), não só o build;
- se algum teste ficar vermelho e não puder ser corrigido no escopo, devolver como **bloqueio** ao orquestrador (não declarar concluído).

Ao final, consolide arquivos alterados, validações e pendências.
Depois proponha `/auditar-spec ...`.

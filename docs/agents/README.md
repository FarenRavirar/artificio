# `docs/agents/` — documentação operacional de agentes

Esta pasta é **versionada e pública** desde 2026-09-03. Antes era inteira
gitignored, o que tinha um custo real: o contrato de deploy que o `AGENTS.md`
cobra por hook não existia para quem lia o repositório.

## A divisão: procedimento aqui, alvo fora

O que separa um arquivo público de um interno não é o assunto — é se ele
**nomeia um alvo real**.

| aqui (público) | em `docs/agents-internal/` (gitignored) |
|---|---|
| como fazer o deploy | em qual caminho, em qual container |
| que `JWT_SECRET` precisa bater entre módulos | quais secrets existem e onde |
| que a senha do Postgres só grava na 1ª init | qual volume, qual usuário |

Os documentos daqui usam **placeholder**: `<CLONE_PROD>`, `<ACCOUNTS_DB>`,
`<DOCKER_NET>`, `<AUTH_DB>`, `<VM_ALIAS>`. A tradução de cada um vive em
`docs/agents-internal/values.md`, que não sai da máquina do mantenedor.

Um leitor externo aprende como a esteira funciona. Não aprende o que atacar.

## O que fica no interno, e por quê

- `infra-map.md` — inventário da VM. Sem os nomes reais não teria função.
- `access-registry.md` — quem tem acesso a quê, e onde a chave vive.
- `github-actions-secrets.md` — nomes de todos os secrets do CI e onde cada
  um é consumido. Não tem valor nenhum dentro, mas o mapa já é o alvo.
- `deploy-runbook-bootstrap.md` — a primeira subida de cada módulo:
  hostname → container → porta → volume → env.
- `values.md` — a tradução dos placeholders.

## Ao escrever aqui

Antes de commitar, conferir que nenhum caminho, hostname interno, nome de
container, subnet ou nome de secret entrou em claro. Hostname **público**
(`mesas.artificiorpg.com`) pode: o DNS já o resolve para qualquer um.

# Documentação de Domínio para Skills

Layout atual: multi-contexto SDD.

## Fontes obrigatórias

| Tema | Fonte |
|---|---|
| Governança de agente | `AGENTS.md` |
| Estado operacional | `.specify/memory/project-state.md` |
| Constituição | `.specify/memory/constitution.md` |
| Arquitetura | `.specify/arquiteture.md` por seção via busca |
| Features | `specs/{id}/` e `.specify/features/{id}/` |
| Sessões | `sessoes/*.md` |
| API | `MAPA_DE_API.md` quando rota/contrato for afetado |
| SDD | `docs/sdd/` |

## Como skills devem ler contexto

1. Começar por `.specify/memory/project-state.md` e `AGENTS.md`.
2. Usar busca antes de abrir arquivos grandes.
3. Abrir apenas seções relevantes de `.specify/arquiteture.md`.
4. Tratar docs legados em `docs/legacy/` como histórico, não como fonte canônica.
5. Nunca substituir o protocolo SDD por fluxo de skill externo.

## Linguagem de domínio

- "Mesa" é o anúncio principal de uma campanha ou one-shot.
- "Mestre" é o usuário que publica/gerencia mesas.
- "Draft Discord" é uma mesa candidata extraída de mensagem Discord, ainda não necessariamente publicável.
- "Beta" é o ambiente `dev` em `mesasbeta.artificiorpg.com`.
- "Produção" é o ambiente `main` em `mesas.artificiorpg.com`.

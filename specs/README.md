# Specs SDD — mapa geral

> Fonte de orientacao para achar specs, debitos e pendencias sem reconstruir o projeto pelo chat.

## Como usar
- Estado operacional atual: `.specify/memory/project-state.md`.
- Decisoes fechadas: `.specify/memory/decisions.md`.
- Erros conhecidos: `.specify/memory/errors.md`.
- **Pendencias acionaveis por spec/debito:** `specs/backlog.md`.
- Sessao ativa/evidencia: `sessoes/index.md` + `sessoes/*.md`.

## Regra para toda spec nova
Toda spec SDD deve:

1. Criar/atualizar `spec.md`, `plan.md`, `tasks.md`.
2. Registrar no `tasks.md` uma tarefa de manutencao do mapa logo no inicio ou no fechamento:
   `Atualizar specs/backlog.md e project-state.md`.
3. Ao abrir debito, adicionar linha em `specs/backlog.md`.
4. Ao fechar debito, marcar `status = fechado` ou remover da lista ativa e registrar evidencia.
5. Se uma task antiga foi superada por decisao posterior, marcar como fechada/absorvida e apontar a decisao ou backlog atual.

## Status rapido das specs

| Spec | Tema | Estado resumido |
|---|---|---|
| 001 | infra backup | Fechada/Gate A aprovado; pendencias antigas sao historicas. |
| 002 | recriar VM | Fechada; VM nova e `artificio_net` em uso. |
| 003 | monorepo + SSO | Fechada/Gate B aprovado; `accounts.` no ar. |
| 004 | mesas SSO Gate D | Fechada/Gate D mesas. |
| 005 | beta pipeline | Em uso; pendencia isolada de hydrate `PROD_DB_URL`. |
| 008 | site foundation | Parcial/aberta para Gate D site e pendencias editoriais/SEO. |
| 009 | deploy hardening | R1-R5 fechados; R6/T9 viraram futuro. |
| 011 | site CMS | MVP local/deployado em partes; paridade WP/editorial ainda grande. |
| 012 | glossario monorepo | Fechada; pendencias manuais residuais no backlog. |
| 013 | links/regras restore | Aberta/bloqueada por localizar artefato ou refazer. |
| 014 | nav WhatsApp/links | Aberta; depende de `links.` no ar. |
| 015 | glossario SSO compat | Fechada/Gate D glossario; follow-up limpeza legado. |
| 016 | mesas Express 5 | Aberta/pendente; relacionada ao E004. |
| 019 | auditoria fonte unica | Fechada como auditoria; backlog derivado em `backlog.md`. |
| 020 | theme Artificio padrao | Parcial; varios B-items ainda abertos. |
| 021 | feedback site/glossario | Implementado/promovido segundo project-state; conferir pendencias runtime no backlog. |
| 022 | paleta/fontes global | Aberta/local conforme spec propria. |
| 023 | Real IP ingress | Fechada em prod; residual `BL-ACCOUNTS-PORT` no backlog. |
| 024 | auditoria docs/specs/backlog | Fechada; auditoria documental alinhou tasks, backlog e sessoes. |
| 025 | Lighthouse/qualidade publica | Aberta; T1/T2 fechados com harness limpo + baseline 2026-06-16; proximos: CLS/perf glossario, robots, imagens site, a11y, mesas perf, headers/terceiros. |
| 036 | media shared | Fechada local 2026-06-20; `@artificio/media` com 5 funções atômicas; 3 consumidores migrados; sem commit. |
| 042 | duplicate code refactor | ✅ **EM PROD**. Merge dev→main. Deploy prod mesas/glossario/site. cpd 5.57%→4.60% (-411 linhas, -18 clones). 13 revisões resolvidas. |
| 043 | auditoria visual links | PR #84 mergeada em `dev`. Fase 1 T5 (logo base64→PNG) completa. 46 arquivos. Proximo: T6. |
| 044 | opencode ecosystem | ✅ **CONCLUIDA**. OpenCode + Claude Code. 10 ferramentas ativas. Smoke 4/4. |
| 045 | debitos pendentes deploy | aberto. Investigacao concluida. T1 (PR #85) ✅. T2/T3/T4 pendentes. |
| 046 | arquiteture docs sync | aberto. Auditoria secao por secao do `arquiteture.md`. §1 corrigido, §2 auditado. |
| 047 | mesas inbox importacao | aberto. Auditoria Fase 0 concluída. Inbox de importação de mesas (texto colado → draft). 7 fases planejadas. |

## Convencao de status no backlog
- `aberto`: ainda precisa execucao.
- `bloqueado`: precisa decisao, segredo, aprovacao nominal ou artefato externo.
- `local`: implementado localmente, falta commit/push/deploy.
- `validacao`: codigo no ar/local, falta smoke manual/E2E.
- `fechado`: manter apenas quando a linha ajuda historico recente; depois pode sair da lista ativa.

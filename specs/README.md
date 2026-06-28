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
| 047 | mesas inbox importacao | ✅ fechada em beta. PR #88/#89 mergeadas; UI/backend no beta; smokes autenticados T1.13-T1.16 verdes; sem promoção a main. |
| 048 | mesas DiscordChatExporter JSON | ✅ **em PROD (2026-06-27)**. Importador permanente de JSON do Tyrrrz/DiscordChatExporter (B/C/F/G completas). Débitos remanescentes (37 CI / 38 tema accounts) + Fase E (ingestão VM) → **transferidos p/ spec 053**. Melhorias opcionais de parser → **052 Bloco C**. |
| 049 | mesas revisão gestão | fechada em `dev` (PRs #93/#94, promovida a `main` 2026-06-24). Refatoração /gestao (Fases A-F). D07 resolvido; **D06 (8 P1 a11y) → transferido p/ spec 053 Frente A**. |
| 050 | infra migration guard online-safe | planejada (Claude planeja, DeepSeek implementa). Corrige falso-positivo `\bDROP\b` no guard que abortou deploy prod mesas + Fase C trata duplicação do guard (`BL-DEP-MESAS-LEGACY-SCRIPTS`). |
| 051 | ui changelog/nav + extrações compartilhadas pré-lançamento | planejada (só spec/plan/tasks/reviews; debitos zerado). 7 frentes (tasks) por ondas: F0 varredura de duplicação; F4 consolidar 4 wrappers de changelog→`packages/ui` (extração adiada spec 020); F5 extrair primitivas admin do mesas→`packages/ui` (G01/049); F1 bug visual do changelog (mesas sobreposto / glossário topo escondido); F6 centralizar schemas Zod cross-app→`packages/content` (G02/049); F2 indicador de projeto ativo na nav (`currentHref` inconsistente); F3 = DEB-050-02 (`[`→`[[` scripts deploy). Ordem: Onda 0→A(ui)→B(content)→C(nav)→D(shell), extrair compartilhado antes de consumir p/ zero retrabalho. **✅ ENCERRADA e em prod (2026-06-26).** Resta só doc REV-051-RABBIT-06 → spec 053 Frente D. |
| 052 | mesas automação inteligente de importação | roadmap futuro/opcional. Bloco A (ingestão VM, coordenar c/ 053 Frente E — não duplicar) + Bloco B (IA gated: eval→shadow→auto-aprovação→fine-tuning) + **Bloco C** (melhorias opcionais de parser da 048, R15–R20). **BLOQUEADA até a spec 053 fechar.** |
| 053 | consolidação de débitos 047–051 (a11y/UI, tema, CI) | **planejada (2026-06-27).** Concentra tudo que sobrou das 047–051: Frente A a11y/UI gestão (ex-049/D06), B tema accounts (ex-048-38), C smoke CJS no CI (ex-048-37), D doc (REV-051-RABBIT-06), E ingestão VM (ex-048 Fase E, final). SDD Completo (toca `packages/ui`+accounts+CI). |
| 054 | reorganização da `/gestao` (sidebar + IA + renomeações) | **Fases 1-4 implementadas localmente (código presente, não mergeado) — PRIORITÁRIA / GATE DE BLOQUEIO.** Abas-topo → sidebar persistente; 6 grupos (subseções detalhadas; Caixa de entrada derrubado); rotas aninhadas; renomeações **ampliadas a identificadores** (rótulo+enum/rota; persistido só via migration); padrão de botões; moderação unificada (reaproveita 049/DEB-048-34); Dashboard com subnav (dados reais + stubs honestos); mortos deletados. SDD Completo. **GATE: 054 → 053 → 052.** 053 Frente A bloqueada até 054 fechar. |
| 055 | API governance executável | **fechável em modo inicial (2026-06-28).** Fluxo executável implementado: `api:inventory`, `api:consumers`, `api:lint`, `api:check`, `api:traffic`, `api:diff`, `api:docs`, OpenAPI por app, mapa gerado, relatório de órfãs/duplicadas e job `api-governance` no CI. `apps/mesas/MAPA_DE_API.md` virou legado/não canônico. Débitos remanescentes aceitos para modo estrito/cobertura 100%. |

## Convencao de status no backlog
- `aberto`: ainda precisa execucao.
- `bloqueado`: precisa decisao, segredo, aprovacao nominal ou artefato externo.
- `local`: implementado localmente, falta commit/push/deploy.
- `validacao`: codigo no ar/local, falta smoke manual/E2E.
- `fechado`: manter apenas quando a linha ajuda historico recente; depois pode sair da lista ativa.

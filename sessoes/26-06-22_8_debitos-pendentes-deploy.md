# Sessão 26-06-22_8 — Débitos pendentes em limbo (spec 045)

- **Data:** 2026-06-22
- **Objetivo:** Abrir spec onde cada task = resolver 1 dos 5 débitos "🟡 Local". Etapa = **só investigação + documentação** (sem código, sem commit, sem avanço de fase).
- **Escopo:** transversal — accounts, links, workflows, .gitignore, backlog.
- **Gate:** Gate D (links/accounts em prod).
- **Vínculos:** `specs/045-debitos-pendentes-deploy/`, specs 035/038, decisões D042/D080/D085.

## Plano
1. T0 completo (project-state + capsule + decisions) ✅
2. Ler backlog inteiro + spec 038 ✅
3. Investigar cada débito no código + prod read-only ✅
4. Criar spec 045 (spec + investigacao + tasks) ✅
5. Registrar sessão + parar (sem implementar) ✅

## Investigação — veredictos (evidência em `specs/045-.../investigacao.md`)

| Débito | Veredicto | Evidência |
|---|---|---|
| BL-BUILD-CACHE-PRUNE-ALL | **RESOLVIDO (prod)** | `--all` em `_deploy-module.yml:502` + `docker-cleanup.yml:159`; commit `bfa98be` ancestral de origin/dev+main. Backlog stale (linhas 494/159). |
| BL-LINKS-NAV-CROSSAPP (038 T12) | **RESOLVIDO (prod)** | nav `links.artificiorpg.com` em site (raiz), glossário+mesas (bundle JS). accounts sem nav by design (`main.tsx:3` não importa Header). |
| BL-LINKS-GROUP-LOGOS (038 T4) | **12/13 (prod)** | `curl /api/groups`: 13 grupos, 1 null = "Canal de Notícias" (canal). Reidratação já rodou. |
| BL-ACCOUNTS-PORT (035 T5) | **PENDENTE (deploy)** | `expose:["3000"]` nos 2 composes; falta deploy prod + smoke (aprovação). |
| BL-033-SECRET-BLOCK | **PENDENTE (mecânico)** | `.gitignore:45` ainda `artifacts/lighthouse/`; `git ls-files artifacts/` = 16. |
| BL-LINKS-MEDIA-038 (T13) | **resíduo (smoke)** | T1-T11 mergeado PR #78; falta smoke E2E (report + cron VM). |

**Conclusão:** snapshot do backlog majoritariamente stale. 2 trabalhos reais (BL-033 + accounts deploy), 2 resíduos (canal logo + smoke), 2 fechamentos documentais (cache + nav).

## Backlog
- **NÃO atualizado nesta sessão** (etapa só de investigação). Reconciliação registrada como **T5** da spec 045 (fechar BL-BUILD-CACHE-PRUNE-ALL + BL-LINKS-NAV-CROSSAPP com evidência; atualizar os demais). Motivo de adiar a edição do backlog: manter a etapa limitada a documentação na própria spec, conforme pedido; T5 executa com aprovação.
- Linha SPEC-045 a adicionar no backlog quando a reconciliação (T5) rodar.

## Arquivos criados
- `specs/045-debitos-pendentes-deploy/spec.md`
- `specs/045-debitos-pendentes-deploy/investigacao.md`
- `specs/045-debitos-pendentes-deploy/tasks.md`
- esta sessão

## Critério de conclusão (desta etapa)
Spec 045 documentada com veredicto+evidência por débito e tasks só do trabalho real restante. ✅ **PARADO aqui** — sem implementar, sem commit, sem avanço de fase.

## project-state.md
- Não alterado nesta etapa. Atualização vinculada à T5 da spec 045 (com aprovação).

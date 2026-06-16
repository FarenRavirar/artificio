# Sessao 26-06-15_6 — Spec piloto consumers primitives

- **Data:** 2026-06-15
- **Objetivo:** investigar e especificar corretamente `BL-UI-PRIMITIVES-CONSUMERS`.
- **Escopo:** docs/specs; leitura de `apps/site-admin` como candidato piloto; sem codigo runtime nesta sessao.
- **Gate:** nenhum. WP raiz/DNS/VM/prod fora de escopo.
- **Restricoes:** nao commitar/pushar/deployar; nao usar Chrome; nao sobrescrever diff local B12/B3/B4.

## Plano
- [x] Inventariar `apps/site-admin` e pontos candidatos a primitives.
- [x] Verificar package/scripts/testes/build disponiveis.
- [x] Comparar com `rollout-pilots.md`, `primitives-form-state.md` e backlog.
- [x] Criar/atualizar artefato de spec/fatia com escopo, arquivos, criterio, validacao e rollback.
- [x] Atualizar backlog/sessao.

## Arquivos provaveis
- `specs/020-ui-theme-artificio-padrao/primitive-consumers-pilot.md`
- `specs/backlog.md`
- `sessoes/26-06-15_6_ui-primitives-consumers-spec.md`
- `sessoes/index.md`

## Criterio de conclusao
- Existe spec acionavel para migracao piloto de consumidor.
- Spec aponta arquivos reais e testes reais.
- Backlog referencia a spec.
- `git diff --check` OK.

## Execucao
- 2026-06-15 — Lido `apps/site-admin` completo relevante: `styles.css`, `App`, listas, editores, media, feedback.
- 2026-06-15 — Validado baseline: `pnpm --filter @artificio/site-admin typecheck` OK; `pnpm --filter @artificio/site-admin build` OK, com aviso existente de chunk >500 kB.
- 2026-06-15 — Criado `specs/020-ui-theme-artificio-padrao/primitive-consumers-pilot.md`.
- 2026-06-15 — Backlog `BL-UI-PRIMITIVES-CONSUMERS` atualizado para apontar para a spec e para fatia 1 `PostsList`/`PagesList`.

## Achados
- `site-admin` tem duplicacao real de `.btn`, `.badge`, `.card`, inputs/selects/textareas, modal e states.
- Melhor piloto nao e forms grandes: e listas `PostsList`/`PagesList`, por menor risco e validação simples.
- `Button href` renderiza `<a>`; para rotas internas `react-router`, a spec recomenda preservar `Link` se SPA routing for requisito na fatia 1.

## Validacao
- `pnpm --filter @artificio/site-admin typecheck` — OK.
- `pnpm --filter @artificio/site-admin build` — OK.
- `rg BL-UI-PRIMITIVES-CONSUMERS/primitive-consumers-pilot` — OK.
- `git diff --check` — OK (avisos CRLF Windows se repetem).

## Fechamento
- [x] Spec criada.
- [x] Backlog atualizado.
- [x] Baseline testado.
- [x] Nada a atualizar em `project-state.md`: nao mudou estado operacional; abriu so fatia planejada.

# Débitos — Spec 062

> Achados internos não resolvidos: investigação, lint, build, auditoria, código morto.
> Reviews externas → `reviews.md`.

## DEB-062-001 — `reviews.md` e `debitos.md` não criados junto com a spec
- **Origem:** Spec 062 criada em 2026-07-08 sem seguir template SDD completo (AGENTS.md §Specs).
- **Escopo:** `specs/062-sistemas-catalogo-canonico/`
- **Status:** ✅ Resolvido 2026-07-10 — ambos os arquivos criados.

## DEB-062-002 — `plan.md:3` desatualizado ("implementação não iniciada")
- **Origem:** Plano não atualizado após início da Etapa II (2026-07-09).
- **Escopo:** `plan.md` linha 3.
- **Status:** ✅ Resolvido 2026-07-10 — estado corrigido.

## DEB-062-003 — `spec.md:47` "Fora de escopo: Código, migration" não qualificado por etapa
- **Origem:** Seção escrita para Etapa I, mantida como escopo geral.
- **Escopo:** `spec.md:45-50`.
- **Status:** ✅ Resolvido 2026-07-10 — qualificado como "na Etapa I".

## DEB-062-004 — `SystemAutocomplete.tsx` órfão (código morto)
- **Origem:** I0a.4 migrou `CatalogoPage.tsx` para `SystemPicker`; `SystemAutocomplete` perdeu todos os consumidores mas não foi removido do disco.
- **Escopo:** `apps/mesas/frontend/src/components/SystemAutocomplete.tsx` — zero imports no código (grep confirmado).
- **Próximo passo:** Remover arquivo em limpeza pós-I0a, ou registrar como "mantido para referência".
- **Prioridade:** Baixa.

## DEB-062-005 — Headers de migration do site não documentados
- **Origem:** Migrations 006/007 em `apps/site/db/migrations/` usam comentários descritivos, não o formato de 5 campos do runner shell (`@class`/`@requires-backup`...). O site tem runner TS próprio (`db/migrate.ts`), então isso é correto — mas a distinção entre runners (shell vs TS) não está documentada na spec.
- **Escopo:** `spec.md` ou `plan.md` I1.
- **Próximo passo:** Adicionar nota em `plan.md` I1 explicando que o runner do site não valida headers shell.
- **Prioridade:** Baixa.

## DEB-062-006 — PR #143 e #144 não registradas em `project-state.md`
- **Origem:** `project-state.md` parou na PR #140.
- **Escopo:** `.specify/memory/project-state.md`.
- **Status:** ✅ Resolvido 2026-07-10 — PRs registradas.

## DEB-062-007 — Evidências truncadas em `tasks.md` por limite de linha única
- **Origem:** Linhas 64, 65, 67 de tasks.md com >2000 caracteres.
- **Escopo:** `tasks.md`.
- **Status:** ✅ Resolvido 2026-07-10 — linhas quebradas.

## DEB-062-008 — `spec.md:378-381` contém detalhes de implementação (CATALOG_INTERNAL_TOKEN)
- **Origem:** Spec sendo usada como diário de implementação.
- **Escopo:** `spec.md:378-381`.
- **Próximo passo:** Mover detalhes para `plan.md` I4/I5; spec deve manter só contrato arquitetural.
- **Prioridade:** Baixa.

## DEB-062-009 — Tabela de estado dos bancos em `spec.md:58-63` é pré-migration
- **Origem:** Snapshot de 2026-07-08, anterior às migrations 142/143.
- **Escopo:** `spec.md:58-63`.
- **Próximo passo:** Adicionar nota "Pré-I0b.3 (2026-07-08)" no cabeçalho da tabela.
- **Prioridade:** Baixa.

## DEB-062-010 — Achado Sonar `.some()` vs `.find()` sem candidato claro (PR #145)
- **Origem:** Review Sonar da PR #145 apontou `systems.ts:116` como candidato a trocar `.find()` por `.some()`, mas na investigação linha a linha nenhum `.find()` na região apontada tinha o objeto descartado após a checagem — todos retêm o nó pra uso posterior (`parent`, `existing`). Mantenedor decidiu pular por enquanto em vez de aplicar fix às cegas.
- **Escopo:** `apps/mesas/backend/src/routes/systems.ts` (achado original; outros `.find()`→`.some()` reais nesta mesma leva de review já foram corrigidos em `systems.ts:119`, `systemSuggestionsAdmin.ts:302,636`).
- **Próximo passo:** Se o Sonar reapontar o mesmo achado em revisão futura, reavaliar linha exata contra o código then-atual antes de decidir.
- **Prioridade:** Baixa.

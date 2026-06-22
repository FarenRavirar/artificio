# 042 — Refatoração de código duplicado (Top 3)

- **Módulo/Pacote:** `packages/feedback` (novo) + `apps/mesas/backend`
- **Gate relacionado:** nenhum
- **SDD:** Completo (toca `packages/*`)
- **Status:** ✅ **EM PROD** — Mergeada em `dev` (PR #83, 2026-06-21) → promovida `dev→main` (run `27926641721`) → deploy prod mesas/glossario/site

## Problema

Análise `cpd` (2026-06-21) encontrou **5.57% de duplicação** (2.275 linhas, 134 clones em 326 fontes). Três grupos concentram ~50% da duplicação total (~1.150 linhas em 13 arquivos):

1. **Feedback validators** duplicados em 3 apps (glossario, site, mesas) — ~470 linhas, viola D062 (fonte única via importação)
2. **`resolveActorName`** definida 6× em 6 arquivos de rota do mesas — ~180 linhas, mesma lógica com variação trivial
3. **Rotas de sugestão** (scenario vs system) no mesas — ~500+ linhas, pares estruturais com tabelas trocadas

## Requisitos

### R1 — `packages/feedback` (SDD Completo — shared package)
- **R1.1** Criar `packages/feedback` com tipos, constantes, helpers e `parseFeedbackInput` parametrizável
- **R1.2** Migrar `apps/glossario/backend/src/validators/feedbackValidator.ts` → consumir `@artificio/feedback`
- **R1.3** Migrar `apps/site/server/lib/feedback-validator.ts` → consumir `@artificio/feedback`
- **R1.4** Migrar `apps/mesas/backend/src/validators/devFeedbackValidator.ts` → consumir `@artificio/feedback`
- **R1.5** `decodeScreenshotDataUri` (exclusivo do site) permanece no site ou sobe para o pacote se parametrizável

### R2 — `resolveActorName` no mesas (SDD Lite — app isolado)
- **R2.1** Extrair para `apps/mesas/backend/src/services/actorNameResolver.ts`
- **R2.2** Assinatura: `resolveActorName(userId: string, options?: { trx?, fallback? })`
- **R2.3** Substituir 6 definições por import da fonte única
- **R2.4** Tag de log deve ser injetável ou derivada de `Error.stack`

### R3 — Rotas de sugestão no mesas (SDD Lite — app isolado)
- **R3.1** Extrair handlers comuns (`reject`, `GET list`) com parâmetros (tableName, kind, entityType)
- **R3.2** `resolveActorName` já coberto por R2 — remover duplicação residual neste passo
- **R3.3** `approve` parcialmente compartilhado (~60%); extrair esqueleto comum, manter divergência de INSERT
- **R3.4** `POST /` (criar) parcialmente compartilhado; extrair validação e esqueleto comum
- **R3.5** Código exclusivo do system (`resolve`, `candidates`, `relinkDiscordDrafts`) intocado

## Critérios de aceite

- `pnpm run build` 15/15 verde
- `pnpm run lint` 0 erros
- `pnpm run test` 21/21 verde
- Smoke local: glossario, site e mesas feedback endpoints funcionais
- Smoke local: rotas de sugestão do mesas (scenario + system) funcionais
- Zero `cpd` clones >= 20 impacto nos arquivos refatorados
- `packages/feedback` com exports limpos, sem acoplamento a app específico

## Fora de escopo

- Refatorar outros 131 clones abaixo do top 3
- Criar `packages/feedback` com runtime de upload Cloudinary (só validação)
- Unificar `resolveActorNames` (variante batch em `devFeedbackAdmin.ts`)
- Refatorar ESLint configs duplicados (item #5, impacto 61)
- Refatorar diagnostics frontend (item #6, glossario ↔ mesas)
- Refatorar jobs runner (item #8, links ↔ site)
- Alterar schema ou migration de qualquer app

## Riscos e impacto em outros módulos

| Risco | Mitigação |
|-------|-----------|
| `packages/feedback` quebrar build de app não migrado | Migrar 3 apps na mesma spec, validar build conjunto |
| Mudança de assinatura quebrar runtime | Testes de regressão + smoke local por app |
| `resolveActorName` com `trx?` falhar em rota sem transação | Parâmetro opcional, fallback `db` direto |
| Rotas de sugestão com lógica sutilmente diferente | Testar cada handler migrado isoladamente |

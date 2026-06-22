# 043 — Revisões de bots do PR #84

> **Propósito:** registrar e dar veredicto a CADA achado dos revisores automatizados (amazon-q-developer, chatgpt-codex-connector, coderabbit, Snyk, Sonar, CodeQL, github-advanced-security) no PR #84. **Regra pétrea:** nenhum agente responde/reage/resolve thread no PR — todo veredicto vive AQUI. Resposta a revisor no PR é só do mantenedor.
>
> Preencher uma linha por achado. Merge só quando TODOS tiverem veredicto e os que **procedem** estiverem aplicados (com autorização de commit própria).

## Status do PR
- Branch: `feat/043-links-visual-audit`
- PR: [#84](https://github.com/FarenRavirar/artificio/pull/84)
- Commit: `5b4f461`
- Checks GitHub (`lint + build + test`): pendente
- Estado das revisões: **aberto** — aguardando bots

## Resumo do PR

**10 arquivos** — T5 (spec 043 Fase 1): logos em `packages/ui/src/brand.ts` migrados de base64 inline (~8KB) para 3 PNGs com hash. `assetsInlineLimit: 0` nos 5 consumidores.

**Modificados:** `brand.ts`, `package.json` (packages/ui), `vite.config.ts` (accounts/mesas/glossario), `astro.config.mjs` (links/site)
**Novos:** `ambient.d.ts`, `faviconV2.png` (packages/ui/src/)

## Achados

| # | Bot/Revisor | Arquivo:linha | Severidade | Achado (resumo) | Veredicto | Justificativa | Ação |
|---|---|---|---|---|---|---|---|

## Code Smells (Sonar)

| # | Arquivo | Linha | Severidade | Achado | Veredicto | Justificativa |
|---|---|---|---|---|---|---|

## Veredictos (legenda)
- **procede** → aplicar fix via novo commit (autorização nominal própria) e referenciar o sha.
- **descarta** → falso-positivo/decisão de design; justificar por que não se aplica.
- **fora de escopo** → procede mas não pertence ao foco do PR. Investigar, registrar débito e resolver dentro da própria spec.

## Critério de encerramento (gate de merge)
- [ ] Todos os achados com veredicto registrado.
- [ ] Todos os "procede" aplicados (commits referenciados) e checks verdes de novo.
- [ ] Mantenedor autorizou o merge nominalmente.

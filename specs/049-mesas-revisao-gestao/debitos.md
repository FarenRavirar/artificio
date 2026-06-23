# Débitos — 049

> Débitos descobertos durante a spec, não corrigidos no escopo atual.

## Pendências técnicas

| # | Débito | Origem | Próximo passo |
|---|--------|--------|---------------|
| D01 | ~~adminDiscordSync.ts com 1278 linhas~~ → 708 linhas (44%) | TE5-TE9 implementados | settings, drafts, upload extraídos. Restam 15+ handlers para <500 — fase E complementar necessária |
| D02 | ~~adminImportInbox.ts com 639 linhas~~ → 562 linhas | loadSystemsForParser duplicado removido, schemas extraídos para inbox/utils.ts | Redução modesta. Split mais profundo (domínios import/drafts/corrections) avaliado mas postergado |
| D03 | adminHydration.ts com 489 linhas — candidato a split | Fase D proposta menciona mas sem tasks | TE futuro: split hydration handler |
| D04 | Nenhuma task de frontend executada (TE10-TE17) | Fase E parcial | TE10-TE17: hooks, subcomponentes, estados padronizados |
| D05 | Fase F (verificação pós-refatoração) não iniciada | Fase E incompleta | TF1-TF12 após todas as tasks de refatoração |
| D06 | 8 issues P1 das auditorias não tratadas | Fase B | Corrigir após refatoração estrutural completa |
| D07 | adminTablesAutoArchive.test.ts nome engana — testa auto-archive em adminTables.ts, não existe source separado | Legado | Renomear ou ignorar (funcional) |
| D08 | DiscordSyncPanel.tsx >500 linhas (543) | Fase E parcial | TE15: quebrar em sub-componentes por tab |
| D09 | adminDiscordSync.ts: discovery/sources/fetch/messages/parse-batch não extraídos | TE9: 708 linhas, muito acima de <200 | Extrair discovery→routes/discord/discovery.ts, sources→routes/discord/sources.ts, fetch→routes/discord/fetch.ts, messages→routes/discord/messages.ts, parse-batch→routes/discord/parse-batch.ts |
| D10 | adminImportInbox.ts split mais profundo não feito (562 linhas, 8 handlers) | D02 postergado | Separar por domínio: import/, drafts/, corrections/ — só se houver nova refatoração |
| D11 | Routes produzidas (drafts.ts, settings.ts) têm `isAdmin` duplicado | Herdado do padrão TE1-TE4 | Extrair middleware compartilhado `requireAdmin` em `middleware/auth.ts` |
| D12 | TE9 target <200 linhas inatingível sem extrair discovery/sources/fetch/messages/parse-batch | Escopo TE5-TE7 não cobre | Coberto por D09 |
| D13 | `routes/discord/utils.ts` com `loadSystemsForParser` (DB query) misturado a utilidades de rota — candidato a mover para `discord/shared.ts` | Extração TE6 | Mover para `discord/shared.ts` se houver nova refatoração no parser |

## Pendências de governança

| # | Débito | Motivo |
|---|--------|--------|
| G01 | Extração para packages/ui requer SDD Completo separado | Spec 049 prevê mas não executa |
| G02 | Schemas Zod duplicados candidatos a packages/content | Igual, requer SDD separado |

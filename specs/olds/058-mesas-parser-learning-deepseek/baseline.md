# Baseline — 058 Fase 1

## Corpus `D:\teste.json`

**Data:** 2026-07-01
**Modo:** offline, sem banco, sem gravar dados.
**Comando:** parser real via `parseDiscordChatExporterJson` -> `adaptMessageToImportRaw` -> `parseDiscordAnnouncement` -> `normalizeDiscordTableDraft`, com `systems=[]`.

## Resultado

```json
{
  "total": 50,
  "draft": 43,
  "discard": 7,
  "ignored": 0,
  "paid": 25,
  "free": 3,
  "unknown": 15,
  "missing": {
    "system_name:unmatched_hint": 40,
    "type": 17,
    "price_type": 15,
    "day_of_week": 7,
    "start_time": 10,
    "system_name": 3,
    "slots_total": 9,
    "slots_open:ambiguous_x_of_y": 1,
    "contact_url:suspicious": 7
  },
  "actions": {
    "needs_review": 43
  }
}
```

## Leitura

- A Fase 1 nao muda a decisao funcional do parser; ela so adiciona memoria/auditoria.
- O corpus continua conservador: preco ausente fica `unknown`, nao gratuito.
- Todos os drafts do corpus ainda exigem revisao humana (`needs_review`).
- `systems=[]` no baseline offline aumenta `system_name:unmatched_hint`; em runtime, o parser recebe sistemas do banco.

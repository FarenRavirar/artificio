# Fase 2 — idioma

Execução local: 2026-07-27. Branch: `fix/089-fases-2-3`.

## Regra implementada

- `sourceLanguageHint` virou `sourceLanguageEvidence` no contrato inteiro.
- `not_pt` rejeita cedo; `pt` e `null` sempre executam `detectPortuguese`.
- Resultado traz `method` e `reason`; o log persiste ambos em `error_detail`.
- Material aprovado persiste `detected_language`, `language_confident` e
  `language_checked_at`; metadata mantém `language = 'pt'` por D119.
- Todo código de detecção é ISO 639-3 (`por`, `eng`, `und`).

## Detector

1. `franc-min` para texto suficiente e margem confiante.
2. Texto curto: allowlist versionada pt-específica, tokens inteiros, no mínimo dois sinais
   distintos. Palavra ambígua isolada nunca aprova.
3. Dúvida segue ao DeepSeek; ausência, HTTP, vazio, JSON inválido ou erro permanecem
   indeterminados e não aprovam.

Documentação oficial consultada em 2026-07-27:

- `deepseek-chat` foi depreciado em 2026-07-24; a API atual aceita
  `deepseek-v4-flash`/`deepseek-v4-pro`.
- A integração usa `deepseek-v4-flash` e
  `response_format: { type: 'json_object' }`, mantendo instrução e exemplo JSON no prompt.
- Fontes: <https://api-docs.deepseek.com/api/create-chat-completion> e
  <https://api-docs.deepseek.com/guides/json_mode>.

## Corpus rotulado

`test/fixtures/spec-089/language-corpus.json` referencia páginas do endpoint físico e as
fixtures reais com proveniência. Resultado sem chave externa:

| | Previsto pt | Previsto não-pt | Indeterminado |
|---|---:|---:|---:|
| Real pt | 1 | 0 | 0 |
| Real não-pt | 0 | 1 | 1 |

Precisão entre itens aprovados: 1,0. Falsos positivos: 0. Um caso não-português curto
abstém e falha fechado; não é contado falsamente como negativo correto. Casos contratuais separados cobrem português com/sem
acento, espanhol, galego, texto misto, título próprio e descrição ausente.

## Consumidores

Busca em `apps/downloads` confirmou: nenhum frontend consome `detected_language`; o fluxo de
moderação já persiste as três colunas e aceita ISO 639-3. Consumidores de metadata continuam
corretos porque `download_material_metadata.language` permanece `'pt'`.

## Validação

- 97 testes focados verdes (idioma, ingest, rotas e scrapers afetados).
- Backend completo: 387/387 testes.
- TypeScript verde.
- build verde.
- lint verde.
- `verify:api` exit 0; 3 warnings de paths ambíguos e 1 advisory `site path.remove`
  sem path/method no relatório inicial, sem alteração correspondente neste diff.

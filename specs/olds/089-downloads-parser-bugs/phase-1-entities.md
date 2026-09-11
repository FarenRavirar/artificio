# Fase 1 — entidades HTML

Execução local: 2026-07-27. Branch: `fix/089-fases-0-1`.

## Fronteira única

- `SCRAPED_ITEM_FIELD_POLICY` classifica todo `keyof ScrapedItem` como
  `plainText`, `url`, `richHtml` ou `opaque` via `satisfies Record<...>`.
- `plainText` é decodificado recursivamente uma vez com `html-entities`
  (`level: html5`, `scope: body`) na saída dos parsers.
- `sourceUrl`/`coverImageUrl` permanecem byte a byte.
- `descriptionHtml` continua sob DOMPurify e não passa pelo decoder textual.
- `/ingest` só remove marcação de `description`; não decodifica entidades.

## Matriz de prova

| Semântica | Campo/caso | Prova |
|---|---|---|
| texto real | título/descrição OPERA `Raças D&amp;D` | `opera-regras-section.html` + `operaRpgScraper.test.ts` |
| texto real | título itch `The Tusu&#039;s Mine` | `itch-physical-listing.html` + `itchIoScraper.test.ts` |
| texto real | editora itch/Grimórios `Grimórios &amp; Dados` | `grimorios-product-machados.html`; política exercitada em `plainTextPolicy.test.ts` |
| texto contratual | créditos, sistema, tipo, cenário, tags, filtros, formato e categoria | `plainTextPolicy.test.ts`, com entidade nomeada, decimal e hexadecimal |
| URL | query contendo `&amp;` | prova byte a byte em `plainTextPolicy.test.ts` e `genericHtmlParser.test.ts` |
| HTML rico | `<p>D&amp;D <strong>rico</strong></p>` | prova byte a byte em `plainTextPolicy.test.ts`; sanitização segue coberta em `sanitizeRichHtml.test.ts` |
| uma passagem | `&amp;lt;` | parser produz `&lt;`; reenvio `parse-html → ingest` preserva `&lt;` em `scraper.test.ts` |
| persistência/ordem | título, slug, summary, editora, créditos, sistema e tipo | `scraperIngest.test.ts`; detector recebe texto decodificado antes de slug/taxonomia |

Entidade em campo não observada no corpus real não foi inventada como “fixture
real”. Esses campos usam fixture contratual explícita; os seletores e valores
reais permanecem nas fixtures com proveniência da Fase 0.

## Validação

- `rtk tsc -p tsconfig.json --noEmit`: verde.
- suíte focada da Fase 0/1: 93 testes verdes.
- suíte completa do backend: 131 arquivos e 365/365 testes verdes.
- `rtk pnpm run build`: verde.
- `rtk pnpm run lint`: verde.
- `rtk pnpm peers check`: sem problema de peer dependency.
- `rtk pnpm verify:api`: verde; inventário/mapa regenerados apenas com as novas linhas das
  quatro rotas alteradas em `scraper.ts`.

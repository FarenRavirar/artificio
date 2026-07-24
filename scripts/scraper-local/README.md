# Scraper local (Modo 3) — spec 084

Ferramenta operacional fora do backend/IA. Roda no PC do mantenedor, usa
sessão real do Chrome (`--user-data-dir`), extrai itens de marketplaces
bloqueados por WAF em Modo 1/2a/2b (DriveThruRPG/DMs Guild) e envia o
resultado para `POST /admin/scraper/ingest`, que roda o mesmo pipeline de
criação/dedupe/filtro-de-idioma do modo automático.

## Por que existe (decisão do mantenedor, 2026-07-24)

Custo de IA por execução repetida é alto demais para scraping item-a-item.
Este script é construído uma vez pelo Claude Code; o mantenedor executa
localmente quantas vezes quiser depois, sem custo de IA por rodada, e sem
`claude-in-chrome`/MCP de browser em loop.

## Risco aceito explicitamente (D-084-02)

Usar a sessão logada pessoal do mantenedor para scraping automatizado pode
levar à suspensão da conta se o marketplace detectar como automação. O
mantenedor decide, por execução, se aceita esse risco — não é decisão do
agente nem algo escondido.

## Seletores não confirmados

Nunca conseguimos ver uma página de listagem do DriveThruRPG/DMs Guild
desbloqueada (403 em Modo 1 e Modo 2a, mesmo com patchright headless puro —
ver `apps/downloads/backend/src/services/scrapers/driveThruRpgScraper.ts`).
Os seletores em `extractItemsFromPage()` são um ponto de partida especulativo
baseado no padrão visto em fontes que funcionaram (OPERA RPG/itch.io), **não
confirmados contra HTML real destes 2 marketplaces**. Rode com `--dry-run`
primeiro, inspecione o JSON gerado, ajuste os seletores no script conforme
necessário antes de confiar no resultado.

## Uso

```bash
node scripts/scraper-local/fetch-and-ingest.mjs \
  --url "https://www.drivethrurpg.com/en/browse?filters=100000&price=0" \
  --source-platform drivethrurpg \
  --user-data-dir "C:\Users\SEU_USUARIO\AppData\Local\Google\Chrome\User Data" \
  --profile "Default" \
  --dry-run
```

Depois de confirmar que o JSON gerado (`scraper-local-dry-run-*.json`) tem
itens corretos, rode sem `--dry-run` e com `--api-url`/`--auth-token`:

```bash
node scripts/scraper-local/fetch-and-ingest.mjs \
  --url "https://www.drivethrurpg.com/en/browse?filters=100000&price=0" \
  --source-platform drivethrurpg \
  --user-data-dir "C:\Users\SEU_USUARIO\AppData\Local\Google\Chrome\User Data" \
  --profile "Default" \
  --api-url "https://downloads.artificiorpg.com/api/v1/admin/scraper/ingest" \
  --auth-token "SEU_TOKEN_DE_SESSAO_ADMIN"
```

## Argumentos

| Argumento | Obrigatório | Descrição |
|---|---|---|
| `--url` | sim | URL de listagem/browse a raspar |
| `--source-platform` | sim | `drivethrurpg` ou `dms_guild` |
| `--user-data-dir` | sim | Diretório de profile do Chrome real (sessão logada) |
| `--profile` | não | Nome do profile dentro do user-data-dir (default: `Default`) |
| `--dry-run` | não | Salva o payload em JSON local, não envia ao backend |
| `--api-url` | condicional | URL de `POST /admin/scraper/ingest` (obrigatório sem `--dry-run`) |
| `--auth-token` | condicional | Token de sessão admin válido (obrigatório sem `--dry-run`) |

## Formato do payload (`POST /admin/scraper/ingest`)

```json
{
  "source_platform": "drivethrurpg",
  "items": [
    {
      "sourceUrl": "https://www.drivethrurpg.com/product/12345/Nome-do-Produto",
      "title": "Nome do Produto",
      "description": "Descrição opcional ou null",
      "isFreeOrPwyw": true,
      "coverImageUrl": "https://... ou null",
      "publisherName": "Nome da editora ou null",
      "sourceLanguageHint": null
    }
  ]
}
```

`sourceLanguageHint` deve ser `"pt"` só se a própria fonte confirma
explicitamente o idioma (ex.: filtro nativo como no itch.io); caso contrário,
sempre `null` — o pipeline (`scraperIngest.ts`) roda `languageDetector.ts`
(franc-min + fallback DeepSeek) automaticamente antes de criar qualquer
material, nunca assume português.

Todo item passa pelo mesmo pipeline dos adapters automáticos (Fase 4): idioma
primeiro (D119), depois preço, depois dedupe por `(source_platform,
source_url)`, depois criação. Item duplicado ou não confirmado como PT/grátis
nunca vira material — fica registrado em `download_scraper_item_log` com o
motivo.

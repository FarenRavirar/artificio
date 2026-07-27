# Fase 0 — matriz de DOM real

Captura: 2026-07-27. Modo: HTTP GET sem renderização, com mesmo User-Agent do
`fetchSimple`. Fixtures e hashes: `apps/downloads/backend/test/fixtures/spec-089/`.

## Elegibilidade e templates

| Fonte | Endpoint/template | Status/amostra | Elegibilidade | Sistema | Tipo |
|---|---|---:|---|---|---|
| `opera_rpg` | seis listagens `/downloads/{aventuras,cenarios,personagens,personagens-digitais,regras-e-fichas,outros}` | 200; 13/38/31/2/42/8 itens | elegível; site dedicado ao OPERA RPG | 133 itens dedicados recebem `OPERA RPG`; o item explicitamente multi-sistema recebe `Multi-sistema`, sistema válido por decisão T0.7 | seção `aventuras` e `cenarios` é homogênea; `personagens`/`personagens-digitais` são fichas; `regras-e-fichas` mistura Regras e Ficha; `outros` é heterogênea |
| `opera_rpg` | `<a class="download-item">` | fixture real | elegível | sem campo estruturado por item; descrição às vezes cita OPERA/outro/multi-sistema | seção ou subseção, nunca título/descrição aberta |
| `opera_rpg` | arquivo direto (`pdf`, `zip`, `rar`, link externo) | HEAD de PDF 200, `application/pdf` | não aplicável: destino do material já descoberto na listagem | ausente | ausente |
| `itch_io` | `/physical-games/genre-rpg/lang-pt-BR` | 200; 77 resultados | parcial: físico + RPG, mas a lista ainda contém sinais de card/board; validar produto | ausente na listagem | ausente na listagem |
| `itch_io` | página individual | 200; fixture The Tusu's Mine | elegível só quando `Category=Physical game` e `Genre=Role Playing` ou tag inequívoca TTRPG/RPG de mesa | `Genre`/`Tags` podem trazer sistema, mas a fixture não traz sistema inequívoco | `Category`/`Tags` existem; `pamphlet`/`zine` não casam sozinhos com taxonomia central |
| `grimorios_e_dados` | storefront do autor | 200; 25 cards | parcial: mistura RPG, wargame e páginas inglesas | ausente na listagem | agrupamentos visuais não são estrutura consumida pelo parser |
| `grimorios_e_dados` | página individual itch.io | 200; fixture Machados & Bruxarias | mesmo corte por produto do `itch_io` | tags `OSR`/`rpg-de-mesa` descrevem estilo/categoria, não sistema exclusivo | `Category=Physical game`; tags não dão tipo central inequívoco nesta fixture |

Rotas OPERA da implementação estão vivas. A suspeita da task não procede:
`/downloads/regras-e-fichas` e `/downloads/personagens-digitais` respondem 200;
`/downloads/regras/` responde 404 e não substitui rota alguma.

## Cadeia runtime de idioma

| URL real | Classificação itch.io | Idiomas declarados | Hint do adapter | Detector | Desfecho atual |
|---|---|---|---|---|---|
| `https://gontijo.itch.io/thetususmine` | Physical game; Genre Role Playing; tag TTRPG | English + Portuguese (Brazil) | `pt` fixo pela listagem | pulado por `if (sourceLanguageHint !== 'pt')` | pode criar, apesar de título/descrição da página em inglês |
| `https://grimorios-e-dados.itch.io/machados-e-bruxarias` | Physical game; tags `rpg-de-mesa`/TTRPG | nenhum campo Languages na fixture | `null` | executado | texto real português segue para preço/dedupe/criação |

Prova executável existente cruza os dois pontos da cadeia:
`itchIoScraper.test.ts` prova que listagem/adaptor produz `sourceLanguageHint: 'pt'`;
`scraperIngest.test.ts` prova que esse valor pula `detectPortuguese` e alcança as
etapas seguintes. Não é falha do detector: ele não roda.

## T0.7 — OPERA

Corpus observado: 134 itens. Busca por declaração explícita de
`multi-sistema|diversos sistemas|qualquer sistema|vários sistemas` encontrou 1:
`Gaia 400X`. Decisão do mantenedor em 2026-07-27: `Multi-sistema` é sistema
válido, não ausência. Os 133 itens dedicados recebem `OPERA RPG`; `Gaia 400X`
recebe `Multi-sistema`. A extração continua reservada à Fase 3.

## Validação local

- `rtk tsc -p tsconfig.json --noEmit`: verde.
- `rtk vitest run` nos contratos, parsers, ingest e rota: 67 testes verdes.
- `rtk pnpm run lint`: verde, sem aviso; config renomeada para
  `eslint.config.mjs`, preservando o backend CommonJS.
- `rtk git diff --check`: verde.
- `rtk ls` e `rtk rg`: verdes no Windows após instalação de shims locais ao
  lado de `rtk.exe`.
- `specs/backlog.md` revisado: DEB-089-01/02/13/14/15 já cobrem os débitos
  conhecidos. Nenhum novo débito foi registrado sem decisão do mantenedor.

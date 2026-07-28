# Fase 3 — sistema e tipo

Execução local: 2026-07-27. Branch: `fix/089-fases-2-3`.

## OPERA

| Origem | `systemHint` | `materialTypeHint` |
|---|---|---|
| 133 itens dedicados | `OPERA RPG` | conforme seção abaixo |
| `Gaia 400X` | `null` | `cenario` |
| `/aventuras` | — | `aventura` |
| `/cenarios` | — | `cenario` |
| `/personagens`, `/personagens-digitais`, `/regras-e-fichas`, `/outros` | — | `null` |

As quatro últimas seções são heterogêneas ou não têm subseção estrutural estável no DOM.
Título/descrição não viram heurística. Gaia é identificada pela URL real estável observada,
não por busca textual aberta.

## itch.io e Grimórios

Uma implementação em `itchIoParser.ts` isola a tabela estruturada do painel real “More
information”; tabelas em descrição/conteúdo do usuário são ignoradas. Allowlists versionadas
aceitam somente tags inequívocas observadas e preservadas em fixture com proveniência:

- sistema: `Cairn`, `Dungeons & Dragons`;
- tipo: `Supplement` → `Suplemento`.

`OSR`, `PbtA`, `TTRPG`, `One-shot` e tags desconhecidas não viram hint. Zero candidato ou
múltiplos candidatos produz `null`. Fixture real
`itch-product-dnd-supplement.html` e `itch-product-cairn.html` provam sistemas/tipo positivos;
fixtures Tusu e Grimórios provam ausência/irrelevância. O wrapper Grimórios também é exercitado
diretamente. Entidade é usada em cópia para classificação e transportada
crua até a fronteira única da Fase 1, evitando decode duplo.

No OPERA, a fixture real de `/aventuras` e testes parametrizados das seis rotas provam os dois
tipos homogêneos e o `null` das seções heterogêneas. Os casos de aceite são aplicados ao
template ao qual pertencem; não se exige um caso semanticamente impossível em toda fonte.

## Escolha de parser

Regex mantida. O DOM consumido é tabela curta com linhas `<tr><td>label</td><td>links</td>` e
limite de página já existente; os seletores reais estão versionados. `cheerio` adicionaria
dependência para uma estrutura simples sem reduzir o contrato de aceitação por allowlist.

## Fallback

`MATERIAL_TYPES_ROLLOUT_FALLBACK` agora contém `Aventura` e `Não classificado`. Um 404 do
catálogo não elimina o tipo neutro nem aborta todo ingest. Erros diferentes de 404 continuam
falhando fechado.

## Validação

- 99 testes focados verdes (idioma, ingest, rotas e scrapers afetados).
- Backend completo: 389/389 testes.
- TypeScript verde.
- build verde.
- lint verde.
- `verify:api` exit 0; 3 warnings de paths ambíguos e 1 advisory `site path.remove`
  sem path/method no relatório inicial, sem alteração correspondente neste diff.
- T3.7 permanece para a Fase 5: exige serviço real com `nao-classificado`, não prova local.

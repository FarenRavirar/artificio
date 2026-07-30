# Tasks — 089

> **Origem:** medição da Fase 2 da spec 088 em beta (2026-07-27), inspeção do mantenedor no
> catálogo/painel de beta, e 1ª revisão do Codex. **16 defeitos**, com números e evidência em
> `spec.md`. Decisões de escopo fechadas pelo mantenedor — nenhuma task carrega decisão
> pendente.
>
> **Spec única, por decisão do mantenedor (2026-07-27).** O Codex recomendou fatiar em cinco
> (089 parser, 090 facetas/formulários, 091 comentários, 092 editor/onboarding, 093 OG); o
> mantenedor optou por manter tudo aqui. Consequência a ter em conta: o cutover de produção
> espera a spec inteira, não só as fases de parser.
>
> **Relação com a spec 090 — não é contradição da decisão acima.** A única parte que saiu foi
> **comentários** (Fase 6), e não por fatiamento: `downloads`, `site` e `mesas` precisam do
> mesmo sistema, e implementar só aqui garantiria três versões divergentes. A
> `090-packages-comments-compartilhado` é, portanto, uma spec de **pacote compartilhado +
> `accounts.`**, não uma fatia da 089. Reconfirmado pelo mantenedor na 3ª revisão do Codex
> (2026-07-27): as 10 fases seguem nesta spec; nada mais se move. O Codex voltou a propor o
> fatiamento ao revisar a **Fase 8** (spec própria de OG, por ela também travar o cutover) — o
> próprio parecer admite que manter dentro da 089 é "arquiteturalmente feio, operacionalmente
> rastreável". Decisão do mantenedor mantida: fica aqui.
>
> **Dependência declarada:** os requisitos 18-22 e 32-35 passam a ser entregues pela 090. A
> Fase 5 (gate de cutover) **não** depende deles — fecha a fatia parser/ingest/facetas, que é
> o que destrava produção.

---

## Fase 0 — Diagnóstico em DOM real

Nenhuma linha de extração é escrita antes desta fase fechar. É a trava que a spec 088 violou
em T2.5 e que gerou o retrabalho.

**Gate de fechamento** (derivado da revisão do Codex): endpoint e corpus do `itch_io`
decididos; matriz de templates registrada; fixtures persistidas com proveniência; sistema e
tipo avaliados como presente/ausente/não aplicável por template; idioma testado pela cadeia
runtime completa; ground truth de idioma baseada em **texto real**, não em idioma declarado
pela fonte; e diff provando que nenhuma extração foi implementada antes.

- [x] T0.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [x] T0.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase (`rtk git status/diff/log`, `rtk rg`, `rtk read`, `rtk pnpm`, `rtk tsc`, `rtk lint`, `rtk <test-runner>` — ver `AGENTS.md` §rtk pra lista completa). · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso. **Evidência 2026-07-27:** `rtk ls` e `rtk rg` corrigidos no Windows com shims locais; ambos revalidados com sucesso.
- [x] T0.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra (`AGENTS.md` — regra de comunicação do projeto). · feito quando: mensagens da fase seguem o registro.
> **Fase reprovada na 1ª revisão do Codex (2026-07-27) e reescrita.** Os critérios originais
> não impediam a repetição do erro da spec 088, e a revisão achou dois bloqueadores que a
> medição da Fase 2 não tinha revelado. Tasks T0.1a a T0.1c são novas e vêm antes de tudo.

- [x] T0.1a — **Validar elegibilidade semântica de cada fonte e endpoint** (requisito 40): o que a URL devolve é material de RPG de mesa? Confirmado que `itchIoScraper.ts:15` usa `/games/` (catálogo de **videogames**) em vez de `/physical-games/`. · feito quando: cada fonte tem veredito registrado — elegível, inelegível, ou parcial com critério de corte. **Evidência:** `phase-0-dom-matrix.md`; OPERA elegível, itch físico parcial com corte por produto, Grimórios parcial.
- [x] T0.1b — Capturar DOM real de `/physical-games/genre-rpg/lang-pt-BR` e confirmar que devolve RPG de mesa **antes** de trocar o endpoint (requisito 41). Não trocar um endpoint errado por outro não verificado. · feito quando: amostra real registrada, com veredito. **Evidência:** HTTP 200, 77 resultados, fixture versionada e `LISTING_URL` trocada para a rota física.
- [x] T0.1e — **Aplicar corte semântico por produto nas fontes itch.io parciais** (requisitos 40/40a): `Category=Physical game` mais `Genre=Role Playing` ou tag inequívoca `ttrpg`/`rpg-de-mesa`; ausência ou categoria divergente falha fechado. · feito quando: card/board/wargame não entra só por aparecer na listagem física, com teste positivo e negativo. **Evidência:** `parseItchIsTabletopRpg` compartilhado pelos dois adapters e teste de card game PWYW rejeitado.
- [x] T0.1c — **Matriz de templates por fonte e modo de aquisição** (requisito 46). A premissa de "uma página de produto por fonte" está errada: `opera_rpg` consome 6 páginas de seção e links diretos de arquivo (`operaRpgScraper.ts:20`), `itch_io` consome listagem **e** página individual, e `grimorios_e_dados` reutiliza `itchIoParser.ts:7` — o mesmo parser. · feito quando: matriz registrada (fonte × template × modo de aquisição), com os arquivos reais que cada uma toca. **Evidência:** `phase-0-dom-matrix.md`.
- [x] T0.2 — Observar, em cada template da matriz, onde (ou se) sistema e tipo aparecem. · feito quando: veredito por campo e por template — presente, ausente, ou não aplicável. **Evidência:** matriz por fonte/template/campo em `phase-0-dom-matrix.md`.
- [x] T0.3 — Persistir fixture com proveniência para cada template (requisito 45): URL, data, status HTTP, modo de aquisição (`fetchSimple`, Patchright, Camoufox) e hash. Capturar o que a produção realmente usa — HTML de HTTP quando `fetchSimple` devolve 200; DOM serializado só quando o fallback renderizado de fato ocorre. · feito quando: fixtures versionadas no repositório, não trechos inline na sessão. **Evidência:** `apps/downloads/backend/test/fixtures/spec-089/` e `provenance.json`.
- [x] T0.4 — **Reproduzir a cadeia runtime completa de idioma**, não `detectPortuguese` isolado: `listing → adapter → ScrapedItem → sourceLanguageHint → processItem → outcome`. Causa já identificada na revisão (bypass em `scraperIngest.ts:226` quando o hint é `'pt'`), mas o registro por item é o que prova. · feito quando: cada item tem URL, classificação do itch.io, idiomas declarados, hint recebido, se o detector rodou ou foi pulado, e desfecho. **Evidência:** tabela runtime na matriz + suíte focada incluída nos 66 testes verdes.
- [x] T0.1d — **Validar as 6 rotas de seção do OPERA** (`operaRpgScraper.ts:20`). Suspeita da revisão: o código usa `/downloads/regras-e-fichas` e `/downloads/personagens-digitais`, mas o site público navega 5 seções e usa `/downloads/regras/`; "personagens digitais" não aparece. Rota morta significa seção inteira nunca coletada — e o OPERA é 118 dos 141 materiais. Decisão do mantenedor: **corrigir nesta spec**, não adiar. · feito quando: cada uma das 6 rotas tem status HTTP e veredito registrados, e as quebradas estão corrigidas com fixture da rota real. **Evidência:** seis rotas 200; `/downloads/regras/` 404; suspeita não procede, logo nenhuma correção de rota.
- [x] T0.5 — Aplicar o contrato decidido pelo mantenedor: `systemHint: string | null` e `materialTypeHint: string | null` **obrigatórios** no contrato interno (`scrapers/types.ts:25`, hoje `?:` — omitir compila, que é o defeito 16). Entrada externa (`/ingest`) pode seguir opcional, normalizada com `?? null` na fronteira. Campo ausente e campo presente com `undefined` não são a mesma coisa; o contrato interno passa a exigir a afirmação explícita. Teste **não** substitui o contrato. · feito quando: adapter que omita qualquer um dos dois falha o `tsc`, com todos os consumidores verificados. **Evidência:** contrato obrigatório, fronteira externa normalizada, teste de tipo e `tsc` verdes.
- [x] T0.7 — **Decidir o significado de `systemHint` para a origem OPERA**, com dado observado — não por inferência. A área de downloads é declarada extensão do OPERA RPG (o que tornaria `systemHint = 'OPERA RPG'` defensável por origem), mas há item declarado multi-sistema, e `download_material` guarda **um** sistema. Levantar quantos itens declaram multi-sistema ou outro sistema, e então decidir com o mantenedor entre "compatível com" e "sistema exclusivo/principal". · feito quando: contagem real registrada e o significado do campo decidido — trava de T3.2. **Decisão 2026-07-27:** “compatível com”. 133 itens dedicados usam `OPERA RPG`; `Gaia 400X`, explicitamente multi-sistema, usa `null`. Esta decisão nominal substitui o registro anterior. Implementação permanece em T3.2.
- [x] T0.6 — Provar que **nenhuma extração foi implementada antes do diagnóstico**: `rtk git diff -- apps/downloads/backend/src/services/scrapers apps/downloads/backend/src/services/scraperIngest.ts` sem mudança de extração. · feito quando: diff limpo registrado — é a trava que a spec 088 não teve. **Evidência:** diff pré-diagnóstico vazio; alterações posteriores só tornam os dois hints obrigatórios e gravam `null` explícito, sem regra de extração.

## Fase 1 — Entidades HTML (defeito 4)

Primeira a implementar por ser a que contamina dado permanente (slug é URL pública).

- [x] T1.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada. **Evidência:** 475 linhas relidas integralmente antes da implementação da Fase 1.
- [x] T1.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T1.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
> **Fase reprovada na 1ª revisão do Codex (2026-07-27) e reescrita.** "Todo campo textual" era
> ambíguo o bastante para corromper URL e desfazer sanitização de HTML rico. A revisão também
> corrigiu três erros factuais da spec: `summary` **não existe** no contrato do parser (nasce
> de `description.slice(0,500)` em `scraperIngest.ts:277`); `TITLE_RE` está em
> `operaRpgScraper.ts:33`, não 49; e são **dois** parsers, não três (`itch_io` e
> `grimorios_e_dados` compartilham `itchIoParser.ts:100`).

- [x] T1.1 — **Política exaustiva por semântica** dos campos de `ScrapedItem` (requisito 10): `plainText`, `url`, `richHtml`, `opaque`, declarada de forma que campo novo **quebre a compilação** até ser classificado (`satisfies Record<keyof ScrapedItem, Policy>`). Enumera uma vez, centralmente — não espalha chamada campo a campo. · feito quando: acrescentar campo a `ScrapedItem` sem classificá-lo falha o `tsc`, com teste que prova. **Evidência:** `SCRAPED_ITEM_FIELD_POLICY` + teste de tipo/runtime.
- [x] T1.2 — **Pedir aprovação nominal** para adicionar `html-entities` como dependência do downloads (requisito 10b). Já existe no monorepo; decisão do mantenedor foi adicionar. · feito quando: aprovação registrada e dependência instalada. **Evidência:** aprovação nominal “Aprovado” em 2026-07-27; `html-entities@^2.6.0` instalado no backend.
- [x] T1.3 — Aplicar o decoder HTML5 **só** aos campos `plainText`, na saída de cada um dos **2** parsers (requisito 10/10a). `sourceUrl`/`coverImageUrl` intocados; `descriptionHtml` só por DOMPurify — decode depois do DOMPurify desfaz a sanitização. · feito quando: os campos de texto saem decodificados, e teste prova que URL e HTML rico não foram alterados. **Evidência:** OPERA, itch compartilhado e parser HTML genérico cobertos; matriz em `phase-1-entities.md`.
- [x] T1.4 — Garantir **fronteira única** de decodificação (requisito 10c): uma passagem só, na saída do parser. `routes/scraper.ts:147` já transforma `description` no `/ingest` — somar outro decode ali daria dupla passagem, e decode não é idempotente (`&amp;lt;` → `&lt;` → `<`). · feito quando: teste de reenvio `parse-html → ingest` prova que o texto não é decodificado duas vezes. **Evidência:** `/ingest` preserva entidades; teste real de reenvio mantém `&lt;`.
- [x] T1.5 — Fixtures reais para entidades **observadas** e fixture contratual para toda semântica: título, descrição, editora, créditos, sistema, tipo, URL e HTML rico (requisito 45). Não inventar entidade como “real” quando o corpus observado não a contém. · feito quando: as oito semânticas estão cobertas, incluindo as que **não** devem mudar, com proveniência real separada dos casos contratuais. **Evidência:** matriz em `phase-1-entities.md`.
- [x] T1.6 — Teste de **ingest** (não só de parser) provando o valor persistido de título, slug, `summary`, `publisher_name`, créditos e hints (requisito 11). Teste de parser não alcança `generateUniqueSlug`. · feito quando: teste cobre a cadeia até o banco, incluindo o casamento de `D&D` que a entidade crua sabotava. **Evidência:** `scraperIngest.test.ts` persiste `Guia de D&D`, slug `guia-de-d-d`, summary/editora/créditos e casa sistema/tipo.
- [x] T1.7 — Provar a **ordem**: texto normalizado antes de idioma, slug e taxonomia (requisito 11a, `scraperIngest.ts:228, 260, 264, 268`). Valor final correto não prova ordem correta. · feito quando: teste falha se a normalização for movida para depois de qualquer um dos três. **Evidência:** teste cruza saída normalizada com argumento do detector, slug e resoluções de `D&D`/`Regras`.

## Fase 2 — Idioma (defeito 3)

- [x] T2.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [x] T2.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T2.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
> **Fase reescrita após a revisão do Codex (2ª rodada).** Duas correções de fundo:
>
> 1. **A T2.3 anterior violava regra pétrea.** Ela mandava gravar o idioma detectado em
>    `download_material_metadata.language`, mas essa coluna aceita **exclusivamente** `'pt'`:
>    tipo literal em `db/types.ts:104` e `CHECK (language = 'pt')` na
>    `migration_022_download_scraper.sql`, ambos marcados `D119 (regra pétrea)`. O `'pt'`
>    hardcoded está **certo** — é a afirmação "este material é português", válida justamente
>    porque o item passou pelo filtro. O que falta não é trocar esse valor: é **persistir a
>    evidência** da detecção, que hoje só existe no log do item.
> 2. **O bypass não é só do itch.io.** `scraperIngest.ts:223` confia em qualquer
>    `sourceLanguageHint === 'pt'`, e esse valor também nasce de `<html lang>` no parser
>    genérico (`genericHtmlParser.ts:261`) e pode chegar direto pelo `/ingest`. Corrigir só
>    `itchIoScraper.ts:25` deixaria dois caminhos abertos.
>
> **Regra de desenho da fase:** sinal da fonte **nunca aprova; só pode rejeitar**. `not_pt`
> rejeita cedo; `pt` ou ausente caem no detector, sempre.
>
> **Critério de T2.1 reescrito na 1ª rodada.** A versão original exigia barrar três títulos
> ingleses conhecidos, mas `World's Doom` e `Grimm's Hollow` **têm** tradução pt-BR declarada —
> o critério estava factualmente errado. A regra passa a ser a decisão do mantenedor sobre o
> defeito 3b: exigir texto em português.

- [x] T2.1 — Remover a **aprovação por sinal positivo** em todos os caminhos, não só no itch.io (requisito 43): `sourceLanguageEvidence === 'pt'` não pula o detector. `not_pt` continua rejeitando cedo; `pt` e ausente passam obrigatoriamente pelo detector. Campo renomeado para deixar explícito que é evidência da fonte, não decisão. · feito quando: os três caminhos (`itchIoScraper`, `genericHtmlParser`, `/ingest` direto) convergem no detector, com teste que falha se o bypass voltar.
- [x] T2.2 — Aplicar a regra do requisito 42: material com página em inglês não entra, mesmo com tradução portuguesa declarada pela fonte. O log do item deve registrar **método e motivo** da decisão (sinal negativo da fonte, franc, heurística de texto curto, DeepSeek, baixa confiança ou indisponibilidade do desempate) — hoje grava só `outcome` e `detected_language`, sem dizer quem decidiu. Cabe em `error_detail`, sem migration. · feito quando: material de página inglesa é barrado e o log diz por qual método.
- [x] T2.3 — **Preservar** `download_material_metadata.language = 'pt'` (regra pétrea D119: tipo literal em `db/types.ts:104` + `CHECK` na migration 022) e persistir a evidência da detecção em `download_material.detected_language`, `language_confident` e `language_checked_at` — colunas que **já existem** (migration 022) e que `routes/moderation.ts` já grava, mas que o caminho do scraper nunca preencheu. · feito quando: material criado pelo scraper tem as três colunas preenchidas, `language` continua `'pt'`, e teste prova ambas as coisas.
- [x] T2.4 — Padronizar o código de idioma em **ISO 639-3** em detector e log. Hoje há mistura: `franc-min` devolve 639-3 (`por`, `eng`) e o desempate DeepSeek é instruído a devolver 639-1 (`pt`, `en`) — a mesma língua grava com dois códigos, e `moderation.submit.test.ts` já exibe os dois. `metadata.language` segue `'pt'` (não é código de detecção, é a marca do catálogo). · feito quando: nenhum caminho grava 639-1 em `detected_language`, com teste cobrindo franc e desempate.
- [x] T2.5 — Fallback conservador para texto curto como **constante versionada em código**, não tabela: receber entidades já decodificadas pela fronteira única da Fase 1, normalizar Unicode/espaço, casar **tokens inteiros** (nunca substring), exigir **múltiplos** sinais portugueses, e nunca aprovar por palavra ambígua (comum a pt/es/gl). O detector não faz uma segunda passagem de decode. Resultado insuficiente permanece indeterminado e segue ao desempate externo. · feito quando: fixtures cobrem português com acento, português sem acento, espanhol, galego, texto misto, título próprio e ausência de descrição — e nenhum falso positivo passa.
- [x] T2.6 — Atualizar a integração DeepSeek: **verificar** se `model: 'deepseek-chat'` (`languageDetector.ts:66`) ainda é o modelo vigente na documentação oficial antes de trocar — o achado de descontinuação veio da revisão, não do código —, e passar a usar `response_format: { type: 'json_object' }` em vez de pedir JSON só pelo prompt. Vazio, erro ou indisponibilidade continuam tratados como indeterminado (nunca aprovam). · feito quando: modelo confirmado contra a documentação, JSON mode ativo, e teste prova que falha do desempate não aprova material.
- [x] T2.7 — Medir o detector contra **corpus rotulado à mão** do endpoint correto (`/physical-games/`, ver T0), com matriz de confusão. O "0 de 14 barrados" da spec 088 não mede nada: veio do bypass, e daquele endpoint de videogame. Como a regra é "somente português", otimizar **precisão** — zero falso positivo; falso negativo pode ir para revisão manual. · feito quando: corpus rotulado versionado, matriz publicada, e o resultado esperado declarado por fixture — não por contagem agregada do tipo "barrar pelo menos 1".
- [x] T2.8 — Verificar se alguma consulta/consumidor assume `language = 'pt'` para todo material. Como a T2.3 **mantém** esse invariante, o esperado é que nada quebre — a busca serve para confirmar, e para achar quem porventura leia `detected_language` esperando 639-1. · feito quando: busca registrada, com lista de consumidores afetados ou constatação de que não há.

**Evidência Fase 2:** `phase-2-language.md`; contrato renomeado em parser/rota/ingest;
detector com ISO 639-3 validado contra o conjunto suportado, allowlist curta e DeepSeek V4
JSON mode; corpus real TP=4, TN=1, FP=0, FN=0, indeterminado=6; persistência das três colunas e metadata `'pt'` cobertas por teste. 99 testes
focados; backend completo 389/389 testes; TypeScript, build e lint verdes;
`verify:api` exit 0, com 3 warnings ambíguos e advisory `site path.remove` vazio no modo inicial.

## Fase 3 — Extração de sistema e tipo (defeitos 1 e 2)

Só começa com a Fase 0 fechada. Fonte que T0 provou não expor o dado recebe `null` explícito
e constatação registrada — nunca regex especulativa (requisito 7).

- [ ] T3.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · **falha processual não reparável retroativamente:** a implementação inicial começou antes da releitura. T0 foi depois relido integralmente e o diff F3 reauditado/corrigido, mas isso não satisfaz o critério temporal original.
- [x] T3.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T3.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
> **Fase reprovada na revisão do Codex (2026-07-27) e reescrita.** Quatro erros:
> as dependências citavam `T0.1/T0.2/T0.3` como se fossem "uma task por fonte" (não são —
> T0.2 é observação de campo e T0.3 é fixture); T3.2/T3.3 mandavam implementar em dois
> wrappers que **compartilham** o gerador `itchIoParser.ts:135`; faltava a política que
> decide **quando um sinal vira hint**, sem a qual "extrair conforme observado" reabre a
> classificação por chute; e T3.4 mirava um teste que já existe.
>
> **Dependência real de toda task desta fase:** T0.1c (matriz de templates) + T0.2 (veredito
> por campo/template) + T0.3 (fixture com proveniência) + T0.5 (contrato dos hints).

**Política de aceitação de hint** (vale para todas as fontes, requisito 7a). Um sinal só vira
hint quando é **inequívoco**. Em ordem de prioridade:

1. campo estruturado explícito da fonte;
2. tag inequivocamente de sistema ou de tipo;
3. seção de origem comprovadamente homogênea (só OPERA, ver T3.1);
4. **múltiplos candidatos, ou dúvida → `null`**;
5. título e descrição **nunca** viram heurística aberta.

O itch.io mistura em "Types" valores de naturezas diferentes (`TTRPG`, `OSR`, `PbtA`,
`Dungeons & Dragons`, `Supplement`), e "One-shot" aparece em *Gameplay* — pegar a primeira tag
ou tratar toda tag como hint produz classificação falsa. `null` é resultado correto; hint
inventado, não.

- [x] T3.1 — **OPERA: mapear tipo por seção, preservando hierarquia.** As seções não são um tipo cada: `/aventuras` e `/cenarios` são homogêneas (`Aventura`, `Cenário`), mas `/regras/` reúne Regras Oficiais, Fichas, Regras Extras e Adaptações; `/personagens` reúne fichas, guias, bestiário e regras; `/outros` é heterogênea. Seção heterogênea **não** recebe tipo global — desce à subseção ou fica `null`. Alvos válidos são só os do catálogo (`016_catalog_material_types_seed.sql`): Aventura, Suplemento, Cenário, Ficha, Mapa, Regras, Não classificado. `sourceCategory`, `tags` e `materialTypeHint` são campos distintos e **não** viram sinônimos. · feito quando: mapa seção/subseção → tipo registrado com evidência de T0.2, e teste prova que seção heterogênea não recebe tipo global.
- [x] T3.2 — **OPERA: `systemHint` conforme a decisão de T0.7.** Os 133 itens dedicados recebem `OPERA RPG`; `Gaia 400X`, explicitamente multi-sistema, recebe `null`, porque o campo significa “compatível com” e guarda um único sistema. · feito quando: comportamento implementado com os dois casos cobertos por teste.
- [x] T3.3 — **itch.io e Grimórios: uma implementação só, em `itchIoParser.ts`.** As duas fontes usam o mesmo gerador (`itchIoParser.ts:135`); o wrapper do Grimórios só troca URL e idioma. Implementar nos wrappers duplicaria a lógica. Fixtures **separadas** por origem; resultado diferente entre elas só quando o DOM justificar. Aplicar a política acima à tabela "More information" e às tags. · feito quando: extração vive no parser compartilhado, com fixture de cada origem, e teste provando que tag ambígua não vira hint.
- [x] T3.4 — **Aceite por template, não "teste verde".** A matriz cobre, no template ao qual cada caso é semanticamente aplicável: positivo conhecido; campo ausente → `null` explícito; tag irrelevante não vira hint; múltiplos candidatos → resultado determinístico; entidade HTML decodificada **antes** do casamento (depende da Fase 1); seção heterogênea sem tipo global; e alteração da fixture quebra o teste. · feito quando: todos os sete casos têm prova no template relevante, sem exigir tag itch em OPERA ou seção OPERA em itch.
- [x] T3.5 — **Avaliar parser DOM para a hierarquia OPERA e a tabela do itch.io.** Ampliar regex para estrutura aninhada é frágil; seletor CSS é mais robusto. `cheerio` seria **dependência nova** — exige perguntar ao mantenedor antes (`AGENTS.md`), não decidir na implementação. · feito quando: decisão registrada — regex mantida com justificativa, ou dependência aprovada e adotada.
- [x] T3.6 — **Corrigir o fallback do catálogo, não o teste.** O diagnóstico anterior desta task estava errado: `scraperIngest.test.ts:441` **já** falha quando o tipo neutro some (`catalog_material_type_not_found: nao-classificado`). O defeito material é outro: `MATERIAL_TYPES_ROLLOUT_FALLBACK` (`catalogClient.ts:107`) tem **uma** entrada, `aventura`, e `catalogClient.test.ts:124` consolida esse comportamento como esperado. Com o catálogo em 404, o fallback entrega um conjunto onde `nao-classificado` não existe — e o ingest aborta. Ou o fallback inclui o tipo neutro, ou é removido (era rollout isolado do site, já concluído). · feito quando: fallback corrigido ou removido, com o teste que o consolidava atualizado.

**Evidência Fase 3:** `phase-3-hints.md`; OPERA usa `OPERA RPG`, exceto Gaia `null`, e
tipa somente `/aventuras`/`/cenarios`, com as seis rotas cobertas; itch/Grimórios compartilham
parser isolado à tabela estruturada real, com allowlist inequívoca e fixtures separadas;
conteúdo livre é ignorado e múltiplos candidatos/irrelevantes ficam `null`;
fallback inclui `nao-classificado`. A implementação inicial começou antes da releitura T3.0a;
foi tratada como inválida, T0 foi relido integralmente e todo diff F3 foi reauditado/corrigido
antes desta evidência. 99 testes focados; backend completo 389/389 testes;
TypeScript, build e lint verdes; `verify:api` exit 0, com 3 warnings ambíguos e advisory
`site path.remove` vazio no modo inicial.
- [x] T3.7 — **Smoke na Fase 5**: confirmar no serviço real que `GET /api/catalog/v1/material-types` devolve `nao-classificado`. Contrato unitário (T3.6) não prova o serviço em pé — foi exatamente essa lacuna que derrubou o deploy do downloads em beta. · feito quando: resposta real registrada, com o tipo neutro presente.

## Fase 4 — Facetas navegáveis e limpeza do card (defeitos 5 e 6)

Ordem obrigatória: o link não existe antes da busca que ele abre. T4.4 depende de T4.2 e T4.3.

**Retomada pós-merge (2026-07-28):** PR #223 mergeada em `dev` no SHA `e250ed1`.
Branch de fechamento `feat/089-fases-4-5-fechamento` criada diretamente de `origin/dev`
atualizado e limpa. `spec.md`, `plan.md` e `tasks.md` foram relidos antes da retomada.
Escopo executável restante da Fase 4: provar T4.1/T4.11 no banco Beta após migration 032
e provar T4.8 por HTTP após deploy; não reimplementar o que já entrou no merge.

- [x] T4.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [x] T4.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T4.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
> **Fase reprovada na revisão do Codex (2026-07-27) e reescrita.** Dois bloqueadores e três
> lacunas de escopo:
>
> 1. **T4.1 violava a Fase 1.** Mandava aplicar `decode` na gravação, mas o requisito 10c
>    exige decode **exatamente uma vez**, na saída do parser. Somar outro no ingest corrompe
>    progressivamente (`&amp;lt;` → `&lt;` → `<`). E entrada manual não deve interpretar `&`
>    digitado pelo usuário como HTML. A Fase 4 **depende da Fase 1** e não decodifica nada.
> 2. **`credits` não é autor.** `combineCredits` (`scraperIngest.ts:48`) junta autores e
>    artistas numa string só separada por `\n`, e o formulário aceita texto livre
>    (`materialMetadata.ts:31`). O card já lê esse blob como `author`
>    (`MaterialCard.tsx:45`). Filtrar por aí faria artista virar autor e clicar filtraria a
>    combinação inteira.
>
> **Três decisões do mantenedor (2026-07-27)**, todas ampliando o escopo desta fase:
> **modelo estruturado** de autores/artistas; **facetas reais** (`/facets` com valor, rótulo
> e contagem), não só links; e chave normalizada + `robots.txt` + correção do gerador
> OpenAPI **dentro** desta fase.

- [x] T4.1 — **Modelo estruturado de autores e artistas** (requisito 13b). Hoje os dois colapsam em `credits` — um blob com `\n`, até 10 mil caracteres, que não cabe em URL nem distingue papel. Criar campos próprios com múltiplos valores, migrar os 141 materiais atuais (blob preservado como fallback quando não for separável), e ajustar as **duas** fronteiras de escrita. `pg_dump` antes. · feito quando: autor e artista são valores distintos e múltiplos, migração registrada, e nenhum material perde crédito. **Evidência Beta 2026-07-28:** migration 032 aplicada pelo runner oficial com `manual-risk`, advisory lock e transação após dump/restore-test. Tracking presente; 148/148 linhas de metadata preservadas, 90 créditos legados não nulos preservados, 12 `publisher_key` preenchidas; constraints de cardinalidade de autores/artistas presentes e validadas. Primeira invocação via stdin recebeu `database\r` e foi no-op gracioso; repetição sem CRLF aplicou exatamente uma vez.
- [x] T4.2 — **Chave normalizada de comparação, sem alterar o nome de exibição** (requisito 13). `trim` + colapso de espaço **não** unifica "Grimórios & Dados Editora" e "Grimorios e Dados": diferem em acento, `&`/`e` e sufixo. Normalização Unicode resolve representação equivalente, não equivalência lexical. Desenho: `publisher_name` preserva o nome oficial para exibição; uma **chave separada** (coluna + índice, migration) governa comparação e URL, com política explícita — Unicode, caixa, espaço, pontuação, `&`/`e`, sufixos societários. Testes de colisão obrigatórios: a política não pode fundir editoras distintas. · feito quando: as duas grafias produzem a mesma chave, nomes distintos não colidem, e a URL usa a chave — nunca o nome de exibição.
- [x] T4.3 — **Função de normalização única, aplicada nas duas fronteiras de escrita**: scraper (`scraperIngest.ts:324`) e formulário/API (`materialMetadata.ts:118`). Normalizar só uma deixa o acervo divergente conforme a origem. **Sem `decode`** — a Fase 1 já decodificou, e texto digitado não é HTML. Sem colapso cego de delimitador. · feito quando: o mesmo nome entrando pelas duas fronteiras produz a mesma chave, com teste cobrindo ambas.
- [x] T4.4 — **Filtro exato por editora e autor em `GET /materials`** (requisito 14). Hoje o schema não aceita nenhum dos dois (`materials.ts:33`). Igualdade **pela chave**, nunca `ILIKE '%valor%'` — isso seria busca textual, não faceta. O `leftJoin` de metadata hoje entra **depois** do count (`materials.ts:227`): o filtro exige que ele venha antes do `where` e da contagem, senão `total` e paginação divergem dos itens exibidos. Aditivo: chamada sem os parâmetros mantém o comportamento atual. · feito quando: filtro funciona e `items`, `total` e paginação são coerentes entre si, com teste que prova a coerência.
- [x] T4.5 — **`/facets` passa a devolver editora e autor** (requisito 14a), com valor, rótulo de exibição e contagem — hoje expõe só tipos, sistemas e edições (`materials.ts:108`). É aqui que "duas grafias produzem uma faceta só" se torna observável. · feito quando: as duas grafias aparecem como **uma** entrada, com a contagem somada.
- [x] T4.6 — **Frontend completo do filtro**, não só a leitura da URL. Pontos que hoje impedem o filtro de funcionar: `MaterialListFilters` (`types/material.ts:68`), serialização (`useMaterialsCatalog.ts:5`), e `isBrowsing` (`CatalogoPage.tsx:88`), que ignora filtro novo e **desliga a consulta** — o backend responderia certo enquanto a tela segue mostrando a vitrine. Somar: chip de estado ativo removível, limpeza, back/forward e deep link direto. · feito quando: deep link ativa o modo resultado com chip visível, back/forward preserva estado, e limpar volta à vitrine.
- [x] T4.7 — **Links no card sem colidir com o link estendido** (requisito 15). O título usa pseudo-elemento absoluto cobrindo o card inteiro (`MaterialCard.tsx:92`); link novo precisa de camada própria (`position`/`z-index`) e foco visível. Usar `<a>`/`Link` nativo — é navegação, não botão. Destino: recorte limpo, página 1, **sem herdar** filtro oculto do contexto. Sistema aponta ao `system_id` raiz, e o badge de cadeia inteira precisa de nome acessível ("Ver materiais de OPERA RPG"). · feito quando: clicar na editora **não** abre o material, teclado alcança cada link, e o propósito de cada um é entendível isoladamente.
- [x] T4.8 — **Política de crawl e `robots.txt`** (requisito 15a). Links reais tornam combinações de filtro descobertas pelo crawler — espaço quase infinito e desperdício de crawl; `canonical` sozinho não resolve. Estado inicial: o nginx esperava `/robots.txt` (`nginx.conf:40`), mas o arquivo não existia e devolvia 404. Decisão: **filtros não indexáveis; materiais individuais indexáveis**. SEO é inegociável (`AGENTS.md`). · feito quando: `robots.txt` versionado e servido com 200, bloqueando os query params de filtro, com a resposta real verificada. **Evidência Beta 2026-07-28 pós-deploy:** `GET /robots.txt` 200 `text/plain`, 225 bytes, bloqueando `q`, `material_type`, `system_id`, `edition_id`, `access_kind`, `publisher`, `author`, `sort` e `page`; resposta pública confirmada via Cloudflare/origem nginx.
- [x] T4.9 — **Corrigir o gerador de OpenAPI** (requisito 14b). `GET /api/v1/materials` hoje não documenta **nenhum** query param — nem os que já existem; o gerador também mantém contrato antigo do `POST` (`material_type` em vez de `material_type_id`). Editar o artefato gerado à mão se perde no próximo `verify:api`: a correção vai em `scripts/api/`. `verify:api` verde **não** prova semântica correta. · feito quando: o bundle gerado contém todos os query params, atuais e novos, com limites e semântica, e o contrato do `POST` bate com o código.
- [x] T4.10 — Remover o rótulo "Em português" do card (requisito 16) e corrigir a apresentação do label de editora (requisito 17). **Não** remover "Editora" do valor armazenado — o nome oficial se preserva; corrige-se a exibição (rótulo `Editora/selo:` ou prefixo condicional). · feito quando: nenhum card exibe rótulo de idioma nem "Editora Editora", e o valor no banco segue íntegro.
- [x] T4.11 — **Índices para o filtro** (requisito 14c). O estado inicial não tinha índice utilizável em `publisher_name`/`credits`. Com 141 materiais é irrelevante; com o acervo crescendo, filtro normalizado vira scan. A migration local cria B-tree em `publisher_key` e GIN em `author_keys`; a consulta usa essas colunas diretamente. · feito quando: migration aplicada e o plano de consulta confirma o uso. **Evidência Beta 2026-07-28:** índices `idx_download_material_metadata_publisher_key` e `idx_download_material_metadata_author_keys` presentes. `EXPLAIN` com `enable_seqscan=off` confirmou `Index Scan` B-tree para igualdade de `publisher_key` e `Bitmap Index Scan` GIN para `author_keys @> ARRAY[...]`; consulta real usa diretamente essas colunas.
- [x] T4.12 — Verificar as 10 Heurísticas de Nielsen nas facetas novas (`AGENTS.md`). Checklist **acompanhado de testes** — sozinho não basta: foco visível, estado ativo, limpeza e caminho de erro. Faceta vazia ou ausente não gera link. · feito quando: checklist registrado e os quatro comportamentos cobertos por teste.

  **Checklist:** visibilidade pelo chip/contagem; vocabulário “Editora/selo”/“Autoria”;
  controle por “Todas” e remoção; consistência sidebar/drawer; prevenção por ausência de link
  sem chave; reconhecimento por rótulo; eficiência por recorte limpo; minimalismo sem idioma;
  recuperação por erro textual mantendo filtros; ajuda pelo nome acessível do sistema. Testes
  cobrem foco/camada, estado ativo, limpeza, back/forward, ausência de chave e erro.

## Fase 5 — Medição em beta (a prova)

Espelha a medição que reprovou a Fase 2 da spec 088. Código verde não fecha esta spec.

**Retomada pós-merge (2026-07-28):** implementação local das Fases 0–4 está em `dev`; esta
fase agora é operacional. Ordem do `plan.md` preservada: deploy com SHA conferido → preflight
do catálogo → inventário/dump → autorização destrutiva própria → limpeza e runs sequenciais
→ SQL canônico → smoke visual. Deploy e escrita em VM/Beta continuam sem autorização nesta
retomada até pedido nominal separado.

- [x] T5.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [x] T5.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T5.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [x] T5.1 — `rtk pnpm run lint`, `rtk pnpm run build`, **`rtk pnpm run test`** e `rtk pnpm verify:api` verdes. O `test` faltava na versão anterior enquanto o plano exigia testes dos parsers — divergência documental. Cobrir o downloads e os consumidores tocados nas fases anteriores. · feito quando: os quatro exit 0. **Evidência local 2026-07-27:** raiz `lint` 23/23, `build` 23/23, `test` 35/35 e `verify:api` exit 0; focados adicionais: backend 72/72 e frontend 45/45.
- [x] T5.2 — Deploy do downloads em beta. **Exige autorização nominal.** `auto_deploy_on_push: false` (`deploy-manifest.json:129`): o deploy é `workflow_dispatch` manual, então "run verde" não diz qual código subiu. Registrar o **SHA implantado** e confirmar que contém as Fases 0-4 — sem isso a medição não está ligada ao código revisado. · feito quando: run verde, SHA registrado e conferido, drift check passou, containers healthy. **Evidência 2026-07-28:** primeira tentativa `30360627967` no SHA `e250ed1` foi bloqueada corretamente pelo guard `manual-risk` e fez rollback íntegro. Após autorização nominal, migration 032 aplicada/validada; repetição `30361333390` concluiu verde (CI + VM, drift e smokes). Clone Beta em `e250ed1a060c9e66ec799c2e95215f325f0479e7`; `downloads-beta-app/api/db` healthy; health público 200. `/facets` passou a expor `publishers` e `authors`, provando runtime novo. **Achado pré-recoleta:** acervo legado ainda contém entidade em `publisher_name` (`Grimórios &amp; Dados Editora`) e a chave backfill aparece `grimorios e amp dados`; resultado esperado antes de T5.4, pois o plano determina truncar/recoletar com a fronteira HTML corrigida. Não fechar T5.8 antes da recoleta.
- [x] T5.3 — `pg_dump` **novo** do acervo de beta antes de qualquer escrita, em formato custom (`-Fc`). Contar blocos `COPY` prova que há dado no arquivo, **não** que ele é completo ou restaurável. Exigir: exit 0 sem warning, checksum gerado, `pg_restore --list` legível, e o comando de restauração registrado. · feito quando: dump custom validado pelos quatro pontos, com caminho e hash registrados. **Evidência 2026-07-28:** dump `-Fc` novo, 133.472 bytes, salvo off-VM em `C:\projetos\artificiobackup\spec-089\20260728-094713\downloads-beta-pre-089-20260728-094713.dump`; SHA-256 VM/local `253d68bc1a4cb53c160c2ac887bc5b28eaf032b1c68140d6c52013611ea1452e`; `pg_restore --list` verde. Restore-test real em container PostgreSQL 16 isolado passou com `--exit-on-error --no-owner --no-privileges`: origem/restaurado = 29 tabelas, 31 migrations, 149 materiais, 148 metadata e 0 constraints não validadas. Container temporário removido. Restauração registrada: criar banco vazio PostgreSQL 16 e executar `pg_restore -U <owner> -d <db> --exit-on-error --no-owner --no-privileges <dump>`.
- [x] T5.3a — **Inventário read-only antes de qualquer escrita**: contagem de `download_material` por `source_platform`, e contagem de linhas em **cada uma das 16 tabelas** com FK para ele. Serve para responder duas perguntas: existe material humano (não-scraper) a preservar? Existe dado humano nas dependentes (favorito, coleção, comentário, denúncia, sugestão) que o `CASCADE` apagaria? · feito quando: inventário registrado por fonte e por tabela, com veredito explícito sobre dado humano. **Evidência 2026-07-27:** `manual=1`, `download_comment=1`. **Decisão do mantenedor 2026-07-28:** ambos eram testes; descarte autorizado como decisão de dados. **Reconfirmação imediatamente pré-write 2026-07-28:** materiais = OPERA 124, itch 14, Grimórios 10, manual 1; zero run ativa. Dependentes: metadata 148, item_log 288, link_check 164, destination 7, metric_daily 7, material_view 8, comment 1; demais 9 tabelas zeradas. Execução destrutiva mantém aprovação própria.
- [x] T5.3b — **Enumerar na spec as 16 tabelas atingidas pelo `TRUNCATE ... CASCADE`** antes de executar (decisão do mantenedor: TRUNCATE, precedido de inventário). `CASCADE` esvazia **toda** tabela referenciadora, inclusive as `ON DELETE SET NULL` (`migration_022:67`, `024:24`, `021:69`) — que num `DELETE` apenas perderiam a referência. Também toma `ACCESS EXCLUSIVE` e não dispara trigger `ON DELETE`. · feito quando: lista completa registrada, janela e comandos definidos, rollback declarado e aprovação nominal obtida. **Evidência 2026-07-28:** lista das 16 tabelas já em `spec.md`; janela, comandos, risco e rollback apresentados no formato "APROVAÇÃO NECESSÁRIA" e **autorizados nominalmente pelo mantenedor**. Rollback declarado: `pg_restore` do dump de T5.3 (`downloads-beta-pre-089-20260728-094713.dump`), com recoleta das três fontes como alternativa — Beta é ambiente descartável e prod ainda não está populado (decisão do mantenedor 2026-07-28). A execução emitiu exatamente 16 `NOTICE: truncate cascades to table`, batendo com a lista registrada — nenhuma tabela inesperada atingida.
- [x] T5.3c — **Preflight do serviço dependente, antes de apagar qualquer linha**: `GET /api/catalog/v1/material-types` responde 200 **e** contém `nao-classificado` (fecha o ciclo com T3.7). Foi exatamente a ausência desse preflight que deixou o acervo de beta vazio na rodada anterior — limpar antes de confirmar que o catálogo responde é repetir o incidente. · feito quando: resposta real registrada com o tipo neutro presente. **Evidência 2026-07-27:** HTTP 200, 7 tipos, `nao-classificado` presente.
- [x] T5.3d — **Painel de coleta na gestão, para o disparo das runs deixar de depender de `fetch` colado no console.** Escopo ampliado pelo mantenedor em 2026-07-28, dentro desta spec: a recoleta manual já se repetiu em várias rodadas e falhou de novo nesta por prefixo de rota errado (`/api/v1/scraper/run` devolve 404 do frontend; o router é montado em `/api/v1/admin/scraper`, `server.ts:109`). Decisão registrada do mantenedor: "melhor matar o mal pela raiz" — aceitar o ciclo completo de deploy em vez de poupá-lo e repetir o problema. Vive em `/gestao/plataformas`, que já é o registry das fontes. Seletor lista só plataforma com `supports_auto_scrape` (o backend valida o mesmo em `scraper.ts:433`); tabela de runs com polling de 3s, porque o disparo é fire-and-forget (`scraper.ts:77` responde 202); coluna de aceite aplica os seis critérios do T5.4 na tela, já que `status='completed'` não prova run saudável. · feito quando: lint/build/test verdes, `verify:api` exit 0, deploy em Beta com SHA conferido, e o painel dispara uma run real. **Evidência 2026-07-28 — implementado, revisado e no ar:** `hooks/useScraperRuns.ts` (+ `evaluateRunAcceptance`, `resolvePollInterval`), bloco `ColetaSection` em `GestaoPlataformasPage.tsx`, testes em `useScraperRuns.test.ts` e `GestaoPlataformasPage.test.tsx`. 1ª revisão do Codex na PR #224 apontou dois defeitos reais, corrigidos em `88a948b` e registrados como DEB-089-18: rotas GET usavam o rate limiter de escrita (60 req/15min) e o polling perpétuo de 3s o esgotava em ~3min; e a exclusão de runs concorrentes era só visual (`disabled` do botão), sem trava no backend — o advisory lock de `scraperScheduler.ts:51` cobre dois crons, não cron + rota manual. Agora `POST /run` usa `INSERT ... SELECT ... WHERE NOT EXISTS` e devolve 409. Verificação: backend 33/33, frontend 21/21, raiz `lint` 23/23, `build` 23/23, `test` 35/35, `verify:api` exit 0 com os 6 apps em `breaking=0`. PR #224 mergeada; deploy run `30368275570` verde; VM em `8352c4423459d6cb51b863d4fb78e8e895634fbc`; `downloads-beta-app/api/db` healthy. Smoke do path: `/api/v1/health` 200, `/api/v1/admin/scraper/runs` **401** (rota existe, exige auth) e `/api/v1/scraper/runs` **404** — exatamente o path errado que motivou a task. **Fechada 2026-07-28:** o mantenedor disparou as três runs pelo painel em Beta (`18:21`–`18:29` UTC), sem console e sem path digitado à mão. Os seis critérios do T5.4 bateram nas três — detalhe em T5.4.
- [x] T5.4 — Limpeza e recoleta das três fontes. **Escrita destrutiva — exige autorização nominal própria**, separada da autorização de deploy. Runs **sequenciais**, não três disparos simultâneos. Aceite por run, porque `status='completed'` **não prova run saudável** — `scraper.ts:64` marca `completed` sem olhar contador, e um run pode completar com zero itens ou com erro em todos: `items_found > 0`; `items_created > 0`; `items_skipped_error = 0` (ou exceção investigada e registrada); `found = created + duplicate + not_portuguese + error`; `run_id`, endpoint, `started_at` e `finished_at` registrados; nenhuma run anterior ainda `running`. · feito quando: os seis critérios batem nos três runs. **Estado local 2026-07-28 — limpeza executada, recoleta pendente:** preflights verdes antes da escrita (zero runs `running`; catálogo 200 com `nao-classificado` presente, 7 tipos, via `site-beta-app:4322`); snapshot pré-limpeza `opera_rpg=124`, `itch_io=14`, `grimorios_e_dados=10`, `manual=1` (149); `TRUNCATE download_material CASCADE` executado sob autorização nominal, cascata em 16 tabelas conforme a lista; pós-limpeza `download_material=0`, `download_material_metadata=0`, `download_scraper_item_log=0`, `download_comment=0`. **Recoleta executada 2026-07-28 pelo painel do T5.3d** (sem console, sem path manual), runs sequenciais, sem sobreposição — o backend passou a recusar concorrência com 409:

| fonte | run | found | created | duplicate | not_pt | error | soma | janela (UTC) | aceite |
|---|---|---|---|---|---|---|---|---|---|
| `opera_rpg` | manual | 137 | 80 | 0 | 57 | 0 | 137 | 18:21:40 → 18:22:57 | passou |
| `grimorios_e_dados` | manual | 11 | 7 | 0 | 4 | 0 | 11 | 18:25:13 → 18:26:09 | passou |
| `itch_io` | manual | 25 | 3 | 0 | 22 | 0 | 25 | 18:27:53 → 18:29:21 | passou |

Os seis critérios batem nas três: `status='completed'`, `items_found > 0`, `items_created > 0`, `items_skipped_error = 0`, soma fechando, e nenhuma run anterior `running` na largada de cada uma. Acervo resultante: 90 materiais (80 + 7 + 3).

> ⚠️ **Ressalva registrada — o acervo medido por T5.5–T5.8 está contaminado.** Achado durante a conferência pós-recoleta (2026-07-28): `detectWithFranc` (`services/languageDetector.ts:60`) deriva `confident` **apenas** da margem para o segundo colocado, sem checar se o topo é `por`. `francAll("Cat5Crew A party game ready to take you to space.")` devolve `[['por',1],['eng',0.82]]`, e como `0.82 < 0.95` o gate de `scraperIngest.ts:278` aprova. Dois dos três materiais do `itch_io` (`cat5crew`, `minihex`) entraram com `detected_language='por'` e `language_confident=true` sobre texto inglês — furo do D119. **Decisão do mantenedor 2026-07-28:** a correção fica na spec 090 (requisito 32, P0), não nesta; a contaminação é ressalva explícita deste gate. Consequência a carregar para T5.6: a taxa de rejeição por idioma medida aqui é **piso**, não valor real — o detector corrigido rejeitaria mais.
- [x] T5.5 — **SQL canônico versionado, read-only**, produzindo uma linha por regra com `pass`/`fail`, total e percentual — não "quatro queries" escritas na hora. Medir **por fonte e por template**: encontrados, criados, rejeitados, sistema casado, sistema pendente, sistema contabilizado, sistema bruto, tipo casado, tipo bruto, neutros, e os percentuais. Sistema ausente do catálogo não é casamento falho quando o caminho humano funcionou: `raw_system_hint` + sugestão de scraper pendente é o estado correto até aprovação; aprovar uma religa todas com o mesmo valor bruto. · feito quando: script versionado no repositório, executado, saída registrada. **Evidência 2026-07-28:** executado em `downloads-beta-db` dentro de `BEGIN TRANSACTION READ ONLY`, exit 0 e `ROLLBACK`. Saída integral, métricas e cruzamento registrados em `phase-5-measurement-output.md`. A primeira versão do gate exigia `system_id` antes da triagem e classificou incorretamente 79 sugestões OPERA válidas como falha; contrato e SQL corrigidos após confirmação read-only de 79/79 `raw_system_hint='OPERA RPG'` com sugestão `pending`. T5.5 fecha como execução da medição, não como aprovação do gate; rerun final depende da migration 033 e nova recoleta.
- [x] T5.5b — **[P0] Log de item perdeu 83 de 173 registros em silêncio — corrigir a coluna E a invisibilidade da falha.** Escopo ampliado pelo mantenedor em 2026-07-28 ("entra na 089 agora"), porque a Fase 5 inteira mede `download_scraper_item_log` e ele está incompleto. **Sintoma medido:** nas três runs de 18:21–18:29 UTC, `log_rows` bate exatamente `items_created` em todas — OPERA 80/80, Grimórios 7/7, itch 3/3 — e **nenhuma** das 83 rejeições por idioma existe no log. **Causa:** `'skipped_not_portuguese'` tem 22 caracteres e `outcome` é `VARCHAR(20)`; o insert viola o tipo e falha. `'skipped_duplicate'` (18) e `'skipped_error'` (13) cabem, e por isso o defeito só apareceu agora — foi a primeira recoleta sem nenhum duplicado. **Por que passou despercebido por três runs:** `logItem` (`services/scraperIngest.ts:108-125`) captura a exceção e termina em `console.error`. O `try/catch` está correto e é deliberado (achado da PR #193, CodeRabbit): falha de log **não pode** mudar a classificação do item nem abortar a run, e o outcome real já aconteceu antes da chamada. O defeito não é o catch existir — é a falha morrer em stderr de container que ninguém lê durante uma run, sem contador, sem `error_detail`, sem sinal na tabela de run. Observabilidade que só existe quando alguém está olhando não é observabilidade. · feito quando: (1) migration 033 aplicada em Beta — **autorizada pelo mantenedor sem backup em 2026-07-28**, por ser ambiente descartável que não toca o catálogo compartilhado de prod; (2) falha de gravação de log deixa rastro recuperável **sem** alterar o outcome do item nem abortar a run, preservando a razão do review da PR #193; (3) teste de regressão com o `outcome` mais longo do enum, que falha contra `VARCHAR(20)` e passa depois; (4) recoleta das três fontes, porque os 83 registros perdidos são irrecuperáveis; (5) `log_rows = items_found` conferido por run. **Checkpoint 2026-07-28:** (1) concluído em Beta pelo runner oficial, sem backup conforme autorização: `outcome VARCHAR(32)`, `item_log_failures`, `item_log_error_detail` e registro em `schema_migrations` conferidos; não houve intervenção manual a reconciliar. (2)-(3) implementados e implantados: contador atômico + último erro persistido na run, painel reprova/expõe a falha, teste com `skipped_not_portuguese`; backend 27/27 e frontend 12/12, lint/build dos dois pacotes e `verify:api` verdes. PR #225 mergeada em `dev`; redeploy autorizado run `30396262824` verde no SHA `509b5075939e189d88015370311efce3413e7138`; clone Beta no mesmo SHA, `downloads-beta-api`/`downloads-beta-app` healthy, health/home 200 e rota privada sem cookie 401. SQL read-only reexecutado sobre as runs antigas: parse/exit 0 e três falhas esperadas de `item_logs_reconciled` (80/137, 7/11, 3/25). **Fechada 2026-07-28 — (4) e (5) concluídos.** `TRUNCATE download_material CASCADE` executado na VM sob autorização nominal do mantenedor, precedido de inventário read-only (80/80 sugestões de sistema `pending`, nenhuma aprovada, portanto nenhuma curadoria humana perdida; `rating=1` órfão de material inexistente, sobreviveu por não ter FK viva). Cascata em exatamente 16 tabelas, batendo com a lista do T5.3b. Recoleta limpa disparada pelo mantenedor no painel (17:44–17:48 BRT / 20:44–20:48 UTC), sequencial, `skipped_duplicate = 0` nas três — prova de acervo zerado, não de dedupe. **Gate atingido:**

| fonte | items_found | log_rows | item_log_failures | antes (18h) |
|---|---|---|---|---|
| `opera_rpg` | 137 | **137** | 0 | 80 |
| `grimorios_e_dados` | 11 | **11** | 0 | 7 |
| `itch_io` | 25 | **25** | 0 | 3 |

`log_rows = items_found` nas três: os 83 rejeitados por idioma agora persistem, e nenhuma falha de gravação nova ocorreu com o código implantado. Migration 033 e rastro de falha provados em execução real, não só em teste.
- [x] T5.6 — **Critérios por taxa e ground truth, não absolutos herdados.** Os números 90/23 e "14 do itch.io" vieram de um corpus de 141 itens que **incluía videogames do endpoint errado**; a Fase 0 troca esse endpoint e corrige rotas do OPERA, então tamanho e composição mudam — comparar contra eles reprovaria melhoria ou aprovaria regressão. Limites vêm da matriz T0 e das fixtures. Regra crítica que falha reprova o conjunto. · feito quando: limites declarados por fonte antes da medição, e o resultado comparado contra eles. **Medição 2026-07-28 — bloqueada:** o resultado inicial de sistema OPERA `0/80` era interpretação errada do gate, não falha do ingest: 79/79 hints dedicados foram preservados como `raw_system_hint='OPERA RPG'` e abriram 79 sugestões `pending`; Gaia 400X ficou corretamente `null`. O SQL agora separa casado, pendente e contabilizado; rerun read-only passou sistema em todos os templates (`aventuras` 9/9; `cenarios` 22/23 = 95,65%; demais 48/48). **Tipo continua reprovado sem afrouxar o gate:** 32 hints originais existem em `download_scraper_item_log.material_type_hint` (`aventura` 9; `cenario` 23), casaram e por isso deixaram `raw_material_type_hint` nulo; os outros 58/90 não têm hint e ficaram neutros, 64,44% contra limite `<50%`. Ground truth observado 4/11 e taxonomia 2/4 porque 83 logs rejeitados não foram persistidos. Causa confirmada nos logs: `skipped_not_portuguese` tem 22 caracteres, mas `download_scraper_item_log.outcome` é `VARCHAR(20)`; migration 033 corrige localmente. A contaminação de idioma DEB-090-01 continua ressalva: taxa de rejeição medida é piso, não valor real. **Rerun definitivo 2026-07-28, sobre o acervo recoletado pelo código implantado (`509b507`) — 28 pass / 5 fail:**

| regra | número | veredito | causa |
|---|---|---|---|
| `catalog:neutral_type_minority` | 32/90 (64,44% neutros) | **fail** | extração de tipo; teto `<50%` |
| `taxonomy:fixture_ground_truth` | 2/4 | **fail** | mesma raiz da anterior |
| `language:portuguese_approved` | 4/7 | **fail** | DEB-090-01 |
| `language:ground_truth_observed` | 6/11 | **fail** | DEB-090-01 |
| `language:false_positives` | 11/11 | pass | — |
| `run:*` (6 regras × 3 fontes) | 18/18 | pass | inclui `item_logs_reconciled` 137/137, 11/11, 25/25 |
| `opera_rpg:*:system_accounted` | 5 templates | pass | 9/9, 22/23, 3/3, 1/1, 14/14, 30/30 |
| `opera_rpg:*:type_match` | 2 templates | pass | 9/9, 23/23 |
| `plain_text:entities` | 90/90 | pass | nenhuma entidade crua |
| `facets:shape` | 90/90 | pass | — |
| `slug:fixture_ground_truth` | 1/1 | pass | — |

Das 5 falhas, **3 são o DEB-090-01** (`cat5crew` e `minihex` reentraram como português confiante sobre texto inglês, confirmado no acervo novo) e **2 são a extração de tipo**. Nenhuma é defeito novo; nenhuma se corrige nesta spec — a de idioma está na spec 090 R32, a de tipo é o gate declarado antes da medição e mantido sem afrouxar. O que a recoleta corrigiu foi a **validade** dos números: as 18 regras de run agora passam, incluindo `item_logs_reconciled`, que falhava nas três fontes na medição anterior.
- [x] T5.7 — **Verificação de entidades sobre todos os campos `plainText`** definidos pela política da Fase 1, incluindo arrays e JSON (`scenario`, `tags`, `file_size_text`, `source_category`, `source_filters`), não só os cinco campos que o critério antigo olhava. Excluir URLs e `description_html`, onde entidade pode ser HTML legítimo. Para o slug, **comparar contra o esperado das fixtures que continham entidade** — a regex `slug ~ '-[0-9]{3}-'` reprovaria título legítimo como "Edição 100 do...". · feito quando: consulta derivada da política semântica, sem falso positivo de slug. **Evidência 2026-07-28:** `plain_text:entities` 90/90 pass (zero falhas) e `slug:fixture_ground_truth` 1/1 pass. Grimórios & Dados incluído no acervo; nenhuma entidade crua nos campos cobertos.
- [x] T5.8 — Verificar na interface de beta: as três facetas filtram ao clicar, grafias equivalentes viram faceta única, nenhum card exibe rótulo de idioma nem "Editora Editora". `/facets` tem **cache de 30s** (`materials.ts:95`): consultado durante a limpeza, devolve estado velho ou vazio e falsifica o smoke — aguardar o TTL ou invalidar antes de coletar evidência. · feito quando: os quatro pontos conferidos com o acervo recoletado, fora da janela de cache. **Executada 2026-07-28 sobre o acervo recoletado, fora da janela de cache** (runs terminaram 17:48 BRT; smoke às 17:55, muito além do TTL de 30s). Três dos quatro pontos passam; um reprova por bug novo:

| ponto | veredito | evidência |
|---|---|---|
| grafias equivalentes viram faceta única | **pass** | `/facets` devolve `{"value":"grimorios e dados","label":"Grimórios & Dados Editora","count":7}` — o `amp` sumiu, fechando o achado registrado no T5.2 |
| nenhum "Editora Editora" | **pass** | labels limpos em todas as 4 entradas de `publishers` |
| facetas filtram ao clicar | **fail** | `publisher` funciona (`grimorios e dados` → 7, `bibitenco` → 1, batendo com as contagens); **`author` devolve HTTP 500 para qualquer valor** |
| nenhum card com rótulo de idioma | pendente | verificação de UI, não coberta por API |

**Bug novo — DEB-089-20:** `GET /api/v1/materials?author=<qualquer>` responde **500**, não lista vazia. `materials.ts:204` faz `.where('author_keys', '@>', [author])`; o Kysely serializa o array JS como parâmetro escalar e o Postgres aborta com `malformed array literal: "leo andrade"` (SQLSTATE `22P02`). Não é dado ausente: o banco tem 9 materiais publicados com `author_keys @> ARRAY['leo andrade']` e `/facets` anuncia 30 entradas de autoria — todas quebram ao clicar. `publisher` escapa por usar `=` em coluna escalar. **Corrigido 2026-07-28** sob autorização nominal, depois de o achado reaparecer na revisão da PR das Fases 6B-8: a condição passou a montar o array em SQL (`author_keys @> ARRAY[${author}]`), com o valor ainda como bind. Provado no banco de Beta via `PREPARE`/`EXECUTE` — `leo andrade` 9, `intruder` 2, inexistente 0 (lista vazia, não 500). Teste de regressão compila o fragmento pelo dialeto Postgres real e asserta `ARRAY[$1]` com `parameters: ['agata']`. A decisão da 090 R29 (autoria sai das facetas) continua valendo; o que muda é a rota não devolver mais erro interno até lá.
- [x] T5.9 — Se algum critério falhar, **parar e reportar** com os números — não fechar a spec como parcial. · feito quando: ou todos os critérios batem, ou o bloqueio está registrado com evidência. **Acionada na medição inválida de 2026-07-28 — não verde:** bloqueio e números registrados em T5.6 e `phase-5-measurement-output.md`; Fase 5 permanece aberta. Após T5.5b, executar novamente e fechar como **reprovada**, nunca verde: tipo já reprova em 58/90 = 64,44% neutros, e idioma carrega a contaminação DEB-090-01.

**Relatório final 2026-07-28 — Fase 5 REPROVADA, com base de medição válida.** O rerun rodou sobre acervo limpo (TRUNCATE + recoleta) gerado pelo código implantado em `509b507`, então os números medem o que prometem — diferente da rodada anterior, que media acervo velho com log incompleto. Resultado: **28 pass, 5 fail** em 33 regras.

**Os 3 bloqueios, nenhum corrigível dentro desta spec:**

1. **Extração de tipo — 58/90 neutros (64,44%), teto `<50%`.** Reprova `catalog:neutral_type_minority` e `taxonomy:fixture_ground_truth`. Os 32 hints que existem casaram corretamente (`aventura` 9, `cenario` 23, conferidos em `download_scraper_item_log.material_type_hint`); os outros 58 materiais simplesmente não têm hint na fonte. Gate mantido sem afrouxar, conforme decisão registrada — a proposta de trocá-lo por "100% dos itens com hint resolvem tipo" foi recusada por ser vacuamente verdadeira sobre o conjunto medido.
2. **Detector de idioma — DEB-090-01 (P0).** Reprova `language:portuguese_approved` (4/7) e `language:ground_truth_observed` (6/11). `cat5crew` e `minihex` reentraram no acervo novo com `detected_language='por'` e `language_confident=true` sobre texto inglês, exatamente como previsto. Correção vive na spec 090 R32.
3. **Faceta de autoria — DEB-089-20.** `?author=` devolve 500 em rota pública. Marcado no código por decisão do mantenedor; correção adiada porque a 090 R29 remove a faceta.

**O que a Fase 5 provou que está correto:** fronteira de decode HTML (`plain_text:entities` 90/90, `grimorios e amp dados` eliminado), forma das facetas (90/90), casamento de sistema em todos os templates do OPERA, e integridade das runs (18/18 regras, incluindo `item_logs_reconciled` nas três fontes).

Fase 5 **não fecha como verde e não deve ser reaberta para "passar"** — os três bloqueios são achados legítimos com destino registrado. Fechamento da spec 089 depende deles nas specs correspondentes, não de nova medição aqui.

---

## Fase 6 — ➡️ MOVIDA PARA A SPEC 090

> **Decisão do mantenedor (2026-07-27):** comentários saem desta spec e viram
> `specs/090-packages-comments-compartilhado/`. Motivo: `downloads`, `site` e `mesas` precisam
> de comentários, e implementar só no downloads garantiria três versões divergentes do mesmo
> sistema. O desenho correto é um pacote compartilhado (`@artificio/comments`) vinculado ao
> `accounts.`.
>
> **Requisitos 18-22 e 32-35 desta spec passam a ser entregues pela 090** (Fase 3, adoção no
> `downloads`). Enquanto a 090 não fechar, essa parte da 089 fica em aberto — não é débito
> esquecido, é dependência declarada.
>
> As tasks abaixo ficam registradas como referência do que a 090 absorveu, e **não devem ser
> executadas aqui**.

Identidade vem do `accounts.` (SSO), não de `download_creator` — essa é tabela de criador de
material, não de usuário (o único registro em beta é o creator sintético do scraper, com
`user_id` nulo).

- [ ] T6.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [ ] T6.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] T6.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro.
- [ ] T6.1 — Obter nome e avatar do `accounts.` a partir do `user_id`, com cache (requisito 18). Precedente de desenho: `catalogClient` cacheia a taxonomia por 60s. · feito quando: `GET /comments/:materialId` devolve identidade, com teste.
- [ ] T6.2 — Garantir que indisponibilidade do `accounts.` **degrada a identidade sem derrubar a listagem** (requisito 19). Rota pública não pode depender de serviço externo para responder. · feito quando: teste com o `accounts.` fora prova que a lista carrega.
- [ ] T6.3 — Exibir autor (nome e avatar) na caixa de comentários (requisito 20). · feito quando: comentário mostra quem comentou.
- [ ] T6.4 — Migration de `parent_id` em `download_comment` (requisito 21). Header de 5 campos, idempotente, em `apps/downloads/database/`. · feito quando: migration passa no guard de CI e roda 2x sem erro.
- [ ] T6.5 — Aceitar e persistir resposta a comentário, com profundidade limitada (requisito 21). O limite é explícito: sem ele, encadeamento infinito quebra layout e dificulta retirada por denúncia. · feito quando: resposta persiste com `parent_id`, e profundidade além do limite é rejeitada com teste.
- [ ] T6.6 — Exibir a hierarquia de resposta de forma legível, sem aninhamento infinito (requisito 22). · feito quando: thread renderiza com a relação visível.
- [ ] T6.7 — Devolver o papel do autor junto do comentário e exibi-lo quando aplicável — autor do material, moderador, admin (requisito 34). Usuário comum não recebe rótulo. · feito quando: os três papéis aparecem distintos, e usuário comum não.
- [ ] T6.8 — Listar no painel os comentários recebidos nos materiais do próprio autor (requisito 32) e permitir responder dali (requisito 33). · feito quando: autor vê e responde sem sair do painel.
- [ ] T6.9 — UI para moderador/admin editar material alheio e retirar comentário (requisito 35). **O backend já autoriza** (`materials.ts:637-638`, `comments.ts:63`) — falta só a interface. · feito quando: as duas ações são possíveis pela UI, sem chamada manual à API.

## Fase 6B — Pré-requisitos de segurança do `mesas` (trava de início da Fase 7)

> **Decisão do mantenedor (2026-07-28): as duas correções [P0] do `mesas` entram aqui como fase
> própria da 089.** Elas estavam na Fase 7 da spec 090 (`T7.1` e `T7.1b`), que é a *adoção no
> `mesas`* — ou seja, só chegariam depois de toda a construção do `accounts.` (Fases 0-6 da 090),
> travada atrás de aprovação nominal + SDD Completo. Resultado: dois bugs de segurança correntes
> ficavam presos atrás de uma spec bloqueada, e a Fase 7 desta spec esperava um deles.
>
> Nenhuma das duas depende de comentários, `accounts.` ou `packages/comments` — são defeitos do
> `mesas` que existem hoje, anteriores às duas specs. Executá-las aqui destrava a Fase 7 da 089 e
> adianta trabalho da 090.
>
> ⚠️ **Escopo fora do `downloads`.** Esta fase toca `apps/mesas` (backend e frontend), não o
> `downloads`. Ampliação de escopo autorizada nominalmente pelo mantenedor em 2026-07-28.
>
> 🔁 **Sincronizar com a 090 ao fechar:** `T7.1` e `T7.1b` da spec 090 devem ser marcadas como
> **absorvidas por esta fase**, apontando para o PR, para ninguém implementar duas vezes. A 090
> requisito 26aa e 26b continuam válidos como requisito — muda quem executa, não o contrato.

- [x] T6B.0a — `AGENTS.md` e T1 pertinente lidos antes da implementação; autorização, escopo, bug achado e trava de merge identificados.
- [x] T6B.0b — `rtk` usado em diagnóstico e validação sempre que havia equivalente.
- [x] T6B.0c — Comunicação da fase mantida em português, caveman ultra.
- [x] T6B.1 — 🔒 **[P0] Exposição e interação com mesa não pública corrigidas localmente.** Detalhe, `/view`, `/click` e favoritos usam a mesma política: `status='active'`, `archived_at IS NULL` e mesa importada não expirada. Rascunho, arquivada e expirada devolvem 404. Sete testes de rota cobrem o contrato. O bug adjacente autorizado de `POST /tables/:slug/click` sem body também foi corrigido (`req.body ?? {}`).
- [x] T6B.2 — 🔒 **[P0] Markdown de usuário sanitizado localmente.** `sanitize-html` foi declarado como dependência runtime do backend; escrita e leitura defensiva cobrem bios, descrição de grupo e os cinco campos Markdown de mesa. O preview usa `html: false`. Payload hostil é removido e Markdown legítimo preservado por testes.
- [x] T6B.3 — `RichTextArea.tsx` removido. Zero consumidores; manter `dangerouslySetInnerHTML` morto não tinha benefício nem contrato a preservar.
- [x] T6B.4 — Acervo medido read-only em **Beta e Prod**. Beta: 12 perfis, 6 bios preenchidas, 0 descrições de grupo, 0 HTML/entidade/Markdown nos perfis; 19 mesas, 0 HTML/entidade e 1 descrição com Markdown reconhecido. Prod: 23 perfis, 15 bios preenchidas, 0 descrições de grupo, 0 HTML/entidade/Markdown nos perfis; 66 mesas, 0 HTML/entidade e 3 descrições com Markdown reconhecido. **Decisão do mantenedor:** sem migration retroativa; sanitização na escrita + defesa na leitura.
- [x] T6B.5 — Validação local verde: backend 59 arquivos/626 testes; frontend 19 arquivos/191 testes; testes focados 19/19; builds backend/frontend; lint do backend e raiz; `rtk pnpm verify:api`; `rtk pnpm run build` raiz 23/23. Mesa pública coberta por teste; ocultas retornam 404. **Ainda não entregue:** falta commit/PR/merge/deploy.

## Fase 7 — Conteúdo rico e formulário do autor (defeitos 8, 9, 10, 11)

✅ **Autorização nominal dada pelo mantenedor em 2026-07-28:** criar
`packages/content-editor`, migrar `downloads` e `mesas`, incluir migrations, testes e
manifests. Escopo ampliado no mesmo turno: todo texto livre autoral dos dois projetos usa o
editor GFM; campos curtos/estruturados continuam inputs e fontes brutas continuam textareas.

> **Fase reprovada na revisão do Codex (2026-07-27) e reescrita.** Três premissas eram falsas:
>
> 1. **O `downloads` já tem editor rico.** `RichTextEditor.tsx:71` é TipTap/HTML, em uso por
>    `GestaoEditarDescricaoPage`. A T7.1 mandava "extrair o editor do `mesas`" — que é
>    **Markdown** (`MarkdownEditor.tsx`), formato incompatível. Unificar mudaria o contrato
>    persistido do `mesas`, não só a UI.
> 2. **T7.3 contradizia a arquitetura existente.** `description_html` já é o campo rico,
>    sanitizado na escrita e na leitura (`materialMetadata.ts:48`); `description`/`summary` são
>    **texto plano** por contrato, e há três consumidores que dependem disso: detecção de
>    idioma (`moderation.ts:47`), card (`MaterialCard.tsx:100`) e página do criador
>    (`CreatorPage.tsx:46`). Aceitar HTML neles vazaria tag para busca, idioma e integrações.
> 3. **T7.5 dizia "o backend já tem `generateUniqueSlug`".** É função **privada** do scraper
>    (`scraperIngest.ts:55`) e exige `sourceUrl`. A criação manual segue exigindo slug no
>    payload (`materials.ts:90`).
>
> 🔒 **Pré-requisito de segurança — trava de início da fase.** O `mesas` renderiza preview com
> `markdown-it` `html: true` sem sanitizar (`MarkdownEditor.tsx:15`, 6 telas), e o backend do
> `mesas` **não sanitiza rich text na escrita** — violação corrente da regra pétrea do
> `AGENTS.md` ("sanitizar sempre antes de persistir/renderizar"). Alcance medido em 2026-07-27:
> **não é XSS ativo hoje** — nenhuma tela pública renderiza esses campos como HTML
> (`dangerouslySetInnerHTML` existe em um único ponto, `RichTextArea.tsx:153`, sem consumidor).
> O risco é que esta fase propõe justamente passar a renderizar conteúdo rico: dado envenenado
> + renderização nova = XSS no mesmo commit. Decisão do mantenedor: **corrigir antes, em PR
> próprio** (`fix/mesas-sanitize-richtext`), fora desta spec. Esta fase não começa sem ele.

- [x] T7.0a — `AGENTS.md` inteiro lido; pacote compartilhado, escopo, commit/push e `verify:api` identificados como travas.
- [x] T7.0b — `rtk` usado onde cobria. Exceção: `rtk read` falhou com `program not found`; leitura pontual usou `Get-Content`.
- [x] T7.0c — Comunicação mantida em português, caveman ultra.
- [x] T7.0d — **Trava aberta em 2026-07-28: fix da Fase 6B mergeado em `dev`.** PR #226 (`feat/089-fases-7-8` → `dev`), merge commit `353d95f`. Entram na `dev` `bf501ad` (visibilidade uniforme + sanitização), `27fe800` (CVEs `sanitize-html`/`postcss`/`linkify-it` + achados de review) e `684fbfd`/`9a3777b` (segunda rodada de review: predicado de visibilidade extraído para `utils/tableVisibility.ts`, fronteiras do Markdown endurecidas). **Deploy ainda não feito** — beta e prod seguem no código anterior; a trava desta fase era o merge, não o deploy.
- [x] T7.1 — **Formato e centralização decididos pelo mantenedor em 2026-07-28** (requisito 27): um único `ContentEditor`, um único contrato `string` e um único formato persistido, Markdown GFM, com UX Escrever/Prévia no modelo do GitHub. Destino: `packages/content-editor`, não `packages/ui`; não criar implementações `/html` e `/markdown`. Custo registrado: `mesas` preserva o acervo Markdown; `downloads` abandona TipTap/HTML e precisa de migration HTML→GFM explícita, potencialmente lossy, verificável e com rollback. · feito quando: formato decidido por módulo, com o custo de migração de cada opção registrado.
- [x] T7.2 — Aprovação nominal recebida. `packages/content-editor` criado com dependências já presentes (`react`, `markdown-it`, `dompurify`, `sanitize-html`), GFM, Escrever/Prévia, toolbar e task lists. TipTap/editor local removidos ou adaptados. Lint/build verdes nos cinco pacotes; focados `12/12`, `25/25`, `10/10`, `23/23`; `verify:api` exit 0. Bundle `downloads` 384,45 KB; `mesas` 1.216,30 KB mantém warning >500 KB, pendente de decisão. **Follow-up Sonar 2026-07-29:** finding da PR #227 confirmado; os quatro `pnpm install --prod` do estágio production agora usam `--ignore-scripts`. Builder permanece com lifecycle habilitado para build; Patchright instala Chromium explicitamente depois.
- [x] T7.2a — Escopo ampliado aplicado: descrições, bios/perfis, reviews, comentários, avaliações, sessões, contato, denúncias, feedback e sugestões usam editor/renderer compartilhado e sanitização na escrita/leitura. Aliases, título/nome/URL/slug e fontes HTML/Discord permanecem literais/estruturados.
- [ ] T7.3 — **Implementação local concluída; ensaio real da migration pendente.** `description_markdown` é a fonte rica; `description`/`summary` são projeções planas atômicas; limite 50.000 e payload hostil cobertos. Migration 034 é `manual-risk`/backup obrigatório: faz backfill deliberadamente lossy de `download_material.description` e preserva `description_html` para rollback/auditoria; não converte HTML por regex. Docker/PostgreSQL local estão indisponíveis. O gate `test:migrations:postgres`, ligado ao PostgreSQL 16 descartável do CI, aplica baseline 001–033, semeia conteúdo, aplica 034, confere conteúdo/contagem, prova rollback e reaplica duas vezes. Falta a primeira execução real no CI da PR; não usar Beta/Prod para substituir esse aceite.
- [x] T7.4 — `markdownToPlainText` deriva `description` e `summary` (320 caracteres) na mesma transação; cards/SEO continuam consumindo projeção sem marcação. `<head>` fica na Fase 8.
- [x] T7.5 — **Slug automático, com helper reutilizável no backend** (requisito 23). `generateUniqueSlug` é função **privada** do scraper (`scraperIngest.ts:55`) e exige `sourceUrl` — não serve à criação manual, que hoje ainda exige slug no payload (`materials.ts:90`) e no formulário (`NovoMaterialPage.tsx:17`). Corrigir junto a **divergência de limite** (decisão do mantenedor): a API aceita 200 caracteres (`materials.ts:90`) e o banco 160 (`migration_001:13`) — entrada entre 161 e 200 estoura no banco. Exigir: limite único, fallback para título sem caractere útil, colisão com retry apoiado no índice `UNIQUE`, testes de Unicode e concorrência. Slug gerado **só na criação** — editar título não muda URL (SEO: slug publicado é URL permanente; mudança futura exige 301). · feito quando: formulário não exibe slug, material criado tem slug derivado e único, limite consistente entre API e banco, e teste de concorrência passa. **Evidência real 2026-07-29:** helper backend centraliza limite 160, Unicode, fallback, sufixo e retry no índice; scraper reutiliza a regra; formulário/hook não exibem, tipam nem enviam slug; OpenAPI recebe só título/tipo. Frontend 6/6 e backend helper+rota 33/33 verdes.
- [x] T7.6 — **Testar primeiro o `Select` que já existe** em `packages/ui` (`primitives.tsx:208`, com fundo e cor em `styles.css:910`). O `downloads` usa `<select className="... bg-transparent">` direto (`NovoMaterialPage.tsx:67` e outras telas) — o defeito pode ser não-adoção do componente, não bug do pacote. Só mexer em `packages/ui` se o defeito persistir **com** o componente adotado — e aí com aprovação nominal própria. · feito quando: adoção testada e o veredito registrado. **Evidência real 2026-07-29:** os seis `<select>` crus dos cinco arquivos Downloads adotaram `Select`; classes locais de aparência foram removidas, preservando somente `w-full`/`min-w` de layout. Não entrou `Field`: seu contrato aceita erro textual, mas não a ação de retry exigida pelo formulário. Suites das cinco páginas 48/48 e primitive UI 8/8 verdes.
- [ ] T7.7 — Corrigir o contraste do `<select>`/`<option>` no escopo decidido em T7.6. Aceite: Windows/Chrome, temas claro e escuro, **picker aberto** (é onde o defeito aparece), navegação por teclado, e contraste mínimo **4,5:1** (WCAG 2.2). · feito quando: os cinco pontos verificados, não só "legível na tela". **Implementação real 2026-07-29:** contrato central em `packages/ui/src/styles.css` define `color-scheme` por tema e cores de `option`/`optgroup`; os seis controles Downloads agora o recebem via `Select`. CSS duplicado foi removido de Mesas/Glossário. Aceite visual/teclado segue aberto: Browser interno falhou antes de inicializar (`failed to write kernel assets ... path not found`); Chrome real exige autorização nominal.
- [x] T7.8 — **Campo de sistema exige mudança de backend, não só UI** (requisito 28). `patchMaterialSchema` e `EDITABLE_FIELDS` **não incluem** `system_id` nem `edition_id` (`materials.ts:51`) — a UI não teria onde gravar. Validar o nó contra o catálogo central, aceitar só taxonomia permitida, e resolver a invariante: trocar de sistema torna `edition_id` incompatível — limpar na mesma transação, ou a UI edita os dois juntos. Decisão a registrar antes de implementar. Permissão **já está correta** (`materials.ts:637`: dono, moderador ou admin) — o defeito é de contrato e UI. · feito quando: backend aceita os campos com validação de taxonomia, a invariante de edição está resolvida, e o autor altera o sistema do próprio material. **Decisão/evidência 2026-07-29:** mantenedor decidiu que trocar sistema limpa edição incompatível. Backend valida UUID, raiz e pertencimento no snapshot Central, faz limpeza e histórico na mesma transação e devolve 503 se o catálogo estiver indisponível. UI oferece sistema e edição/variante, limpa edição ao trocar raiz e só envia taxonomia quando mudou. Backend 10/10, frontend 19/19, lint/build dos dois pacotes e `verify:api` verdes.
- [ ] T7.9 — **Upload de capa: a infra apontada não serve** (requisito 29). `storage/cloudinaryAdapter.ts` gerencia **arquivo raw/PDF** (`resourceType: 'raw'`), não imagem; e `@artificio/media` não recebe `upload_preset` (`packages/media/src/index.ts:65`). Hoje o metadata aceita **qualquer URL HTTP** (`materialMetadata.ts:33`). Construir: endpoint backend autenticado; signed preset explícito; validação combinada de extensão, MIME, **assinatura real do arquivo**, dimensão e tamanho (Content-Type sozinho não basta); pasta e `public_id` definidos; rollback se o upload passar e o banco falhar; remoção segura da capa anterior; URL e `public_id` persistidos **separadamente**. **Nunca credencial no frontend** (`AGENTS.md`). · feito quando: os oito pontos implementados, com teste de arquivo hostil (extensão válida, conteúdo não-imagem). **Implementação local 2026-07-29:** endpoint raw autenticado aceita JPEG/PNG/WebP até 5 MB, cruza extensão+MIME+assinatura, lê dimensões e limita 8000 px; `@artificio/media` recebe preset opcional; pasta/public_id são próprios; falha DB tenta apagar upload novo; substituição preserva exclusão pendente para retry e só apaga IDs da pasta do projeto. Teste hostil/ownership/rollback/substituição 11/11, Media 1/1 e frontend 14/14. Falta criar/configurar preset assinado real e executar smoke Cloudinary; task permanece aberta.
- [ ] T7.10 — **Migration para identidade do ativo de capa.** Guardar só a URL impede saber se o ativo pertence ao projeto e se pode ser apagado — sem `public_id` e provedor, a remoção da capa anterior (T7.9) não é segura. É migration distinta da estrutura de facetas da Fase 4; `parent_id` pertence à spec 090. · feito quando: colunas criadas, com header válido e idempotência (`AGENTS.md` §Migrations). **Implementação local 2026-07-29:** migration 035 única adiciona provedor, public_id, dimensões, MIME e exclusão pendente; header de 5 campos e guard 47/47 verdes. O gate PostgreSQL 16 aplica 035 duas vezes, confere as seis colunas, unicidade da constraint e rejeição de dimensões negativas/parciais. Falta a primeira execução real no CI da PR; task permanece aberta.
- [x] T7.11 — Orientação de formato, dimensão recomendada e limite de tamanho no formulário de capa (requisito 30). · feito quando: o usuário sabe o que enviar antes de tentar. **Evidência 2026-07-29:** formulário informa JPEG/PNG/WebP, máximo 5 MB e recomendação 1200×630 antes do input; `accept` restringe o picker e o backend continua autoridade. Teste de página verde 14/14.

### T7.12–T7.16 — Toda capa passa a ser nossa (decisão do mantenedor, 2026-07-29)

**Desenho decidido:** toda capa acaba hospedada no nosso Cloudinary, e a que deixa de ser
usada é apagada. URL externa deixa de ser forma de guardar capa e passa a ser só o ponto de
partida do download. Três caminhos de entrada continuam existindo (upload de arquivo, colar
link, scraper), mas os três terminam no mesmo lugar.

**Achado que originou o bloco** (investigação 2026-07-29, sobre a implementação da T7.9):
`materialMetadata.ts:41` aceita `cover_image_url` livre, e o `commonFields` (`:132`) **não
carrega** as colunas de identidade da migration 035. Salvar a URL por lá deixa
`cover_public_id`/`cover_storage_provider` apontando para o ativo anterior — URL e identidade
dessincronizam, e a "remoção segura" da T7.9 passa a apagar o ativo errado. Tirar
`cover_image_url` do PATCH **não é opção**: `useAdminMedia.ts:41` (Gestão de Mídias) e
`scraperIngest.ts:419` dependem dele.

**Referência obrigatória — reusar, não reimplementar.** `mesas` já tem colar-link-que-sobe em
produção: `uploadRemoteImageToCloudinary` (`apps/mesas/backend/src/services/cloudinary.ts:240`)
com `assertPublicHttpUrl` (`:142`), que barra host local/interno, segue redirect com limite,
corta o corpo ao estourar 5 MB durante o download e confere `content-type`. `@artificio/media`
tem a versão simples (`uploadFromUrl`, `packages/media/src/index.ts:87`). Copiar qualquer uma
para dentro do `downloads` cria um terceiro lugar para esquecer de corrigir.

**Trava pétrea deste bloco — Cloudinary fica escrito e DESLIGADO.** Decisão nominal do
mantenedor: enquanto `downloads` estiver em desenvolvimento, **nenhum** dos três caminhos
sobe arquivo para o Cloudinary. Código pronto, testado, sem efeito. Com a chave desligada o
comportamento observável é o de hoje: colar link guarda o endereço externo, o scraper guarda
o endereço da fonte, o lote não roda. Ligar exige palavra própria do mantenedor.
**Fora da trava:** a marcação de origem (T7.12) grava só no nosso banco, não consome
Cloudinary, e fica ligada desde já — é ela que forma a lista de trabalho da migração.

- [x] T7.12 — **Origem da capa registrada em toda escrita** (base dos demais). Hoje `commonFields`
  não toca as colunas de capa, então a identidade sobrevive a uma troca de URL e passa a mentir.
  Corrigir: toda escrita de `cover_image_url` grava junto o estado da capa. Capa que ainda mora
  no servidor de outro nasce marcada como externa, com `cover_public_id` nulo; só o upload para
  o nosso Cloudinary marca como nossa. `cover_storage_provider IS NULL` (todo material anterior
  à migration 035, sem backfill) conta como externa — a lógica de exclusão já compara
  `=== 'cloudinary'`, então o default seguro já existe; garantir que continue. **Não é estado
  temporário:** capa cuja fonte recusar o download (T7.15) permanece externa depois da migração,
  e é essa marcação que a Gestão de Mídias usa para mostrar o que sobrou. · feito quando: PATCH,
  endpoint de capa e scraper gravam origem coerente com a URL; teste prova que trocar a URL por
  PATCH não deixa `public_id` órfão apontando para o ativo anterior.
- [x] T7.13 — **Colar link passa a baixar a imagem** nas duas telas que aceitam URL: formulário do
  autor e Gestão de Mídias (`GestaoMidiasPage.tsx:67` / `useAdminMedia.ts:41`). O endereço colado
  vira origem do download, não o valor persistido. Reusar o caminho do `mesas` (ver Referência
  acima) — SSRF, redirect e corte por tamanho já resolvidos lá. Validar o conteúdo baixado com
  `validateCoverImage` (`services/coverImage.ts`), o mesmo do upload de arquivo: assinatura real,
  não `content-type` da resposta. **Discord não é bloqueado** — decisão do mantenedor: o link
  expirar era problema porque o link era guardado; baixando na hora, a cópia é nossa antes de o
  endereço morrer, e barrar recusaria justamente o caso onde copiar salva a capa. A defesa do
  `mesas` (`sanitizePublicImageUrl`) é consequência de lá guardar o link, não padrão a herdar.
  **Com a chave desligada, colar link continua guardando o endereço externo.** · feito quando:
  com a chave ligada, colar link em qualquer das duas telas resulta em ativo nosso com identidade
  gravada; com ela desligada, o comportamento é idêntico ao de hoje; teste cobre os dois estados.
- [x] T7.14 — **Scraper copia a capa na importação** (`scraperIngest.ts:419` hoje só guarda
  `item.coverImageUrl`). Fonte confiável e volume alto: `uploadFromUrl` do `@artificio/media`
  serve, não precisa do caminho defensivo do `mesas`. Falha de download **não pode** derrubar a
  ingestão do item — material entra com capa externa e fica marcado como pendente de migração.
  **Mudança de comportamento a registrar:** hoje, se a fonte trocar a imagem, a nossa troca junto;
  passando a copiar, congela no que foi baixado. É o efeito desejado, mas é mudança.
  **Com a chave desligada, o scraper continua guardando o endereço da fonte.** · feito quando:
  com a chave ligada a importação traz a capa; falha de download não aborta o item; com ela
  desligada o comportamento é o de hoje.
- [x] T7.15 — **Migração do acervo publicado, disparada por botão** na Gestão de Mídias. Escopo
  decidido pelo mantenedor: **só material publicado** — rascunho e reprovado ficam de fora, não se
  paga armazenamento por capa que talvez nunca apareça. Lê a lista formada pela T7.12. Nunca roda
  sozinha; sem cron, sem gatilho de deploy. Mostrar progresso e o resultado por item.
  **Falha da fonte mantém o link externo** (decisão do mantenedor) — não zera a capa. Fonte fora
  do ar, imagem removida e servidor que recusa download automático são resultado esperado numa
  parte do acervo, não bug do lote. O que falhar continua marcado como externo e **visível na
  Gestão de Mídias**, com o motivo, para alguém resolver na mão depois; sem isso vira pilha
  invisível. **Custo a medir ANTES de disparar:** hoje a maior parte do acervo é hospedada por
  outro; migrar transfere esse armazenamento para nós, de uma vez. A lista da T7.12 permite ver o
  tamanho do lote antes, não pela fatura depois. · feito quando: botão dispara o lote sobre
  publicados, o que falha mantém link externo e aparece na tela com motivo, e o lote é retomável
  sem duplicar ativo do que já subiu.
- [x] T7.16 — **Trocar capa apaga a anterior**, por qualquer caminho (upload, link colado, lote da
  T7.15). Só apaga o que é nosso: `provider === 'cloudinary'` e `public_id` sob a pasta do
  projeto — `isOwnedCoverPublicId` (`materialCover.ts`) já implementa a checagem, e a coluna
  `cover_pending_delete_public_id` com retry já existe; é extrair para helper compartilhado, não
  inventar. Sem isso o `downloads` reproduz o vazamento do `mesas`, que não tem `banner_public_id`
  e por isso deixa órfão a cada troca de banner — tendo a informação para evitá-lo.
  **Limite conhecido:** cobre só a substituição. Material apagado, upload abandonado antes de
  salvar e órfão anterior a este controle **não** são cobertos — vão para a spec 091
  (`specs/backlog.md`). Sem o cron o lixo antigo continua lá, mas para de crescer.
  **Segue a chave:** desligado, não existe capa nossa para apagar. · feito quando: as três formas
  de troca apagam o ativo anterior quando ele é nosso, nunca tocam ativo externo, e a falha de
  exclusão fica pendente para retry em vez de perder o rastro.

**Evidência local T7.12–T7.16 (2026-07-29):** `coverStorage.ts` centraliza chave, origem,
persistência, ownership, rollback e exclusão pendente. `DOWNLOADS_CLOUDINARY_COVERS_ENABLED`
é `false` por padrão no código, env e dois Compose; preset deixa de ser obrigatório enquanto
desligado. `downloadPublicImage` SSRF-safe foi movido para `@artificio/media`, e Mesas passou a
consumi-lo; testes bloqueiam localhost, IPv4, IPv6 e IPv4-mapped. PATCH, endpoint, scraper e lote
gravam provedor/identidade coerentes. O lote lista apenas publicados externos, mostra quantidade,
máximo de armazenamento e zero transformações explícitas; rerun ignora `cloudinary`. Focados:
backend 51/51, frontend 21/21, Media 5/5; lint dos quatro consumidores/pacotes, builds e
`verify:api` verdes. O verify registra o breaking intencional já conhecido da remoção de slug no
POST de criação e cinco operações aditivas; três warnings ambíguos preexistentes permanecem.

## Fase 8 — Open Graph por material (defeito 15)

Conta para o cutover: a `og:image` é URL absoluta apontando para `downloads.artificiorpg.com`,
e o mesmo `index.html` estático vai para prod — o comportamento lá será idêntico ao observado
em beta.

> **Três correções à versão anterior desta fase, verificadas em código na 3ª revisão do Codex
> (2026-07-27).**
>
> 1. **A spec afirmava que o aviso do Facebook já estava atendido** porque `index.html:14-15`
>    declara `width`/`height`. Falso: `og-default.png` **nunca existiu no repositório**
>    (`apps/downloads/frontend` não tem `public/`, e o arquivo não aparece em nenhum lugar da
>    árvore), mas é referenciado duas vezes — `index.html:13` e `:22`. Dimensão declarada sobre
>    imagem inexistente não atende aviso nenhum. O aviso tem **duas** causas simultâneas: OG
>    genérico e asset ausente. Corrigido em T8.1.
> 2. **T8.1 pedia "decidir a arquitetura"** listando SSR, prerender, User-Agent e edge function.
>    A decisão foi tomada pelo mantenedor (abaixo) — a fase não abre mais com escolha pendente.
> 3. **T8.2 exigia `width`/`height` de toda capa.** Inexequível: a API devolve só
>    `cover_image_url` (`db/types.ts:120`), sem largura, altura nem MIME, e capa real é externa
>    (`img.itch.zone`). Declarar 1200×630 para qualquer capa seria inventar dado. Corrigido em
>    T8.5.

**Decisão de arquitetura (mantenedor, 2026-07-27) — shell HTML dinâmico no origin.** O backend
renderiza **somente o `<head>`**; o corpo continua `<div id="root"></div>` com os bundles Vite
reais, e o navegador monta a SPA normalmente com `createRoot` (`main.tsx:26`). Não é SSR de
React. As alternativas foram avaliadas e descartadas: **SSR completo** exige `entry-server`,
`entry-client`, router SSR e hidratação, com `main.tsx` dependendo de `document`, cookie e
`BrowserRouter` — refatoração larga para um problema de `<head>`; **prerender** só gera HTML
durante o build Docker, e catálogo é mutável (material novo ou capa trocada exigiria rebuild,
sem gatilho existente); **resposta por User-Agent** é *dynamic rendering*, que o Google
classifica como workaround, e forçaria `Vary: User-Agent` multiplicando variantes de cache;
**Cloudflare Worker** é tecnicamente bom mas cria app, rota, deploy e observabilidade novos,
e ação de infra exige aprovação nominal própria; **reaproveitar o Astro** não serve porque
`apps/site/astro.config.mjs:7` está em SSG sem adapter, e rota dinâmica exigiria adapter SSR
mais acoplamento entre subdomínios.

Um único ponto resolve OG, canonical, 404 real e `noindex` de beta.

**Evidência local da implementação (2026-07-29, branch `feat/089-fase-8`):** renderer e
rotas SEO no backend; consulta pública única compartilhada com a API JSON; nginx encaminha
`/materiais/:slug`, `/robots.txt` e `/sitemap.xml` sem seleção por User-Agent; 18 testes focados
verdes; lint/build raiz 24/24 e testes raiz 38/38 verdes; builds de Downloads,
`packages/content` e seus consumidores verdes; `verify:api` verde. O asset foi medido como PNG
RGB 1200×630.
Docker Compose beta/prod passou em `config --quiet`; Docker build real ficou indisponível porque
o daemon local estava parado. Critérios que exigem URL real de beta/prod continuam abertos.

**Reaproveitamento válido do Astro: o utilitário, não o serviço.** `packages/content/src/meta.ts:6`
já produz `og:type`, `og:url`, `og:site_name`, `og:locale`, Twitter card **e** `noindex,nofollow`
(`:23`) — o contrato inteiro que esta fase precisa. **Consumir** o pacote não é modificá-lo, então
não dispara a trava de pacote compartilhado. Se a implementação exigir mudar `meta.ts`, aí sim
para e pede aprovação própria (`AGENTS.md` §Autorização).

- [x] T8.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada. **Feito em 2026-07-29:** T0 completo lido; travas de escopo, pacote compartilhado, bug achado, RTK, Docker/E016 e commit/push identificadas.
- [ ] T8.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T8.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro. **Feito em 2026-07-29.**
- [ ] T8.1 — 🔒 **[P0] Versionar o fallback `og-default.png`, que não existe** (requisito 40). Precede todo o resto da fase: enquanto o asset faltar, nenhuma tag corrigida resolve o aviso do Facebook, e material sem capa cai num 404. Criar `apps/downloads/frontend/public/` (hoje inexistente) e versionar a imagem em 1200×630 — o `Dockerfile:44` copia `dist` inteiro, e o Vite emite `public/` para lá sem configuração extra. · feito quando: `GET /og-default.png` devolve **200** com `Content-Type: image/*` e dimensão física igual à declarada, em beta e em prod. **Parcial em 2026-07-29:** asset criado, medido como PNG RGB 1200×630, emitido pelo Vite e servido do `dist` local com 200 + `image/png`; GET beta/prod pendente de deploy.
- [ ] T8.2 — **Encaminhar `GET /materiais/:slug` ao backend no nginx** (requisito 36). Hoje `nginx.conf:47` manda tudo para `index.html`. A regra nova precisa vir **antes** do `location /`, sem capturar os assets de `nginx.conf:34`. · feito quando: a rota chega ao backend e as demais continuam servidas pelo estático. **Parcial em 2026-07-29:** regra específica adicionada antes do fallback e Compose beta/prod validado; smoke em container/URL real pendente porque Docker local estava sem daemon e não houve deploy.
- [x] T8.3 — **Renderer de `<head>` no backend** (requisito 36). Consulta o material publicado pela **mesma função da API pública** — nunca query duplicada que possa divergir; obtém e cacheia o `index.html` real do frontend interno; remove as metas genéricas e injeta as próprias. Corpo intocado. · feito quando: o HTML devolvido tem `<head>` do material e corpo idêntico ao do estático. **Feito em 2026-07-29:** `findPublishedMaterialBySlug` virou fonte única da API JSON e do shell; `publicShell.ts` cacheia o `index.html` do volume compartilhado e preserva o body/bundles, comprovado por teste. Follow-up de review da PR #229: resultado do banco agora entra como `unknown` e só retorna após schema Zod completo; ausência preserva `undefined` e linha persistida malformada é rejeitada em teste.
- [x] T8.4 — **Contrato completo de tags** (requisito 40a). A versão anterior pedia três (`og:title`, `og:description`, `og:image`) e esquecia `og:type` e `og:url`, que o OGP define como básicos junto com title e image. Mínimo: `<title>`, `meta[name=description]`, canonical absoluto autorreferente, `og:type=website`, `og:title`, `og:description`, `og:url`, `og:image`, `og:image:alt`, `og:site_name`, `og:locale=pt_BR`, Twitter card/title/description/image — **exatamente uma ocorrência de cada tag singular** (o `index.html` já traz as genéricas; injetar sem remover duplica). Canonical vai no HTML fonte, sem JavaScript alterá-lo depois. · feito quando: as 15 presentes, uma vez cada, com canonical e `og:url` batendo com a URL pedida. **Feito em 2026-07-29:** as 15 tags enumeradas estão presentes uma vez e canonical/`og:url` coincidem; teste focado verde.
- [x] T8.5 — **Capa como `og:image`, com dimensão só quando conhecida** (requisitos 37, 40b). A API devolve só `cover_image_url` (`db/types.ts:120`); capa real é externa (`img.itch.zone`), sem largura, altura ou MIME. **Decisão do mantenedor (2026-07-27):** declarar `width`/`height` apenas quando o valor for real — o fallback de T8.1 sempre os declara (1200×630, asset próprio), a capa externa de dimensão desconhecida os **omite**. `og:image:alt` sempre. Normalizar toda capa numa derivada Cloudinary foi avaliado e descartado desta fase: depende do trabalho de capa da Fase 7 e traz migration mais backfill do acervo. · feito quando: material com capa, material sem capa e capa sem dimensão conhecida verificados, e nenhuma dimensão inventada. **Feito em 2026-07-29:** testes cobrem capa externa sem dimensões e fallback próprio com 1200×630; `og:image:alt` aparece nos dois.
- [x] T8.6 — **Escape de contexto HTML em todo valor vindo do banco** (requisito 40c). Título com `"`, `<` ou `&` não pode fechar o `content=""` nem abrir tag nova — é injeção via campo que o autor controla. A descrição OG é **texto plano** derivado de `summary`, com limite e fallback explícitos, nunca HTML rico (coerente com o requisito 25, que mantém `summary` plano). · feito quando: teste com título hostil provando que o `<head>` não quebra. **Feito em 2026-07-29:** escape cobre `&`, `<`, `>`, `"` e `'`; teste usa título hostil e confirma ausência de tag injetada.
- [x] T8.7 — **Status HTTP correto por caso** (requisito 40d). A versão anterior verificava só tags. Material publicado → 200; slug inexistente → **404 real**, nunca shell genérico com 200; material em rascunho, rejeitado ou retirado → 404, porque OG não pode vazar conteúdo não publicado; banco fora → **503 com `Retry-After`**, não 404 cacheável; erro → `noindex`, sem metadata privada; `HEAD` coerente com `GET` em status e cabeçalhos. · feito quando: os seis casos verificados por resposta HTTP bruta. **Feito em 2026-07-29:** Supertest cobre publicado, inexistente, rascunho, rejeitado, retirado, banco indisponível e HEAD; teste da query confirma simultaneamente slug + `editorial_state='published'`.
- [ ] T8.8 — **[P0] Beta não indexável** (requisito 40e). `plan.md:217` afirma que "beta é `noindex`" — **falso**: nenhum código emite `meta[name=robots]` nem `X-Robots-Tag`, e a resposta real de beta em 2026-07-27 veio `200 OK` sem nenhum dos dois. Beta pode competir com produção na indexação. **Decisão do mantenedor: beta não precisa de OG funcionando; prod precisa. Beta não deve ser rastreado.** O renderer emite `noindex,nofollow` em beta (`meta.ts:23` já suporta via `input.noindex`), e o `robots.txt` que `nginx.conf:40` tenta servir **não existe no repositório** — versionar um que bloqueie tudo em beta. Corrigir a afirmação do plano. · feito quando: beta responde com `noindex` **e** `robots.txt` presente; prod sem nenhum dos dois. **Correção de premissa 2026-07-28 (início das Fases 7-8): `robots.txt` PASSOU A EXISTIR** em `apps/downloads/frontend/public/robots.txt`, criado depois da 3ª revisão do Codex. Mas ele **não serve ao propósito desta task**: é um `robots.txt` de produção, que bloqueia apenas rotas com query string de filtro (`?q=`, `?material_type=`, `?publisher=`, `?page=` etc.) para evitar indexação de facetas duplicadas — não bloqueia nada em beta. Como o mesmo arquivo estático vai para os dois ambientes, versionar um `Disallow: /` global quebraria produção. A task continua válida, com o escopo ajustado: **a diferenciação por ambiente é o problema real a resolver**, não a criação do arquivo. O `noindex` via `meta.ts:23` (`input.noindex`) resolve a metade do `<head>`; o `robots.txt` precisa de mecanismo próprio — servir variante por ambiente no nginx, ou gerá-lo no renderer de T8.3, ou rota dedicada no backend. **Decisão do mantenedor em 2026-07-29:** rota dedicada no backend, com proxy exato no nginx; beta usa `Disallow: /`, produção preserva regras de faceta e sitemap. Implementação/testes locais verdes; resposta real beta/prod pendente de deploy.
- [x] T8.9 — **[P0] Soft 404 na rota de material** (requisito 40f). `nginx.conf:47` devolve 200 `index.html` para qualquer caminho e `App.tsx:89` redireciona `*` para `/` — slug inexistente vira soft 404, que o Google manda devolver como 404/410 real. O renderer de T8.3 corrige **a rota de material**; as demais rotas inválidas ficam como débito registrado nesta spec (não no backlog), porque exigem decidir o destino de cada uma. · feito quando: `/materiais/<slug-inexistente>` devolve 404 real e o débito das demais rotas está escrito aqui. **Feito em 2026-07-29:** rota de material inexistente retorna 404/no-store/noindex em teste HTTP; débito das demais rotas permanece registrado nesta task.
- [ ] T8.10 — **Política de cache do shell** (requisito 40g). Título, resumo e capa mudam; sem política, o preview congela. Exigir: **nenhuma variante por User-Agent** (a arquitetura escolhida já elimina a causa, mas a ausência de `Vary: User-Agent` precisa ser verificada); cache curto ou invalidação por material; `ETag`/`Last-Modified` coerentes; edição publicada refletida dentro da janela declarada; erro do renderer **não cacheado** como HTML falso; e conferir que o Cloudflare não retém shell antigo. · feito quando: política escrita e cada ponto verificado. **Parcial em 2026-07-29:** `max-age=60`, `stale-while-revalidate=300`, ETag do HTML final, Last-Modified e 304 testados; sem `Vary: User-Agent`; 404/503 usam `no-store`. Review Codex da PR #229 confirmou que troca isolada de capa atualiza somente `download_material_metadata.updated_at`; corrigido fazendo a consulta compartilhada devolver `updated_at` efetivo pelo maior timestamp entre material e metadata, sem campo público novo. Comportamento do Cloudflare e janela após edição aguardam smoke real.
- [ ] T8.11 — **Sitemap de materiais** (requisito 40h). Confirmado: zero ocorrência de "sitemap" em `apps/downloads`. Sem ele, a descoberta de material publicado depende só de link interno. Gerado a partir dos materiais publicados, referenciado no `robots.txt` de T8.8, **e ausente ou vazio em beta**, coerente com a decisão de não rastrear beta. · feito quando: sitemap servido em prod, listando os publicados, e beta sem sitemap indexável. **Parcial em 2026-07-29:** `listPublishedMaterialSlugs` centraliza filtro `published`, timestamp efetivo e ordem por slug; a rota só constrói o XML. Produção gera XML e robots referencia; beta retorna 404/noindex sem consultar banco. Testes verdes; URLs reais pendentes.
- [ ] T8.12 — Verificar com `curl -A "facebookexternalhit/1.1"` numa URL real de material — a mesma verificação que expôs o defeito — **e** com requisição normal, confirmando `<head>` idêntico nas duas. Smoke lê **HTML bruto**, nunca DOM depois do JavaScript: o DOM esconderia justamente o defeito que a fase corrige. · feito quando: `og:title` traz o nome do material, `og:image` a capa, e crawler e humano recebem o mesmo `<head>`.
- [x] T8.13 — Conferir que nenhuma rota pública regrediu em meta/canonical (regra pétrea de SEO), e rodar `pnpm verify:api` se a rota ou o contrato mudarem (`AGENTS.md` §Diagnóstico local). · feito quando: verificação registrada e `verify:api` verde quando aplicável. **Feito em 2026-07-29:** shell genérico das demais rotas permanece inalterado; resposta de material prova remoção de duplicatas, canonical autorreferente e 15 tags singulares; lint/build/test raiz e `verify:api` verdes.

## Fase 9 — Navegação e cobertura do fluxo do autor (defeitos 12, 13)

⚠️ **T9.2 em diante é desenho de produto, não correção.** É a maior fase da spec.

> **Três correções à versão anterior, verificadas em código na 3ª revisão do Codex (2026-07-27).**
>
> 1. **"6 domínios de API sem tela alguma" era inferência falsa por contagem de rotas.** Todos
>    os seis têm alguma superfície: `ratings` aparece na ficha pública, `comments` tem lista e
>    formulário, `creators` tem página pública, `destinations` roda em `/ir/:id`,
>    `systemSuggestions` tem gestão administrativa completa (`GestaoSugestoesSistemaPage.tsx`),
>    e `downloads` registra pelo destino e por `/obter/:fileId`. Comparar 74 rotas com 11
>    páginas de painel não mede lacuna — **rota é contrato técnico, não promessa de tela**. As
>    lacunas reais existem, mas variam por **ator**, e é isso que T9.3 passa a mapear.
> 2. **T9.1 mandava adicionar "Perfil" à nav** apontando para `PerfilPage.tsx`. Errado por dois
>    motivos, e o próprio arquivo já avisava (`PerfilPage.tsx:4-6`): a página é **só nome e
>    e-mail do SSO, somente leitura**, e perfil público de criador foi explicitamente deixado
>    para spec futura — o rótulo prometeria mais do que a página entrega. Além disso o Header já
>    oferece **quatro** caminhos de conta (Entrar, Perfil Artifício no `accounts.`, Conta
>    Downloads, Painel) e a sidebar do painel já tem "Perfil" (`PainelShell.tsx:9`); seria o
>    quinto. Corrigido em T9.1.
> 3. **T9.5 pedia "registrar checklist Nielsen"**, o que não prova usabilidade — ISO 9241-11
>    trata usabilidade como resultado no contexto de uso, não como lista conferida. Corrigido em
>    T9.7.

**Dependência de ordem (não fatiamento).** T9.4 em diante depende das Fases 6 e 7 terem fechado:
sem threads e identidade de comentário (090), e sem sistema, capa, conteúdo rico e slug
automático (Fase 7), o onboarding seria construído sobre formulário temporário e teria de ser
refeito. A dependência é **ordem declarada dentro desta spec**, não motivo para tirá-la daqui —
o Codex propôs fatiar (nav para a 090, requisitos 32-35 para comentários, onboarding para uma
091); o mantenedor manteve spec única (2026-07-27), coerente com as decisões das fases 5 e 8.

- [x] T9.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. O T0 pétreo exige a leitura uma vez por sessão; releitura a cada fase é regra própria desta spec, pela quantidade de fases e pelo intervalo entre elas. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada. **Concluída em 2026-07-29:** `AGENTS.md` lido inteiro; escopo limitado a registros da spec 089, sem código.
- [x] T9.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso. **Concluída em 2026-07-29:** comandos equivalentes executados via `rtk`; leitura longa foi paginada por `rtk proxy` após a saída integral truncar.
- [x] T9.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra. · feito quando: mensagens da fase seguem o registro. **Concluída em 2026-07-29:** modo `caveman ultra` aplicado desde a retomada da fase.
- [ ] T9.1 — **Remover a nav interna duplicada do catálogo; não acrescentar "Perfil"** (requisito 31, decisão revista). `AppShell.tsx` expunha "Início" e "Catálogo", enquanto `App.tsx:51` e `:53` renderizam **a mesma** `CatalogoPage`. Decisão do mantenedor revista em 2026-07-29: saem os dois links, porque `/` já é o catálogo; `/catalogo` permanece só como rota compatível; "Perfil" continua apenas no painel. Cabe inteiro em `apps/downloads`, sem tocar `packages/ui`. · feito quando: Header sem nav interna de catálogo, verificado em desktop, mobile, autenticado e anônimo. **Implementação local em 2026-07-29:** `moduleNav` removido do `AppShell`; teste prova ausência de "Início" e "Catálogo" no Header. Validação completa anterior: suíte 285/285, lint e build verdes. Durante a validação, Node 25.8.2 + Vitest/jsdom emitia `Warning: --localstorage-file was provided without a valid path`; causa confirmada na Web Storage global do Node 25. `vitest.config.ts` agora passa `--no-experimental-webstorage` somente aos workers, preservando `window.localStorage` do jsdom. Reprodução original sem warning; nenhuma dependência nova. Task permanece aberta até repetir testes após a decisão revista e fazer smoke desktop/mobile, autenticado/anônimo.
- [x] T9.2 — **Decidir o que "perfil de criador" significa neste produto.** `PerfilPage.tsx` mostra dados do SSO; `download_creator` tem slug, bio e página pública, mas a API de criadores **só lê** — não existe rota de escrita. **Decisões do mantenedor em 2026-07-29:** o autor poderá editar o próprio perfil público; nome público e bio Markdown são editáveis; nome/e-mail SSO seguem somente leitura; endereço público nasce automático no primeiro salvamento e fica imutável; perfil ausente é criado nesse primeiro salvamento. A edição vive no painel; não cria novo item na nav principal. O MCP estrutural estava stale (`feat/089-fase-8`, HEAD divergente); diagnóstico desta implementação usa arquivos reais via `rtk`, sem confiar no grafo antigo. · feito quando: decisão tomada e registrada, não inferida — inclusive a de não fazer.
- [x] T9.3 — **Matriz ator → necessidade → rota → superfície atual → decisão** (requisito 38, reescrito). Substitui a comparação 74 rotas × 11 páginas, que não mede nada. Cada linha nomeia **quem** precisa (autor, leitor, moderador, admin), o que precisa fazer, qual rota atende, o que a UI já oferece, e a decisão. "Nenhuma tela" é saída legítima para infraestrutura — `destinations` já funciona por `/ir/:id`, e `downloads` é evento técnico —, desde que registrada. · feito quando: matriz completa, com cada decisão nomeada pelo mantenedor. **Feito em 2026-07-30:** matriz no requisito 38 de `spec.md`, cobrindo os seis domínios por ator e decisão.
- [x] T9.4 — **Sugestão de sistema para usuário comum** (requisito 38a). Confirmado: `systemSuggestions` só aparece em `/gestao/sugestoes-sistema`, restrito a admin (`App.tsx:86`). O usuário não consegue sugerir sistema faltante nem acompanhar as próprias sugestões pela UI, apesar de a API expor `/mine`. · feito quando: usuário comum sugere sistema e acompanha o desfecho sem passar pela gestão. **Feito localmente em 2026-07-30:** criação e acompanhamento em `/painel/sugestoes-sistema`; testes 2/2 verdes.
- [x] T9.5 — **Dashboard cobre os estados acionáveis e o pós-publicação** (requisito 38b). `VisaoGeralPage.tsx:9-11` conta só `published`, `in_review` e `draft` — **`rejected` e `withdrawn` ficam de fora**, justamente os que exigem ação do autor, e aparecem apenas na lista. Material publicado também não ganha ação "ver no catálogo". Rejeitado precisa exibir o motivo. · feito quando: os cinco estados visíveis, motivo de rejeição legível, e link público a partir do material publicado. **Feito localmente em 2026-07-30:** cinco contadores, motivo/ação do rejeitado e link público; teste verde.
- [x] T9.6 — **Autor acompanha o que recebeu** (requisito 38c). Nenhuma tela de painel mostra ao autor média de avaliações, comentários recebidos ou contagem de downloads dos próprios materiais — publicou e perdeu de vista. Notificações cobrem aprovação e rejeição, não comentário. · feito quando: autor vê avaliações, comentários e downloads dos próprios materiais no painel. **Feito localmente em 2026-07-30:** `/materials/mine` agrega avaliações, comentários ativos e downloads; painel exibe os três. Testes backend 28/28 e frontend focado verdes.
**T9.7 — ferramenta única de denúncia (requisito 38d).** Subdividida em 2026-07-29 por decisão do mantenedor: a formulação original tratava o caso como "denúncia de comentário" e oferecia como alternativa apenas corrigir o comentário do código. A auditoria mostrou escopo maior — **não existe criação de denúncia no frontend, para alvo nenhum** —, e a alternativa barata revogaria a D111 item 6 por atalho. Decisões do mantenedor em 2026-07-29: (a) revogar a contenção automática de 2026-07-12; (b) denúncia é **uma ferramenta só**, alvo é dado de entrada, não fluxo separado; (c) comentário acatado fica com marca "removido pela moderação", não desaparece; (d) política de abuso publicada no `/sobre-e-uso`. Ordem é dependência real: schema antes de API, API antes de UI, UI antes de validação.

- [x] T9.7a — **Revogação da contenção automática registrada nesta spec.** `reports.ts:65` implementava "1 denúncia P0 → `editorial_state: withdrawn`", com o raciocínio registrado inline ("falso positivo custa reaparecer via moderação; manter no ar custa mais", decisão de 2026-07-12). Aquela decisão foi tomada quando a criação de denúncia não existia no frontend, logo era inalcançável. Com o formulário ligado, viraria a porta de entrada do *brigading*: um clique de conta única derrubaria material do catálogo. **Decisão nominal do mantenedor em 2026-07-29, registrada no requisito 38d desta spec:** denúncia enfileira, moderação humana decide, nada sai do ar automaticamente; a contenção anterior está revogada. Por ordem documental do mantenedor, esta fase registra decisões somente em `specs/089-downloads-parser-bugs/*`, sem escrever `decisions.md`, `project-state.md` ou backlog. · feito quando: revogação explícita na spec e comentário de `reports.ts` reescrito citando a decisão nova — nunca apagado (`AGENTS.md` §Regras Gerais de Código). **Feito localmente em 2026-07-30:** requisito 38d contém a revogação e `reports.ts` removeu a transição automática para `withdrawn`, preservando comentário rastreável.
- [ ] T9.7b — **Migration única: alvo material XOR comentário + denúncia única por denunciante.** `download_report` hoje só referencia `material_id` (`migration_005_download_report.sql:11`). Adicionar `comment_id` nullable com FK para `download_comment`, `CHECK` de alvo exclusivo (exatamente um dos dois preenchido — nunca ambos, nunca nenhum), e **índice único parcial** por `(reporter_user_id, material_id)` e `(reporter_user_id, comment_id)`, que é a garantia de "uma denúncia por pessoa por alvo" no banco, não só na aplicação. **Atenção:** `material_id` é `NOT NULL` hoje (`migration_005:11`) — o `CHECK` XOR exige `DROP NOT NULL`, permitido em `online-safe`. Entram na mesma migration os dois campos de sinal de abuso (decidido em 2026-07-29, após o Codex apontar que a marcação não tinha campo): `reporter_abuse_flagged BOOLEAN NOT NULL DEFAULT FALSE` e `reporter_dismissed_streak SMALLINT NOT NULL DEFAULT 0`. O segundo existe porque um booleano registra *que* foi sinalizado, não *por quê* — o DSA artigo 23 exige avaliação sobre volume/proporção/gravidade/intenção, e `isReporterAbusive` já calcula a sequência de descartadas e hoje a joga fora. Ambos são **snapshot da criação**, nunca recalculados. Uma migration só: as colunas nascem juntas na mesma feature e `AGENTS.md` §Migrations item 2.1 proíbe fatiar schema da mesma spec. Header de 5 campos obrigatório, `online-safe`, idempotente (`IF NOT EXISTS`; `ADD CONSTRAINT` dentro de `DO $$` checando `pg_constraint`). · feito quando: migration roda 2x sem erro, `CHECK` rejeita alvo duplo e alvo vazio, índice único rejeita segunda denúncia do mesmo denunciante ao mesmo alvo.

  **Achado da revisão (2026-07-30) — corrigir agora, decisão do mantenedor.** `migration_036_download_report_targets.sql` filtra `pg_constraint` só por `conname`, sem `conrelid`. Nome de constraint no PostgreSQL é único **por tabela**, não por banco: uma homônima em outra tabela faz o bloco `DO $$` pular a criação silenciosamente e a migration passa verde sem criar o `CHECK`. `migration_028:32` já usa o padrão certo (`AND conrelid = 'download_material'::regclass`) — replicar nos dois blocos. **Decidido corrigir e não registrar como débito porque a migration ainda não foi executada** (Postgres descartável indisponível): a janela de editar de graça é agora e fecha no primeiro deploy, já que migration aplicada não se reescreve (`AGENTS.md` §Migrations item 2) e exigiria uma `037` só de correção.

  **⚠️ BLOQUEIO DE AMBIENTE — task NÃO fechável.** A migration **não foi executada** (nem 1×, nem 2×) por indisponibilidade de PostgreSQL descartável em 2026-07-30. O aceite exige execução real; `AGENTS.md` §Conclusão de Tarefas veda fechar tarefa executável com dry-run ou leitura de código. Permanece aberta até rodar de verdade — desbloqueio provável é Postgres em container local, que exige Docker e decisão do mantenedor.
- [ ] T9.7c — **API: remover contenção automática, derivar prioridade no servidor, aceitar alvo comentário.** Em `reports.ts`: (1) apagar o bloco `if (priority === 'P0' && ...)` que faz `withdrawn` (T9.7a autoriza); (2) `priority` **sai** do `createReportSchema` — derivada da categoria no servidor, porque hoje qualquer cliente manda `P0`. Mapa decidido pelo mantenedor em 2026-07-29, por **reversibilidade do dano na espera**, não gravidade moral: `malicious_link`→P0 (único dano irreversível: quem clicou e foi fraudado não desfaz), `copyright_violation`→P1, `inappropriate_content`→P1, `broken_link`→P3 (sem dano, só frustração), `other`→P2 (desconhecido — P3 esconderia coisa grave que o denunciante não soube classificar; P0 viraria porta de escape). **P0 = primeiro na fila, nunca "sai do ar"** — comentar isso no código, porque o nome carrega a memória do comportamento revogado e é o erro mais provável desta entrega; (2b) `decisionSchema` aceita `priority` opcional: moderador **reclassifica** ao triar (decisão do mantenedor 2026-07-29), com trilha via `logModerationAudit` (já importado) e mantendo o 409 de caso já decidido; (3) schema aceita `material_id` XOR `comment_id`, validando existência do alvo; (4) denúncia duplicada devolve **409**, não cria linha; (5) `isReporterAbusive` (hoje só em `GET /abuse-check/:userId`) passa a ser consultado na criação para **marcar** o caso, nunca recusá-lo — DSA artigo 23 exige avaliação caso a caso. Suspensão do direito de denunciar fica fora desta spec (exige aviso prévio, prazo e contestação). · feito quando: testes provam que denúncia não altera `editorial_state`, que `priority` do corpo é ignorada, que duplicata dá 409, e que alvo comentário cria caso na fila.
- [ ] T9.7d — **Comentário acatado fica com marca "removido pela moderação".** Decisão do mantenedor 2026-07-29, alinhada à Santa Clara Principles (a ação de moderação é visível, não silenciosa). Hoje `comments.ts:55-68` filtra `removed_at is null` e o comentário evapora, indistinguível de nunca ter existido. Passar a devolver o comentário removido com marca e **sem corpo** (o texto denunciado não pode continuar público), preservando autor e data para que a thread não perca contexto. Ajustar `CommentSection` para renderizar o estado removido. · feito quando: comentário removido aparece marcado na ficha, sem o corpo original, e o teste prova que o texto não vaza na resposta da API.
- [ ] T9.7e — **Componente de denúncia reutilizável — a peça que nunca existiu.** Auditoria confirmou zero `POST /api/v1/reports` no frontend (`useMyReports.ts` e `useReportsQueue.ts` só fazem `GET`/`PATCH`); `MaterialPage.tsx` não tem nenhuma menção a denúncia. Um componente, alvo material ou comentário como propriedade — não dois fluxos. Categoria em linguagem clara para o usuário, **sem expor P0-P3** (prioridade é interna, T9.7c). Estados de erro cobertos: já denunciado (409), não autenticado, falha de rede. Acoplar em `MaterialPage` e em cada comentário do `CommentSection`. Acessibilidade WCAG 2.2 junto (foco visível e não encoberto, erro associado ao campo em texto, mudança de estado anunciada) — requisito 39a cobra isso nos cenários. · feito quando: usuário logado denuncia material e comentário pela interface, vê confirmação, e a segunda tentativa no mesmo alvo é recusada com mensagem clara.
- [ ] T9.7f — **Fila de moderação: alvo comentário, aviso de abuso e reclassificação.** `GestaoDenunciasPage` hoje pressupõe material. Três acréscimos: (1) alvo comentário exibe o corpo denunciado, o material onde está e o autor, para decidir sem sair da tela — acatar aplica a remoção com marca da T9.7d; (2) **aviso quando `reporter_abuse_flagged`**, mostrando `reporter_dismissed_streak` ("denunciante com N denúncias descartadas em sequência") — informativo, nunca esconde nem despriorizada a denúncia (DSA artigo 23 exige avaliação caso a caso); (3) **reclassificar prioridade** (decisão do mantenedor 2026-07-29), com o mapa derivado da categoria como valor de partida visível. · feito quando: moderador vê denúncia de comentário com contexto suficiente, enxerga o sinal de abuso quando existe, reclassifica prioridade, e acata ou descarta sem navegar para outra página.
- [ ] T9.7g — **`/sobre-e-uso`: política de denúncia e de abuso do sistema (exigência DSA artigo 23).** `SobreEUsoPage.tsx:74` hoje **mente**: promete "canal de denúncia disponível na página do material", em seção de direitos autorais, para um canal que não existe — pior lugar possível, porque manda autor com problema de copyright para um botão ausente. Seção nova explicando: o que acontece ao denunciar (cria caso, moderação humana decide), que **nada é removido automaticamente**, que comentário acatado fica marcado como removido, que denúncia é única por pessoa por alvo, e o que consideramos abuso do sistema — **com exemplos das circunstâncias avaliadas**, que o artigo 23 exige literalmente nos termos, não como cortesia. Corrigir a promessa da seção de direitos autorais para apontar o canal real. · feito quando: a página descreve o fluxo que o código executa, cita a política de abuso com exemplos, e nenhuma afirmação da página é verificável como falsa.
- [ ] T9.7h — **Os três comentários falsos corrigidos.** `comments.ts:70` ("retirada só por denúncia/moderação" — o fluxo alegado não existia), `CommentSection.tsx:19` ("UI já existe na ficha via denúncia" — falso em dobro) e `SobreEUsoPage.tsx:74` (coberto pela T9.7g). Reescrever para descrever o que o código faz depois desta entrega, **preservando** a referência à D111 item 6 e à decisão da T9.7a — `AGENTS.md` §Regras Gerais de Código proíbe apagar comentário que documenta decisão, exige atualizá-lo citando a origem. · feito quando: nenhum comentário do fluxo de denúncia afirma comportamento que o código não tem, e cada um cita a decisão que o justifica.
**Evidência local T9.7c–T9.7h (2026-07-30):** prioridade nasce da categoria no servidor; janela de abuso 20 separada do limiar 3; alvo XOR; duplicata 409; nenhuma contenção automática; decisão de comentário é transacional e auditoria ocorre após commit. Componente único cobre material/comentário, visitante, 409, rede, foco e anúncio; fila mostra contexto, sequência descartada e reclassificação; `/sobre-e-uso` publica a política. Testes focados backend 12/12 e frontend 4/4. Checkboxes permanecem abertos até a validação de interface da T9.9; T9.7b permanece aberta pela execução PostgreSQL ausente.

- [ ] T9.8 — **Fluxo do autor como task list, não wizard** (requisito 39, reescrito). O fluxo é interrompível e não linear — GOV.UK recomenda task list quando as tarefas podem ser retomadas ou feitas fora de ordem, e o step indicator do USWDS serve para sequência linear, que não é o caso. Desenho: chamada "publique seu primeiro material" na visão geral; criação curta (título + tipo, slug automático da Fase 7); **checklist por material derivado dos dados reais** — básico, descrição e créditos, sistema, capa, destino, prévia, enviar para revisão; estado persistente (rascunho, revisão, rejeitado com motivo, publicado); pós-publicação com link público, comentários, avaliações e downloads. Sem tour modal. Saída e retomada livres, sem estado separado de onboarding salvo se provado necessário. · feito quando: autor novo publica material completo sem descobrir campo por tentativa, e consegue sair e retomar sem perder progresso.

  **"Dados reais" = dado PERSISTIDO, nunca estado local do formulário (decisão do mantenedor, 2026-07-30, opção A).** A formulação original era ambígua e produziu o defeito: a primeira implementação derivou 4 dos 7 itens de `descriptionMarkdown`/`authors`/`systemId`/`coverUrl`/`externalUrl` (estado digitado), enquanto `EditarMaterialPage.tsx:187` prometia "Tudo fica salvo para continuar depois" — a pessoa digitava, via ✓, saía e **perdia o trabalho**, violando o próprio critério de aceite desta task. Correção: os sete itens leem `material.*`; o item "Capa" deixa de ser misto (`material.cover_image_url || coverUrl`) e lê só `material.cover_image_url`; a linha 187 passa a descrever o comportamento real ("Cada etapa marca ✓ quando você salva — e continua salva se você sair."), explicando o ✓ antes de a pessoa se confundir. **Salvamento automático (opção B) foi avaliado e descartado para esta spec** — é a maior mudança de comportamento de gravação do app, abre perguntas não respondidas sobre autosave em material `in_review` (escrever sobre o que o moderador está lendo?), e entraria como feature nova não testada dentro de uma task de revisão; vira spec própria se o mantenedor quiser. **Remover só a promessa (opção C) foi rejeitada:** deixaria o ✓ mentindo, tratando o sintoma e não a causa — vedado por `AGENTS.md` §Regras Gerais de Código. Detalhe operacional em `handoff-revisao-T9.7-T9.8.md` §4.
- [ ] T9.9 — **Validação de usabilidade com cenários, não checklist** (requisito 39a). Cenários obrigatórios: primeira publicação, abandonar e retomar, corrigir material rejeitado, acompanhar material publicado, **denunciar** (usuário comum denuncia material e comentário, T9.7e) e **moderar denúncia** (moderador decide na fila, T9.7f) — o cenário original dizia só "moderar comentário", que cobria uma ponta de um fluxo que não existia. Cada achado registra evidência, heurística violada, severidade e correção. Acessibilidade verificada junto (WCAG 2.2): navegação só por teclado, foco visível e não encoberto, erro associado ao campo e descrito em texto, mudança de estado anunciada programaticamente. Medir eficácia, eficiência e satisfação (ISO 9241-11) — checklist isolado não prova usabilidade. · feito quando: os **seis** cenários executados com pessoas reais ou prováveis, achados registrados na sessão.

  **Evidência local T9.8 (2026-07-30):** opção A implementada. ✓ lê somente `material.*`; capa usa só `material.cover_image_url`; texto explica que a etapa marca ✓ ao salvar. Teste vermelho reproduziu o falso concluído sobre estado digitado e ficou verde; arquivo completo 15/15. A task continua aberta até os cenários de primeira publicação/abandono/retomada da T9.9.

  **⚠️ BLOQUEIO DE AMBIENTE (2026-07-30) — task NÃO fechável.** Validação visual e por teclado **não executada**: navegador interno indisponível, e usar o Chrome do mantenedor (perfil logado, cookies e sessão reais) exige autorização nominal por ação (`AGENTS.md` §Autorização) — não se infere de a task pedir validação visual. Bloqueio registrado, não conclusão parcial.

  **Validação automatizada final (2026-07-30):** suíte raiz verde em 38/38 tarefas; Downloads frontend 51 arquivos/297 testes; lint raiz 24/24; build raiz 24/24; `verify:api` verde com 508 rotas e zero breaking change; `git diff --check` verde. Uma execução anterior da suíte raiz teve três timeouts em Mesas, mas a suíte isolada passou 191/191 e a repetição raiz passou com Mesas 646/646; falha não reproduzida e nenhum código de Mesas foi alterado nesta correção.

---

## Bloqueios conhecidos

- **Promoção da spec 088 para produção está travada até esta spec fechar.** O parser estrearia
  em prod sem extrair sistema nem tipo, e com slug contaminado por entidade HTML.
- **Ordem de deploy em produção: site antes de downloads.** O downloads lê a taxonomia do site;
  site desatualizado responde 404 e o downloads cai num fallback de uma entrada só
  (`aventura`), abortando a run inteira. Foi a causa do primeiro `catalog_material_type_not_found`
  em 2026-07-27.
- **DriveThruRPG e DMs Guild seguem em 403** (T2.3a da spec 088). Fora do escopo; nenhum
  critério desta spec depende delas.

# Plano — 085

## Arquitetura da solução

Endpoint novo em `apps/downloads/backend/src/routes/scraper.ts` (mesmo arquivo das rotas de scraper existentes, mantém tudo relacionado a scraper/ingestão num lugar só):

```
POST /api/v1/admin/scraper/parse-html
  auth: authMiddleware + requireRole('admin') + writeRateLimiter (mesmo padrão das outras rotas do arquivo)
  body: { source_platform: 'dms_guild' | 'drivethrurpg', html: string }
  → valida tamanho do body (limite dedicado, ex.: 2MB)
  → valida presença de <script type="application/ld+json" @type=Product> E <link rel="canonical"> cujo DOMÍNIO bate com o source_platform declarado (dmsguild.com só p/ dms_guild, drivethrurpg.com só p/ drivethrurpg — rejeita qualquer outro domínio, inclusive marcas irmãs OneBookShelf como storytellersvault.com, achado real T0)
  → extrai JSON-LD via regex ancorada no <script> + JSON.parse: name→title, description, brand.name→publisherName
  → extrai sinais complementares fora do JSON-LD (regex de tag/bloco isolado, mais confiáveis que o equivalente no JSON-LD nesses fixtures):
      <link rel="canonical">→sourceUrl (evita parâmetro de tracking do offers.url)
      <meta property="og:image">→coverImageUrl (JSON-LD só tem path relativo, og:image já vem absoluto)
      <html lang="...">→sourceLanguageHint
      preço numérico + presença de <obs-product-format-pwyw-options>→extractedPriceValue, priceSignal, isFreeOrPwyw sugerido (achado real: sinal estrutural confiável — ver requisito 4 da spec)
  → monta OBJETO DE PREVIEW (shape próprio, não ScrapedItem — ver "Shape de preview" abaixo), valida contra schema Zod fechado
  → campo obrigatório ausente OU domínio de canonical não bate com source_platform → 422 explícito
  → checa duplicata por similaridade (trigram, adaptado de mesas/tableDuplicateDetection.ts) — nunca bloqueia, só sinaliza
  → grava registro de auditoria mínimo (sem HTML bruto, adaptado de mesas/discord_parse_cases)
  → sucesso → 200 com preview + duplicateCandidates (nunca persiste HTML nem publica material)
```

**Shape de preview (distinto de `ScrapedItem`/`ingestItemSchema`) — achado real da revisão:** `ScrapedItem.isFreeOrPwyw` é `boolean` obrigatório (`types.ts:10`) e `ingestItemSchema` exige `z.boolean()` (`scraper.ts:131`) — não há como representar "preço ambíguo" nesse shape. `/parse-html` devolve um objeto próprio: todos os campos de `ScrapedItem` (com `isFreeOrPwyw` como sugestão, não fato) **mais** `extractedPriceValue: number | null` e `priceSignal: 'pwyw_tag_present' | 'zero_price_no_pwyw_tag' | 'nonzero_price_no_pwyw_tag'`. O frontend usa esse shape rico pro preview; só na hora de chamar `POST /ingest` é que monta o `ScrapedItem` estrito (após o admin confirmar/corrigir `isFreeOrPwyw`).

**Nenhuma lib DOM (cheerio/linkedom) necessária** — confirmado contra os 3 fixtures reais: todos os campos são extraíveis via regex ancorada em blocos/tags isolados (JSON-LD é bloco único bem delimitado; `canonical`/`og:image`/`html lang` são tags soltas de padrão fixo; presença de `<obs-product-format-pwyw-options>` é checagem de substring, não precisa de parser de árvore DOM). Mesmo padrão já usado em `itchIoParser.ts`/`operaRpgScraper.ts` — sem dependência nova a perguntar ao mantenedor.

Fluxo do admin (dois passos, nunca publica sozinho — mesmo padrão de `mesas`/`parseTextForPreview` e do próprio Modo 3 já existente):
1. Admin abre página de produto real no navegador (já logado, contorna WAF), copia HTML renderizado (elemento `<html>` via DevTools "Copiar elemento", pós-Angular — não `Ctrl+U`).
2. Cola no campo novo do painel `/gestao` (UI nova, ver Fase 5) → chama `POST /parse-html` → recebe preview dos campos, incluindo preço numérico bruto e sinal usado.
3. Admin revisa cada campo (principalmente preço/`isFreeOrPwyw`, sempre exibido com contexto — nunca só um boolean sem explicação) → confirma/edita → frontend monta o `ScrapedItem` final → chama `POST /admin/scraper/ingest` já existente.

## Arquivos afetados

- `apps/downloads/backend/src/routes/scraper.ts` — rota nova `POST /parse-html`; **rota existente `POST /ingest` também muda** (campo opcional novo `parse_case_id` em `ingestBodySchema`/`ingestItemSchema`, ver T4.3 — mudança pequena mas em endpoint já em produção, não só adição).
- `apps/downloads/backend/src/services/scrapers/onebookshelfHtmlParser.ts` (novo) — função pura de extração (JSON-LD + meta tags → shape de preview), testável isoladamente com fixtures.
- `apps/downloads/backend/src/services/scrapers/onebookshelfHtmlParser.test.ts` (novo) — testes contra fixture real (ver Fase 0/1 em `tasks.md`).
- `apps/downloads/backend/test/fixtures/dms-guild-product-1.html`, `drivethrurpg-product-1.html` (fixtures válidas) e `storytellersvault-product-1.html` (fixture de teste NEGATIVO, achado real T0.2b) — já coletados e salvos, HTML real colado pelo mantenedor, nunca gerado especulativamente.
- `apps/downloads/backend/src/services/scrapers/onebookshelfDuplicateCheck.ts` (novo) — dedupe por similaridade (trigram), adaptado de `apps/mesas/backend/src/services/tableDuplicateDetection.ts`, nunca decide sozinho.
- `apps/downloads/backend/src/services/scrapers/onebookshelfDuplicateCheck.test.ts` (novo).
- `apps/downloads/database/migration_0XX_download_scraper_parse_log.sql` (nova, T4.1) — tabela de auditoria mínima própria; **decisão já resolvida** (não reaproveitar `download_scraper_run`/`download_scraper_item_log`, enums fechados demais e conceito não bate — ver T4.1 em `tasks.md`).
- `apps/downloads/frontend/src/pages/gestao/...` (a definir exato durante implementação) — campo de colar HTML + preview, reaproveitando componente de preview já existente se houver (checar `ParsePreviewTextArea.tsx` do `mesas` como referência de padrão de UI, sem copiar código entre apps).
- Migration possível: habilitar `pg_trgm` no banco `downloads` se ainda não estiver ativa (T3.1).

## Contratos/interfaces tocados

- Nenhum contrato de `packages/auth`/`accounts.` — reaproveita `authMiddleware`/`requireRole` já existentes no backend `downloads`.
- **Migration nova** (corrigido — achado real da revisão): tabela `download_scraper_parse_log` (auditoria mínima, T4.1) + possível `CREATE EXTENSION IF NOT EXISTS pg_trgm` se ainda não habilitada (T3.1). Não é "nenhuma mudança de schema" como a versão anterior deste plano dizia.
- **`ingestBodySchema`/`ingestItemSchema` (rota `/ingest` JÁ EXISTENTE) ganha campo opcional novo `parse_case_id`** (T4.3) — mudança em contrato de rota já em produção, retrocompatível (campo opcional, Modo 3 manual direto continua funcionando sem ele), mas precisa ser tratada com o mesmo cuidado de qualquer mudança em rota existente (teste de regressão do uso atual sem o campo novo).
- `docs/api/openapi/` ganha 1 rota nova (`/parse-html`) e reflete o campo novo em `/ingest` — `pnpm verify:api` obrigatório antes do commit (regra `AGENTS.md`).
- Payload de saída do `/parse-html` é um shape de PREVIEW próprio (ver "Shape de preview" acima), não o `ingestItemSchema` direto — o frontend converte antes de chamar `/ingest`.

## Impacto em consumidores

- Nenhum consumidor externo — rota nova, admin-only, opt-in (ninguém é forçado a usar em vez do Modo 3 manual).
- **Rota `/ingest` existente ganha campo opcional** — qualquer consumidor atual (se houver algum script/automação chamando direto, fora do frontend) continua funcionando sem alteração, já que o campo é opcional e não muda o comportamento quando ausente.
- Frontend `downloads` ganha UI nova no painel `/gestao`; não afeta rotas públicas nem outros apps.
- **Body parser global (`express.json({ limit: '4mb' })`, `server.ts:67`) já cobre os fixtures reais confirmados (133-155KB) com folga ampla** — achado real da revisão: não é necessário limite dedicado por rota (proposta original do requisito 7, mais complexa de implementar corretamente em Express sem afetar outras rotas do mesmo router). Rejeitar cedo por tamanho vira checagem simples dentro do próprio handler (`if (html.length > X) return 422`), não reconfiguração de middleware.

## Rollback

- Rota nova sem migration — rollback é reverter o PR/deploy, sem estado a desfazer no banco.
- Se o parser se mostrar não confiável em produção, desativar a rota (remover do router ou responder 501) não quebra nada — Modo 3 manual continua funcionando em paralelo, sempre foi e continua sendo o caminho garantido.

## Validação (como provo que funciona)

1. Fixture real de cada fonte (T0, bloqueante) — sem isso nenhuma outra task começa.
2. Testes unitários do parser contra as fixtures reais (cobrindo: extração bem-sucedida, campo obrigatório ausente → 422, JSON-LD malformado, HTML sem JSON-LD nenhum, payload maior que o limite).
3. Teste de integração confirmando que o HTML enviado nunca aparece em nenhuma saída de log durante o processamento (grep no output de log capturado pelo teste).
4. `pnpm verify:api`, lint, build, test verdes.
5. Smoke manual real em beta: colar HTML real de 1 produto de cada fonte, confirmar preview, publicar via `/ingest`, conferir item no catálogo público (`GET /materials`).

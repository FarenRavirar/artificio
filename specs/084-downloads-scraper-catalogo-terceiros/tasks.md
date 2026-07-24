# Tasks — Spec 084 (Downloads: scraper de indexação automática de terceiros)

- [ ] T0.1 — Atualizar `specs/backlog.md` e `project-state.md` com abertura da spec 084 (esta task).
- [x] T0.2 — Headless engine: `patchright` (Modo 2a) + `camoufox` (Modo 2b) — decidido por pesquisa 2026-07-24, não é mais pergunta aberta. Mantenedor autorizou instalar.
- [x] T0.3 — Detecção de idioma: `franc-min` + DeepSeek (desempate) — decidido por pesquisa 2026-07-24. Mantenedor autorizou instalar.
- [ ] T0.4 — Confirmar organização/autor oficial de cada pacote antes de instalar (`daijro/camoufox`, não `jo-inc/camofox-browser` — typosquat identificado na pesquisa).

## Fase 1 — Schema
- [ ] T1.1 — Auditar dado existente de `download_material_metadata.language` (nulo/diferente de `pt`) antes de aplicar `NOT NULL`/`CHECK` — parar e perguntar se houver divergência.
- [ ] T1.2 — Migration única: `source_platform` (enum com 8 fontes: itch_io/drivethrurpg/dms_guild/rpg_gratis/grimorios_e_dados/opera_rpg/catarse/newton_rocha/manual), `source_url`, `source_scraped_at` em `download_material`; `download_scraper_run` (+ `items_skipped_not_portuguese`, `trigger_kind`); `download_scraper_item_log` (+ `detected_language`); `is_scraper_origin` em `download_link_check`; `CHECK (language = 'pt')` + `NOT NULL` em `download_material_metadata`.
- [ ] T1.3 — Atualizar `db/types.ts`.
- [ ] T1.4 — `materialMetadata.ts`: `language: z.literal('pt')`. `materials.ts`: passa a validar `language` (hoje não trata).

## Fase 2 — Ator de sistema
- [ ] T2.1 — `getOrCreateScraperCreatorId()` idempotente.

## Fase 3 — Adapters
- [ ] T3.1 — `itchIoScraper.ts` (Modo 1, usa filtro nativo `lang-pt-BR` + `genre-rpg` na URL de descoberta).
- [ ] T3.2 — Adapters BR Modo 1: `rpgGratisScraper.ts`, `grimoriosEDadosScraper.ts`, `operaRpgScraper.ts`, `catarseScraper.ts`, `newtonRochaScraper.ts` (últimos 3 via interface `DiscoveryAdapter` — seguem link de saída).
- [ ] T3.3 — `headlessEngine/patchrightClient.ts` + `headlessEngine/camoufoxClient.ts` (interface comum `fetchRendered`) + `driveThruRpgScraper.ts`/`dmsGuildScraper.ts` (Modo 1 → 2a → 2b).
- [ ] T3.4 — `scraperRateLimiter.ts` (rate-limit de saída, delay entre requests contra terceiro).

## Fase 4 — Pipeline
- [ ] T4.1 — `languageDetector.ts` (`detectPortuguese` via franc-min + fallback DeepSeek em baixa confiança; reusado por scraper e submissão humana).
- [ ] T4.2 — `scraperIngest.ts` (idioma primeiro, depois dedupe, validação de preço, criação, log por item).

## Fase 5 — Rotas + cron
- [ ] T5.1 — `POST /admin/scraper/run` (fire-and-forget, 202 + run_id, `trigger_kind='manual'`).
- [ ] T5.2 — `GET /admin/scraper/run/:id`, `GET /admin/scraper/runs`.
- [ ] T5.3 — `POST /admin/scraper/ingest` (Modo 3).
- [ ] T5.4 — Cron diário (`trigger_kind='cron'`) só pras 6 fontes sem anti-bot (itch.io + 5 BR) — nunca inclui DriveThruRPG/DMs Guild.

## Fase 6 — Modo 3 (script local fora da IA)
- [ ] T6.1 — Script standalone (Node/Playwright+patchright ou Python) com `--user-data-dir` do profile Chrome real do mantenedor — fora de `apps/downloads/backend`, ex. `scripts/scraper-local/`.
- [ ] T6.2 — Documentar formato de payload esperado por `POST /admin/scraper/ingest`.

## Fase 7 — Re-checagem de preço
- [ ] T7.1 — Estender job/serviço de link-checker existente para materiais `source_platform != manual`.
- [ ] T7.2 — Confirmar que falha de acesso nunca deriva pra `withdrawn` sem confirmação real de preço pago.

## Fase 8 — Validação humana de idioma
- [ ] T8.1 — `materials.ts`/`materialMetadata.ts` chamam `languageDetector` no avanço draft→in_review; confirmar com mantenedor se divergência bloqueia ou só alerta moderador.
- [ ] T8.2 — `moderation.ts` expõe resultado da detecção na fila de moderação.

## Fase 9 — Frontend/SEO/página institucional
- [ ] T9.1 — Nova página pública de termos/uso (rota a confirmar, D107), conteúdo real cobrindo D119 + hub/redirecionamento + transparência do scraper + diretrizes D100.
- [ ] T9.2 — `index.html`: meta description/og:description mencionam "em português".
- [ ] T9.3 — Nav/rodapé: link pra página nova.
- [ ] T9.4 — `MaterialPage.tsx`/`MaterialCard.tsx`: exibição de idioma. `MaterialListFilters`/`useMaterialsCatalog.ts`: campo preparado.

## Fase 10 — Validação final
- [ ] T10.1 — Testes unitários (`scraperIngest`, `languageDetector`, `itchIoScraper` com fixture, `scraperCreator`, adapters BR).
- [ ] T10.2 — Testes de rota (run/ingest/get, rejeição de `language != 'pt'`, cron não incluindo DriveThruRPG/DMs Guild).
- [ ] T10.3 — Teste de página institucional (render + conteúdo real).
- [ ] T10.4 — `pnpm verify:api`, lint, build, test (backend + frontend).
- [ ] T10.5 — Smoke manual em beta (itch.io + fontes BR via cron; DriveThruRPG/DMs Guild manual confirmando 2a/2b tratado; Modo 3 rodado 1x contra DriveThruRPG; página institucional visitável).
- [ ] T10.6 — Atualizar status de `BL-084-DOWNLOADS-SCRAPER` em `specs/backlog.md` (só status geral, sem duplicar débitos — eles ficam listados apenas nesta spec) e `project-state.md` no fechamento.

## Débitos/riscos desta spec (ficam aqui, dentro da spec 084 — não duplicar em `specs/backlog.md`)
- [ ] D-084-01 — Lacuna jurídica: implicação de OGL/ORC sobre redistribuição de arquivo completo (vs. só texto de regras) não resolvida por pesquisa; precisa de análise jurídica dedicada antes de considerar resolvida.
- [ ] D-084-02 — Risco de suspensão de conta pessoal do mantenedor ao usar Modo 3 (script local com sessão logada real) para scraping — aceito conscientemente por decisão do mantenedor, mas deve ficar visível/rastreável, não escondido.
- [ ] D-084-03 — Detecção automática de idioma cobre só título/descrição submetidos, nunca o conteúdo do arquivo linkado — moderação humana continua sendo a única defesa contra esse caso específico; registrar como limitação permanente, não bug a corrigir depois.
- [ ] D-084-04 — Nenhuma ferramenta open source (patchright/Camoufox) dá garantia real contra Cloudflare Turnstile moderno; FlareSolverr (opção historicamente mais citada) está arquivado desde dez/2025. Decisão de manter os dois engines em cascata é experimental — dado real de sucesso por fonte decide o processo definitivo depois do primeiro smoke em beta.
- [ ] D-084-05 — RedeRPG (portal BR grande, `/downloads/` dedicada) exige cadastro/login — fora do MVP por trava de autenticação, não por falta de conteúdo relevante; candidato a spec futura se justificar o esforço de login automatizado (levanta questão própria de credenciais, fora do escopo atual).

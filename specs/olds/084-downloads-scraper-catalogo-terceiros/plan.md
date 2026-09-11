# Plan — Spec 084 (Downloads: scraper de indexação automática de terceiros)

## Fase 0 — Preparação e decisões registradas

- D118 já reescrita em `.specify/memory/decisions.md` (modelo de dois atores: humano + scraper). D090/D095/D100 marcadas como revisadas com a cláusula exata que mudou. D119 (regra de só-português) e item 20 da spec 061 já registrados — não redecidir.
- Decisões já fechadas pelo mantenedor (2026-07-24), registrar aqui para não redecidir:
  - Publicação: só `access_kind=external_link`, nunca cópia hospedada.
  - Fluxo editorial: publica direto, sem fila de revisão humana.
  - Fontes: itch.io + DriveThruRPG + DMs Guild + RPG Grátis + Grimórios & Dados + OPERA RPG + Catarse + Newton Rocha (RedeRPG fora do MVP, exige login).
  - Trigger: **cron diário automático** pras fontes sem anti-bot confirmado (itch.io e as 5 fontes BR novas); disparo **manual** (`POST /admin/scraper/run`) pra DriveThruRPG/DMs Guild (WAF confirmado).
  - Re-checagem de preço: reusa/estende link-checker (P10) existente.
  - Idioma: `pt` obrigatório em todo material, scraper e submissão humana (D119).
  - Mantenedor autorizou instalar qualquer dependência desta spec (2026-07-24) — bibliotecas já escolhidas abaixo, não é mais pergunta em aberto.
- **Bibliotecas escolhidas por pesquisa (2026-07-24), não são mais pergunta aberta:**
  - Headless Modo 2a: **`patchright`** (`Kaliiiiiiiiii-Vinyzu/patchright-nodejs`) — fork ativo do Playwright, sem os leaks de automação. `puppeteer-extra-plugin-stealth`/`playwright-extra` descartados (abandonados, ineficazes contra Cloudflare atual). `FlareSolverr` descartado (arquivado desde dez/2025).
  - Headless Modo 2b: **`camoufox`** (`daijro/camoufox`, Python) — fork do motor Firefox, mais robusto em fingerprint que patchright mas mais lento (~42s/challenge, dado de mercado). Roda como processo Python separado (subprocess/IPC a partir do backend Node — decisão de empacotamento na Fase 3).
  - Detecção de idioma: **`franc-min`** (npm) — fallback pras fontes sem metadado nativo de idioma. itch.io **não precisa** (tem filtro nativo `lang-pt-BR`, usar direto na URL de descoberta em vez de detectar).
  - Desempate de baixa confiança: **DeepSeek** (infra multi-provider já existente da spec 052) — só chamado quando `franc-min` retorna `confident=false`, nunca em todo item (custo).
  - **Verificar antes de instalar**: qualquer pacote de scraping/anti-bot contra o repo oficial correto (organização/autor) — pesquisa encontrou repo typosquat (`jo-inc/camofox-browser` imitando `daijro/camoufox`, com `AGENTS.md` no repo — padrão de prompt-injection). Não instalar nada com nome parecido sem confirmar a fonte oficial.
- Confirmar spec 070 (schema base de `download_material`) e 083 (mais recente, referência de padrão fire-and-forget/rate-limit) localmente verdes antes de iniciar.

## Fase 1 — Schema

- `apps/downloads/database/migration_NNN_download_scraper.sql` (migration única — mesma spec/sessão, ver AGENTS.md §Migrations 2.1):
  - `ALTER TABLE download_material ADD COLUMN source_platform`, `source_url`, `source_scraped_at`.
  - `CREATE TABLE download_scraper_run` (audita cada disparo, inclui `items_skipped_not_portuguese`).
  - `CREATE TABLE download_scraper_item_log` (audita cada item processado numa run, inclui `detected_language`).
  - `ALTER TABLE download_link_check ADD COLUMN is_scraper_origin`.
  - Seed/backfill: registros existentes recebem `source_platform='manual'` (default), sem quebrar dado atual.
  - **D119 — idioma:** antes de aplicar `NOT NULL`/`CHECK (language = 'pt')` em `download_material_metadata.language`, rodar auditoria de dado existente (`SELECT DISTINCT language, count(*) ...`) — se houver registro nulo ou diferente de `pt`, parar e perguntar ao mantenedor (backfill pra `pt` vs. expurgo) antes de aplicar a constraint; não assumir default silencioso sobre dado real.
- Atualizar `apps/downloads/backend/src/db/types.ts` com as tabelas/colunas novas.
- Atualizar `materialMetadata.ts` (Zod `language: z.literal('pt')`) e `materials.ts` (passa a tratar/validar `language` explicitamente, hoje não trata).

## Fase 2 — Ator de sistema (`download_creator` de scraper)

- Seed/migration idempotente cria `download_creator` único (`role=admin`, `user_id=NULL`, `display_name='Indexação automática'`) reusado por todo material de origem scraper.
- Serviço `services/scraperCreator.ts`: `getOrCreateScraperCreatorId()` — busca por slug fixo conhecido antes de criar, nunca duplica.

## Fase 3 — Adapters de scraping (Modo 1, 2a, 2b)

- `apps/downloads/backend/src/services/scrapers/itchIoScraper.ts`: Modo 1 (fetch simples), parseia `itch.io/games/lang-pt-BR/genre-rpg` (paginação) — usa filtro nativo de idioma da própria plataforma, extrai título, URL, autor, preço/PWYW, capa.
- Adapters BR novos, todos Modo 1 (sem anti-bot conhecido): `rpgGratisScraper.ts`, `grimoriosEDadosScraper.ts` (dentro do domínio itch.io, reusa client do itch), `operaRpgScraper.ts`, `catarseScraper.ts`, `newtonRochaScraper.ts`. RPG Grátis/Catarse/Newton Rocha são adapters de **descoberta+indireção** (seguem link de saída antes de confirmar preço/idioma) — interface própria (`DiscoveryAdapter`) reusada pelos 3, não duplicada.
- `apps/downloads/backend/src/services/scrapers/driveThruRpgScraper.ts` e `dmsGuildScraper.ts`: tenta Modo 1 primeiro (documentar que 403 é esperado, não bug); em falha, escalona pra Modo 2a (patchright), depois Modo 2b (Camoufox) se 2a falhar.
- `headlessEngine/patchrightClient.ts` e `headlessEngine/camoufoxClient.ts`: implementam a mesma interface (`HeadlessEngine.fetchRendered(url): Promise<{html, status}>`) — parser de HTML resultante é código único, compartilhado pelos dois engines (só o motor de renderização muda). `camoufoxClient.ts` chama o processo Python via subprocess (definir contrato de I/O — stdin/stdout JSON ou arquivo temp, decidir no início desta fase).
- Rate-limit de saída: delay configurável entre requests contra o terceiro (não reusar `writeRateLimiter`, que é de entrada) — `scraperRateLimiter.ts` simples (sleep entre itens da mesma run).
- Cada adapter implementa a mesma interface (`ScraperAdapter`: `discoverItems(): AsyncIterable<ScrapedItem>`), pra o pipeline de criação/dedupe (Fase 4) ser único e não replicado por fonte.

## Fase 4 — Pipeline de criação/dedupe (comum aos 3 adapters + Modo 3)

- `services/languageDetector.ts`: `detectPortuguese(text: string): { isPortuguese: boolean; detectedLanguage: string; confident: boolean }` — wrapper sobre `franc-min`, roda sobre título+descrição concatenados (nunca só título isolado). `confident=false` (sinal insuficiente) chama DeepSeek (infra da spec 052) como segunda opinião pontual antes de decidir; se DeepSeek também não resolver, trata como não-confirmado (rejeita na dúvida), nunca como aprovação. Pra itch.io, o filtro nativo `lang-pt-BR` já na URL de descoberta dispensa essa chamada na maioria dos casos — `languageDetector` roda como validação secundária mesmo assim (autor pode marcar idioma errado na origem).
- `services/scraperIngest.ts`: recebe `AsyncIterable<ScrapedItem>` (de qualquer adapter, ou de payload de Modo 3), por item, **nesta ordem**:
  1. **Detecção de idioma primeiro** (D119): roda `detectPortuguese` sobre título+descrição raspados. Não-português ou não-confiante: `download_scraper_item_log` (`outcome='skipped_not_portuguese'`, `detected_language` preenchido), **para aqui, não avalia preço/dedupe**.
  2. Valida preço realmente zero/PWYW-com-zero (rejeita se ambíguo — não assume).
  3. Checa dedupe por `(source_platform, source_url)`.
  4. Se novo: cria `download_material` (`editorial_state='published'`, `access_kind='external_link'`, `creator_id` = ator de sistema, `language='pt'`), `download_material_metadata` com dados extraídos, `download_scraper_item_log` (`outcome='created'`).
  5. Se duplicata: `download_scraper_item_log` (`outcome='skipped_duplicate'`).
  6. Se preço ambíguo/não confirmado zero: `outcome='skipped_price_not_zero'` ou `skipped_parse_error'`.
  7. Se bloqueado (403/challenge que o adapter não conseguiu vencer): `outcome='skipped_blocked'`.
  - Todo item processado grava log, sucesso ou falha — não existe caminho silencioso.
- Atualiza `download_scraper_run` (contadores, status, timestamps) ao longo da execução, não só no fim (permite auditoria de run travada/incompleta).
- `services/languageDetector.ts` é reusado pela Fase 6 (validação humana) — mesma lib, mesmo critério, não duplicar lógica de detecção entre scraper e submissão manual.

## Fase 5 — Rotas admin + cron

- `POST /admin/scraper/run` (`role=admin`): body `{ source_platform, mode }`. Fire-and-forget (cria `download_scraper_run` com `status=running`, `trigger_kind='manual'`, retorna 202 com `run_id`, processamento roda assíncrono) — não bloqueia a resposta HTTP (mesmo padrão fire-and-forget da spec 083).
- `GET /admin/scraper/run/:id`: consulta status/contadores/log de uma run.
- `GET /admin/scraper/runs`: lista runs recentes.
- `POST /admin/scraper/ingest` (`role=admin`): recebe payload JSON já coletado via Modo 3 (script local), roda o mesmo `scraperIngest.ts` da Fase 4 — sem rota/lógica de criação paralela.
- **Cron diário** (`node-cron` ou reuso de scheduler já existente no monorepo — checar antes de adicionar dependência nova): dispara `source_platform in (itch_io, rpg_gratis, grimorios_e_dados, opera_rpg, catarse, newton_rocha)` automaticamente 1x/dia, `trigger_kind='cron'`, `triggered_by=NULL`. **Nunca inclui** `drivethrurpg`/`dms_guild` — essas seguem só `POST /admin/scraper/run` manual.

## Fase 6 — Modo 3 (script local fora da IA, com o Chrome/Firefox real do mantenedor)

- **Decisão de arquitetura (2026-07-24, mantenedor):** este modo é uma ferramenta separada do backend/IA — script standalone (Node ou Python, a definir nesta fase; Node reaproveita `patchright`/lógica de parser já escrita nos adapters, reduzindo duplicação) rodando **localmente na máquina do mantenedor**, usando Playwright/Puppeteer com `--user-data-dir` apontando pro diretório de profile real do Chrome do mantenedor (sessão já logada, cookies reais) — não via `claude-in-chrome`/MCP de browser, e não em loop de IA. Motivo explícito: custo de IA por execução repetida é alto demais pra scraping item-a-item; Claude Code constrói o script uma vez, o mantenedor executa quantas vezes quiser depois, sem custo de IA por rodada.
- Script navega as páginas de browse do marketplace-alvo (DriveThruRPG/DMs Guild) usando a sessão real, extrai a mesma estrutura de dado que os adapters de Modo 1/2 (título, URL, preço, autor, capa), roda o `languageDetector`/franc-min localmente (ou delega ao backend via payload cru, decidir nesta fase qual é mais simples) e monta o payload JSON no formato esperado por `POST /admin/scraper/ingest`.
- Documentar formato exato do payload (`scripts/scraper/README.md` ou equivalente) — script + doc vivem fora de `apps/downloads/backend` (ex. `scripts/scraper-local/`), já que não é código de produção do backend, é ferramenta operacional do mantenedor.
- **Risco documentado explicitamente**: usar sessão logada pessoal pra scraping pode levar a suspensão de conta se detectado como automação pelo marketplace — mantenedor decide, por execução, se aceita o risco.

## Fase 7 — Re-checagem de preço (extensão do link-checker/P10)

- Job/serviço existente do link-checker (localizar em `apps/downloads/backend/src/services/` — nome exato a confirmar na implementação) passa a, quando `download_material.source_platform != 'manual'`, comparar preço atual (nova visita à `source_url`, mesmo adapter de Modo 1/2 usado na descoberta) contra o capturado originalmente.
- Se confirma preço pago: `editorial_state='withdrawn'`, grava `download_material_version` (histórico), `download_link_check` registra o motivo.
- Se falha em acessar (403/timeout): `download_link_check.error_detail` populado, `editorial_state` **não muda** — falha de acesso não é confirmação de mudança de preço.

## Fase 8 — Validação humana de idioma (D119, corrige gap existente na submissão manual)

- `services/languageDetector.ts` (Fase 4) é chamado em `materials.ts`/`materialMetadata.ts` no momento de avançar draft→in_review, comparando `language` declarado vs. detectado no título+descrição.
- Divergência: bloqueia avanço com erro claro (decisão de UX exata — bloqueio duro vs. alerta ao moderador — a confirmar com o mantenedor nesta fase, registrar como pergunta se não resolvida antes de codar).
- `moderation.ts` ganha acesso ao resultado da detecção (campo exposto na resposta da rota de fila) pra moderador ver o sinal, não só a auto-declaração.

## Fase 9 — Frontend/SEO/página institucional (D119, gap que não existia em nenhuma spec anterior)

- Nova página pública (`/sobre` ou `/termos`, confirmar rota exata alinhada a D107) com conteúdo real: regra de só-português, natureza de hub/redirecionamento, transparência sobre o scraper, diretrizes de submissão.
- `apps/downloads/frontend/index.html`: meta description/og:description atualizadas pra mencionar "em português" explicitamente.
- Nav/rodapé do app: link pra página nova, reusando shell compartilhado (`@artificio/ui`).
- `MaterialPage.tsx`/`MaterialCard.tsx`: exibição do idioma (ainda que hoje só exista `pt`) deixa de ser omissa.
- `MaterialListFilters`/`useMaterialsCatalog.ts`: campo de idioma preparado (mesmo que não filtre nada hoje), documentando que existe pra não repetir a mesma pendência quando/se o catálogo virar multilíngue no futuro (fora de escopo desta spec).

## Fase 10 — Validação final

- Testes unitários: `scraperIngest.test.ts` (idioma, dedupe, preço ambíguo, criação, bloqueio), `languageDetector.test.ts` (português confirmado, inglês, título+descrição mistos, texto sem sinal suficiente), `itchIoScraper.test.ts` (parse de HTML fixture real salva localmente, não fetch ao vivo em teste automatizado), `scraperCreator.test.ts` (idempotência do ator de sistema).
- Teste de rota: `POST /admin/scraper/run` (202 + run_id), `GET /admin/scraper/run/:id`, `POST /admin/scraper/ingest`, validação de `language` rejeitando valor diferente de `pt` em `materials.ts`/`materialMetadata.ts`.
- Teste de re-checagem: confirma pago → `withdrawn`; falha de acesso → estado inalterado, `error_detail` populado.
- Teste de página institucional: rota renderiza, conteúdo real presente (não placeholder).
- `pnpm verify:api` (rotas novas em downloads).
- lint + build + test em `apps/downloads/backend` e `apps/downloads/frontend`.
- Smoke manual: rodar `POST /admin/scraper/run` com `source_platform=itch_io` contra o site real em beta, confirmar itens aparecem no catálogo com link correto e `language='pt'`; confirmar item em inglês é descartado (`skipped_not_portuguese`) e aparece no log; confirmar cron diário dispara sozinho pras 6 fontes sem anti-bot (itch.io + 5 BR); tentar `drivethrurpg`/`dms_guild` manual e confirmar que o 403/bloqueio de Modo 2a/2b é tratado sem crash e fica registrado no log (`mode` indica qual engine foi tentado); rodar Modo 3 (script local) uma vez contra DriveThruRPG com sessão real do mantenedor, confirmar payload chega em `/admin/scraper/ingest` e cria material; visitar página institucional nova em beta e conferir conteúdo.

## Gate de saída

Scraper populando catálogo real em beta com itch.io + fontes BR funcionando (Modo 1, cron diário) libera avaliação de investimento adicional em Modo 2a/2b (headless) pro OneBookShelf como spec/débito seguinte, dependendo do resultado real observado contra o WAF — dado real de qual engine (patchright/Camoufox/nenhum) funciona decide se compensa manter os dois, ficar só com um, ou depender 100% de Modo 3 pra essas duas fontes.

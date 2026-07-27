import type { Kysely, Transaction } from 'kysely';
import { matchSystemNameExact, type MatchableSystemEntry } from '@artificio/catalog-matching';
import { db } from '../db';
import { detectPortuguese } from './languageDetector';
import { getOrCreateScraperCreatorId } from './scraperCreator';
import {
  getCatalogMaterialTypeBySlug,
  loadCatalogSystemsFlat,
  resolveTaxonomyIds,
  type FlatCatalogSystem,
} from './catalogClient';
import type { ScrapedItem } from './scrapers/types';
import type { Database, DownloadSourcePlatform, DownloadScraperItemOutcome } from '../db/types';
import { toJsonColumnValue } from '../db/jsonColumn';

// T4.2 (spec 084) — pipeline unico de criacao/dedupe, reusado por todo
// adapter (Fase 3) e pelo Modo 3 (payload de ingest manual, Fase 6). Ordem
// EXATA exigida por D119/plan.md — idioma primeiro, sempre, antes de
// qualquer outra checagem: material nao-portugues nunca deve "quase" entrar
// no catalogo por falha de ordem (ex.: dedupe rodando antes esconderia o
// filtro de idioma numa 2a execucao do mesmo item).
// Spec 088 (T2.9e, requisito 55) — o default era 'aventura', o que rotulava
// como Aventura todo material que ninguem classificou: afirmacao falsa sobre
// o conteudo, e a causa da distribuicao de 103 materiais numa linha so.
// Agora e um tipo NEUTRO da taxonomia central (seed em
// site/db/migrations/016), pra que "caiu no default" seja distinguivel de
// classificacao real — consulta pelo slug lista exatamente o que falta triar.
const DEFAULT_MATERIAL_TYPE_SLUG = 'nao-classificado';

export interface ScraperIngestResult {
  itemsFound: number;
  itemsCreated: number;
  itemsSkippedDuplicate: number;
  itemsSkippedNotPortuguese: number;
  itemsSkippedError: number;
}

function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function combineCredits(authors: string | null | undefined, artists: string | null | undefined): string | null {
  const values = [authors, artists]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());
  return values.length > 0 ? values.join('\n') : null;
}

async function generateUniqueSlug(title: string, sourceUrl: string): Promise<string> {
  const base = slugify(title) || 'material';
  const existing = await db
    .selectFrom('download_material')
    .select('slug')
    .where('slug', 'like', `${base}%`)
    .execute();

  const takenSlugs = new Set(existing.map((row) => row.slug));
  if (!takenSlugs.has(base)) return base;

  // Colisao real (2 titulos diferentes geram o mesmo slug base) — usa hash
  // curto e deterministico da sourceUrl como sufixo, nunca numero sequencial
  // (evita corrida entre runs concorrentes lendo a "proxima" contagem).
  const suffix = Buffer.from(sourceUrl).toString('base64url').slice(0, 8).toLowerCase();
  return `${base}-${suffix}`.slice(0, 140);
}

// Achado de review PR #193 (codeRabbit): falha ao GRAVAR o log de auditoria
// nunca pode mudar a classificacao do item nem abortar o processamento do
// restante da run — log e best-effort/observabilidade, o outcome real (item
// criado/deduplicado/rejeitado) ja aconteceu antes desta chamada.
async function logItem(
  runId: string,
  item: ScrapedItem,
  outcome: DownloadScraperItemOutcome,
  materialId: string | null,
  detectedLanguage: string | null,
  errorDetail: string | null,
): Promise<void> {
  try {
    await db
      .insertInto('download_scraper_item_log')
      .values({
        run_id: runId,
        material_id: materialId,
        source_url: item.sourceUrl,
        outcome,
        detected_language: detectedLanguage,
        error_detail: errorDetail,
      })
      .execute();
  } catch (error: unknown) {
    console.error('[scraperIngest] falha ao gravar log de item (outcome real preservado):', error instanceof Error ? error.message : error);
  }
}

// Driver pg anexa .code (SQLSTATE) ao erro; '23505' = unique_violation.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

function toMatchableEntry(node: FlatCatalogSystem): MatchableSystemEntry {
  return { id: node.id, name: node.name, name_pt: node.name_pt, aliases: node.aliases };
}

// T4.5 (spec 086, Fase 4) — auto-match AUTOMATICO (sem humano), igualdade
// exata normalizada contra nome/name_pt/aliases do catalogo carregado.
// Deliberadamente conservador (decisao do mantenedor): scoreSystemCandidates
// (fuzzy/pontuado) fica reservado pra triagem admin, onde um humano decide
// (routes/systemSuggestionsAdmin.ts). Resolve so system_id — edition_id fica
// pra quando o hint distinguir edicao explicitamente (fora do escopo desta
// fase: catalogo central resolve sistema, nao versao de regra por texto raso).
interface SystemHintResolution {
  systemId: string | null;
  editionId: string | null;
  rawSystemHint: string | null;
}

async function resolveSystemHint(systemHint: string | null | undefined): Promise<SystemHintResolution> {
  const hint = systemHint?.trim() || null;
  if (!hint) return { systemId: null, editionId: null, rawSystemHint: null };

  const catalogNodes = await loadCatalogSystemsFlat();
  const matched = matchSystemNameExact(hint, catalogNodes.map(toMatchableEntry));
  if (matched) {
    const { systemId, editionId } = resolveTaxonomyIds(matched.id, catalogNodes);
    return { systemId, editionId, rawSystemHint: null };
  }

  // Nao casou — preserva o texto bruto (equivalente a raw_system_hint do
  // mesas). O material nunca perde essa informacao nem finge que nao tem
  // sistema (requisito 6a da spec 086).
  return { systemId: null, editionId: null, rawSystemHint: hint };
}

// Spec 088 (T2.9d, requisitos 52/53/54) — resolve o hint de TIPO contra a
// taxonomia central, por ITEM (antes era uma unica resolucao por execucao,
// aplicada a todos). `getCatalogMaterialTypeBySlug` ja aceita slug OU alias
// com normalizacao pt-BR, entao o vocabulario proprio da fonte ("Regras
// basicas", "Core Rulebooks") casa sem taxonomia nova.
//
// Nao casou -> preserva o valor bruto e cai no tipo neutro, no mesmo padrao
// do raw_system_hint: o material nunca perde a informacao nem finge que ela
// nao existe. Escrever no catalogo central continua exclusivo da triagem
// admin (requisito 48/56) — aqui so se LE.
interface MaterialTypeResolution {
  materialType: { id: string; name: string };
  rawMaterialTypeHint: string | null;
}

async function resolveMaterialTypeHint(
  materialTypeHint: string | null | undefined,
  defaultMaterialType: { id: string; name: string },
): Promise<MaterialTypeResolution> {
  const hint = materialTypeHint?.trim() || null;
  if (!hint) return { materialType: defaultMaterialType, rawMaterialTypeHint: null };

  const matched = await getCatalogMaterialTypeBySlug(hint);
  if (matched && matched.status === 'active') {
    return { materialType: { id: matched.id, name: matched.name }, rawMaterialTypeHint: null };
  }

  return { materialType: defaultMaterialType, rawMaterialTypeHint: hint };
}

// T4.5 — abre a fila de triagem quando o scraper nao casou o hint contra o
// catalogo (source='scraper', sempre 'pending'). Nunca escreve no catalogo
// central diretamente — so a triagem admin faz isso (requisito 8).
// Achado real (review PR #204, Codex): sem trava, reprocessar o mesmo item
// empilhava suggestion 'pending' duplicada pro mesmo (material_id, raw_value).
// migration_027 (uidx_download_system_suggestion_scraper_pending) adiciona
// indice unico parcial so em source='scraper'+status='pending' — onConflict
// doNothing() torna este insert idempotente contra essa trava.
async function openSystemSuggestion(trx: Kysely<Database> | Transaction<Database>, materialId: string, rawValue: string): Promise<void> {
  await trx
    .insertInto('download_system_suggestion')
    .values({
      material_id: materialId,
      raw_value: rawValue,
      source: 'scraper',
      status: 'pending',
    })
    .onConflict((oc) => oc.columns(['material_id', 'raw_value']).where('source', '=', 'scraper').where('status', '=', 'pending').doNothing())
    .execute();
}

async function processItem(
  runId: string,
  sourcePlatform: DownloadSourcePlatform,
  scraperCreatorId: string,
  // T2.9d/T2.9e — este e o tipo NEUTRO de fallback, nao o tipo do item: cada
  // item resolve o proprio a partir do hint da fonte, e so cai aqui quando
  // nao ha hint ou ele nao casa contra a taxonomia central.
  defaultMaterialType: { id: string; name: string },
  item: ScrapedItem,
): Promise<DownloadScraperItemOutcome> {
  // 1. Idioma primeiro (D119) — nunca avalia preco/dedupe antes disso.
  if (item.sourceLanguageHint === 'not_pt') {
    await logItem(runId, item, 'skipped_not_portuguese', null, 'not_pt (sinal nativo da fonte)', null);
    return 'skipped_not_portuguese';
  }

  let detectedLanguage = 'pt';
  if (item.sourceLanguageHint !== 'pt') {
    const combinedText = `${item.title}\n${item.description ?? ''}`;
    const detection = await detectPortuguese(combinedText);
    detectedLanguage = detection.detectedLanguage;
    if (!detection.isPortuguese || !detection.confident) {
      await logItem(runId, item, 'skipped_not_portuguese', null, detectedLanguage, null);
      return 'skipped_not_portuguese';
    }
  }

  // 2. Preco realmente zero/PWYW — rejeita se ambiguo (adapter ja filtrou
  // isFreeOrPwyw!==true antes de produzir o item, mas o pipeline revalida
  // porque e a ultima linha de defesa antes de criar material publicado).
  if (!item.isFreeOrPwyw) {
    await logItem(runId, item, 'skipped_error', null, detectedLanguage, 'Preço não confirmado como zero/PWYW.');
    return 'skipped_error';
  }

  // 3. Dedupe por (source_platform, source_url).
  const existing = await db
    .selectFrom('download_material')
    .select('id')
    .where('source_platform', '=', sourcePlatform)
    .where('source_url', '=', item.sourceUrl)
    .executeTakeFirst();

  if (existing) {
    await logItem(runId, item, 'skipped_duplicate', existing.id, detectedLanguage, null);
    return 'skipped_duplicate';
  }

  // 4. Cria material + metadata, dentro de transacao (nunca material orfao
  // sem metadata, nunca metadata sem material).
  try {
    const slug = await generateUniqueSlug(item.title, item.sourceUrl);
    // T4.5 — resolve fora da transacao (chamada de rede ao catalogo central,
    // cacheada por loadCatalogSystemsFlat; nao faz sentido segurar a
    // transacao do Postgres esperando fetch externo).
    const systemResolution = await resolveSystemHint(item.systemHint);
    // T2.9d — resolucao POR ITEM (antes: uma vez por execucao, fora do laco,
    // aplicada a todos indistintamente). Fora da transacao pela mesma razao
    // do systemHint: consulta o catalogo central por rede, cacheada.
    const typeResolution = await resolveMaterialTypeHint(item.materialTypeHint, defaultMaterialType);
    const materialId = await db.transaction().execute(async (trx) => {
      const material = await trx
        .insertInto('download_material')
        .values({
          slug,
          title: item.title.slice(0, 200),
          // Spec 086: description já é texto plano; descriptionHtml fica só
          // em metadata. summary nunca pode cortar HTML no meio de uma tag.
          summary: item.description?.slice(0, 500) ?? null,
          description: item.description ?? null,
          material_type_id: typeResolution.materialType.id,
          material_type: typeResolution.materialType.name,
          creator_id: scraperCreatorId,
          editorial_state: 'published',
          access_kind: 'external_link',
          external_url: item.sourceUrl,
          source_platform: sourcePlatform,
          source_url: item.sourceUrl,
          source_scraped_at: new Date(),
          // T4.5 — casou por igualdade exata contra o catalogo -> system_id
          // (raiz) + edition_id (folha, se o node casado nao for a raiz);
          // nao casou -> preserva o texto bruto em raw_system_hint (nunca
          // perde a informacao nem finge que o material nao tem sistema).
          system_id: systemResolution.systemId,
          edition_id: systemResolution.editionId,
          raw_system_hint: systemResolution.rawSystemHint,
          // T2.9d (requisito 54) — hint de tipo que a fonte publicou mas o
          // catalogo ainda nao conhece: preservado bruto e o item fica no
          // tipo neutro, nunca descartado nem gravado no catalogo central
          // pelo scraper (essa escrita e exclusiva da triagem admin).
          raw_material_type_hint: typeResolution.rawMaterialTypeHint,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      // T4.5 — nao casou (rawSystemHint preenchido) abre a fila de triagem,
      // equivalente a missing_fields: ['system_name:unmatched_hint'] do
      // mesas: "nao achei sistema, mas tenho o texto".
      if (systemResolution.rawSystemHint) {
        await openSystemSuggestion(trx, material.id, systemResolution.rawSystemHint);
      }

      await trx
        .insertInto('download_material_metadata')
        .values({
          material_id: material.id,
          language: 'pt',
          publisher_name: item.publisherName,
          cover_image_url: item.coverImageUrl,
          scenario: item.scenario ?? null,
          credits: combineCredits(item.authorsCredits, item.artistsCredits),
          file_format: item.format ?? null,
          // Achado real (mesmo bug de materialMetadata.ts, smoke pós-deploy
          // spec 086, 2026-07-26): node-postgres sem type hint serializa
          // array JS como array literal do Postgres, não JSON — `[]` virava
          // `{}` no banco (sintaxe JSON válida como objeto vazio, quebra o
          // parse Zod que espera array). JSON.stringify explícito força o
          // parâmetro a chegar como texto JSON.
          tags: toJsonColumnValue(item.tags ?? []),
          file_size_text: item.fileSizeText ?? null,
          page_count: item.pageCount ?? null,
          creation_method: item.creationMethod ?? null,
          source_category: item.sourceCategory ?? null,
          source_filters: toJsonColumnValue(item.sourceFilters ?? []),
          description_html: item.descriptionHtml ?? null,
        })
        .execute();

      return material.id;
    });

    await logItem(runId, item, 'created', materialId, detectedLanguage, null);
    return 'created';
  } catch (error: unknown) {
    // Achado de review PR #193 (codeRabbit): violacao do indice UNIQUE
    // parcial (migration_022) e corrida real entre 2 runs concorrentes
    // processando a mesma (source_platform, source_url) — trata como
    // duplicata, nao como erro generico (o SELECT de dedupe acima ja cobre
    // o caso sequencial; isso fecha so a janela de corrida concorrente).
    if (isUniqueViolation(error)) {
      await logItem(runId, item, 'skipped_duplicate', null, detectedLanguage, null);
      return 'skipped_duplicate';
    }
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao criar material.';
    await logItem(runId, item, 'skipped_error', null, detectedLanguage, message);
    return 'skipped_error';
  }
}

export async function runScraperIngest(
  runId: string,
  sourcePlatform: DownloadSourcePlatform,
  items: AsyncIterable<ScrapedItem>,
): Promise<ScraperIngestResult> {
  const result: ScraperIngestResult = {
    itemsFound: 0,
    itemsCreated: 0,
    itemsSkippedDuplicate: 0,
    itemsSkippedNotPortuguese: 0,
    itemsSkippedError: 0,
  };

  // Achado real (review PR #205, Codex, nitpick): resolver o tipo dentro de
  // processItem repetia lookup/cache e convertia ausência canônica em um erro
  // por item. Falha uma vez antes do loop e reutiliza a referência no run.
  //
  // Spec 088 (T2.9d): isto continua valendo para o tipo NEUTRO de fallback —
  // ausência dele é falha de configuração do catálogo e deve abortar a run
  // inteira, não item a item. O que mudou é que ele deixou de ser o tipo de
  // TODOS os itens: cada item resolve o próprio hint dentro do laço, e só cai
  // aqui quando a fonte não expõe tipo ou o valor não casa.
  const defaultMaterialType = await getCatalogMaterialTypeBySlug(DEFAULT_MATERIAL_TYPE_SLUG);
  if (!defaultMaterialType || defaultMaterialType.status !== 'active') {
    throw new Error(`catalog_material_type_not_found: ${DEFAULT_MATERIAL_TYPE_SLUG}`);
  }

  // Achado de review PR #193 (codeRabbit): resolvido 1x por run, nao por
  // item — getOrCreateScraperCreatorId ja e idempotente, mas nao ha motivo
  // pra repetir a consulta/insert-on-conflict a cada item da mesma run.
  const scraperCreatorId = await getOrCreateScraperCreatorId();

  for await (const item of items) {
    result.itemsFound += 1;
    const outcome = await processItem(runId, sourcePlatform, scraperCreatorId, defaultMaterialType, item);

    switch (outcome) {
      case 'created':
        result.itemsCreated += 1;
        break;
      case 'skipped_duplicate':
        result.itemsSkippedDuplicate += 1;
        break;
      case 'skipped_not_portuguese':
        result.itemsSkippedNotPortuguese += 1;
        break;
      case 'skipped_error':
        result.itemsSkippedError += 1;
        break;
    }

    // Atualiza contadores incrementalmente — permite auditoria de run
    // travada/incompleta (plan.md), nao so escreve no fim.
    await db
      .updateTable('download_scraper_run')
      .set({
        items_found: result.itemsFound,
        items_created: result.itemsCreated,
        items_skipped_duplicate: result.itemsSkippedDuplicate,
        items_skipped_not_portuguese: result.itemsSkippedNotPortuguese,
        items_skipped_error: result.itemsSkippedError,
      })
      .where('id', '=', runId)
      .execute();
  }

  return result;
}

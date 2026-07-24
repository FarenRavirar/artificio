import { db } from '../db';
import { detectPortuguese } from './languageDetector';
import { getOrCreateScraperCreatorId } from './scraperCreator';
import type { ScrapedItem } from './scrapers/types';
import type { DownloadSourcePlatform, DownloadScraperItemOutcome } from '../db/types';

// T4.2 (spec 084) — pipeline unico de criacao/dedupe, reusado por todo
// adapter (Fase 3) e pelo Modo 3 (payload de ingest manual, Fase 6). Ordem
// EXATA exigida por D119/plan.md — idioma primeiro, sempre, antes de
// qualquer outra checagem: material nao-portugues nunca deve "quase" entrar
// no catalogo por falha de ordem (ex.: dedupe rodando antes esconderia o
// filtro de idioma numa 2a execucao do mesmo item).
const DEFAULT_MATERIAL_TYPE = 'adventure';

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

async function processItem(
  runId: string,
  sourcePlatform: DownloadSourcePlatform,
  scraperCreatorId: string,
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

    const materialId = await db.transaction().execute(async (trx) => {
      const material = await trx
        .insertInto('download_material')
        .values({
          slug,
          title: item.title.slice(0, 200),
          summary: item.description?.slice(0, 500) ?? null,
          description: item.description ?? null,
          material_type: DEFAULT_MATERIAL_TYPE,
          creator_id: scraperCreatorId,
          editorial_state: 'published',
          access_kind: 'external_link',
          external_url: item.sourceUrl,
          source_platform: sourcePlatform,
          source_url: item.sourceUrl,
          source_scraped_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('download_material_metadata')
        .values({
          material_id: material.id,
          language: 'pt',
          publisher_name: item.publisherName,
          cover_image_url: item.coverImageUrl,
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

  // Achado de review PR #193 (codeRabbit): resolvido 1x por run, nao por
  // item — getOrCreateScraperCreatorId ja e idempotente, mas nao ha motivo
  // pra repetir a consulta/insert-on-conflict a cada item da mesma run.
  const scraperCreatorId = await getOrCreateScraperCreatorId();

  for await (const item of items) {
    result.itemsFound += 1;
    const outcome = await processItem(runId, sourcePlatform, scraperCreatorId, item);

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

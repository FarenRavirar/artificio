import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { db } from '../db';

// Spec 087 (Fase 1B) — metricas de curadoria das prateleiras da vitrine.
//
// Metodo: Bayesian average / weighted rating (o mesmo do IMDB Top 250),
// escolhido pelo mantenedor em 2026-07-26 DEPOIS de rejeitar uma constante
// fixa arbitraria ("solucao preguicosa... tem que pensar em algo dinamico").
// Pesquisa registrada em spec.md §Calculo de popularidade e avaliacao comparou
// 3 algoritmos de producao (Wilson score/Reddit, Bayesian/IMDB, gravity/HN).
//
//   WR = (v / (v + m)) * R + (m / (v + m)) * C
//
//   R = media observada DO ITEM
//   v = volume de dado do item
//   C = media geral do catalogo (a ancora)
//   m = constante de confianca: quantos pontos de dado ate o item passar a
//       pesar mais que a ancora
//
// Efeito: item novo nasce ANCORADO na media do catalogo — nem punido nem
// inflado — e vai dominando o proprio score conforme acumula volume. E o que
// resolve o pedido do mantenedor: "material novo que comecou a decolar tem bom
// impacto", sem que 1 nota isolada de 5 estrelas lidere o catalogo.

/**
 * Confianca do rating: numero de avaliacoes ate o item pesar mais que a media
 * geral. Em m=5, um material com 5 avaliacoes ja vale metade proprio / metade
 * ancora. Valor inicial sugerido na spec, recalibravel com dado real de beta —
 * é parametro do metodo, nao chute.
 */
export const RATING_CONFIDENCE_M = 5;

/**
 * Confianca da popularidade, em eventos (views + downloads). Mais alto que o
 * de rating porque evento de trafego e mais barato/ruidoso que uma avaliacao
 * deliberada: exige mais volume pra convencer.
 */
export const POPULARITY_CONFIDENCE_M = 20;

/**
 * Janela movel da popularidade. Espelha o eixo "tendencia recente domina o
 * acumulado historico" (Hacker News gravity/decay) sem fórmula de decaimento
 * continuo: `download_metric_daily` ja e agregado por dia, entao recortar a
 * janela e mais simples e mais barato que decair evento a evento. Mesma janela
 * que routes/admin.ts ja usa pro painel de metricas.
 */
export const POPULARITY_WINDOW_DAYS = 30;

/**
 * Bayesian average. Retorna `null` quando nao ha volume nenhum (`v = 0`):
 * ausencia de dado nunca vira nota — material sem avaliacao nao aparece como
 * "0 estrelas", material sem download nao entra na prateleira de populares.
 */
export function bayesianAverage(
  itemMean: number,
  itemVolume: number,
  catalogMean: number,
  confidenceM: number,
): number | null {
  if (itemVolume <= 0) return null;
  const denominator = itemVolume + confidenceM;
  if (denominator <= 0) return null;
  return (itemVolume / denominator) * itemMean + (confidenceM / denominator) * catalogMean;
}

/**
 * Digest opaco da origem de uma visualizacao, pra dedup por (origem, material,
 * dia) — Requisito 13.
 *
 * Nunca persiste IP em claro: visualizacao e anonima por natureza e guardar
 * IP identificavel seria coleta desnecessaria de dado (compromisso petreo de
 * produto). O sal diario faz o mesmo IP gerar hash diferente a cada dia, entao
 * a tabela nao permite reconstruir historico de navegacao de ninguem.
 */
export function viewOriginHash(req: Request, isoDate: string): string {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const userAgent = req.get('user-agent') ?? 'unknown';
  return createHash('sha256').update(`${isoDate}:${ip}:${userAgent}`).digest('hex');
}

/** Data UTC de hoje, normalizada a meia-noite (chave diaria das metricas). */
export function utcToday(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

/** Corte inicial da janela movel de popularidade. */
export function popularityWindowStart(): Date {
  const start = utcToday();
  start.setUTCDate(start.getUTCDate() - POPULARITY_WINDOW_DAYS);
  return start;
}

export interface RatingAggregate {
  avgRating: number | null;
  ratingCount: number;
}

/**
 * Rating Bayesian por material (T1B.2). `avg_rating` sai ajustado; a contagem
 * sai crua, porque o card exibe "12 avaliacoes" real — mostrar contagem
 * ajustada seria mentir sobre quantas pessoas opinaram.
 */
export async function loadRatingAggregates(materialIds: string[]): Promise<Map<string, RatingAggregate>> {
  const result = new Map<string, RatingAggregate>();
  if (materialIds.length === 0) return result;

  // C da formula: media geral do catalogo inteiro, nao so da pagina — a ancora
  // precisa ser estavel entre paginas, senao o mesmo material teria score
  // diferente dependendo de onde aparece.
  const catalogRow = await db
    .selectFrom('download_rating')
    .select(({ fn }) => [fn.avg<number>('score').as('catalog_mean')])
    .executeTakeFirst();

  const catalogMean = Number(catalogRow?.catalog_mean ?? 0);

  const rows = await db
    .selectFrom('download_rating')
    .select(({ fn }) => [
      'material_id',
      fn.avg<number>('score').as('item_mean'),
      fn.countAll<number>().as('item_count'),
    ])
    .where('material_id', 'in', materialIds)
    .groupBy('material_id')
    .execute();

  for (const row of rows) {
    const itemMean = Number(row.item_mean);
    const itemCount = Number(row.item_count);
    result.set(row.material_id, {
      avgRating: bayesianAverage(itemMean, itemCount, catalogMean, RATING_CONFIDENCE_M),
      ratingCount: itemCount,
    });
  }

  return result;
}

/**
 * Popularidade Bayesian por material (T1B.3), dentro da janela movel.
 *
 * CORTE DE ELEGIBILIDADE, antes de qualquer calculo: material com
 * `download_count = 0` na janela nao entra no universo — nao recebe score, nao
 * aparece em `sort=trending`, nao dilui a media do catalogo. Regra de produto
 * fixa do mantenedor, nao constante ajustavel: visualizacao sozinha nunca e
 * sinal de valor (pode ser bot, curiosidade, clique perdido). Por isso o corte
 * e um filtro, e nao uma penalizacao dentro da formula — material so-visto
 * some da prateleira, nao vai pro fim dela.
 *
 * R = taxa de conversao do item, downloads / (views + downloads).
 */
export async function loadPopularityScores(materialIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (materialIds.length === 0) return result;

  const windowStart = popularityWindowStart();

  // C: taxa de conversao do catalogo ELEGIVEL (>= 1 download na janela). Nao
  // dilui a ancora com material que nunca converteu — senao a media geral
  // despencaria e qualquer download isolado pareceria excelente.
  const catalogRow = await db
    .selectFrom(
      db
        .selectFrom('download_metric_daily')
        .select(({ fn }) => [
          'material_id',
          fn.sum<number>('download_count').as('downloads'),
          fn.sum<number>('view_count').as('views'),
        ])
        .where('metric_date', '>=', windowStart)
        .groupBy('material_id')
        .having(({ fn, eb }) => eb(fn.sum<number>('download_count'), '>=', 1))
        .as('eligible'),
    )
    .select(({ fn }) => [
      fn.sum<number>('eligible.downloads').as('total_downloads'),
      fn.sum<number>('eligible.views').as('total_views'),
    ])
    .executeTakeFirst();

  const catalogDownloads = Number(catalogRow?.total_downloads ?? 0);
  const catalogViews = Number(catalogRow?.total_views ?? 0);
  const catalogEvents = catalogDownloads + catalogViews;
  const catalogMean = catalogEvents > 0 ? catalogDownloads / catalogEvents : 0;

  const rows = await db
    .selectFrom('download_metric_daily')
    .select(({ fn }) => [
      'material_id',
      fn.sum<number>('download_count').as('downloads'),
      fn.sum<number>('view_count').as('views'),
    ])
    .where('metric_date', '>=', windowStart)
    .where('material_id', 'in', materialIds)
    .groupBy('material_id')
    // O corte de elegibilidade em si: sem >= 1 download na janela, o material
    // nem chega a ter score calculado.
    .having(({ fn, eb }) => eb(fn.sum<number>('download_count'), '>=', 1))
    .execute();

  for (const row of rows) {
    const downloads = Number(row.downloads);
    const views = Number(row.views);
    const events = downloads + views;
    if (events <= 0) continue;

    const score = bayesianAverage(downloads / events, events, catalogMean, POPULARITY_CONFIDENCE_M);
    if (score !== null) result.set(row.material_id, score);
  }

  return result;
}

/**
 * IDs elegiveis pra `sort=trending`, ordenados por score. Usado pela listagem
 * quando o sort exige o universo inteiro (nao so a pagina atual) — ordenar
 * so a pagina daria ordem errada entre paginas.
 */
export async function loadTrendingOrder(): Promise<string[]> {
  const windowStart = popularityWindowStart();

  const rows = await db
    .selectFrom('download_metric_daily')
    .select(({ fn }) => [
      'material_id',
      fn.sum<number>('download_count').as('downloads'),
      fn.sum<number>('view_count').as('views'),
    ])
    .where('metric_date', '>=', windowStart)
    .groupBy('material_id')
    .having(({ fn, eb }) => eb(fn.sum<number>('download_count'), '>=', 1))
    .execute();

  if (rows.length === 0) return [];

  const totals = rows.reduce(
    (acc, row) => ({
      downloads: acc.downloads + Number(row.downloads),
      views: acc.views + Number(row.views),
    }),
    { downloads: 0, views: 0 },
  );
  const catalogEvents = totals.downloads + totals.views;
  const catalogMean = catalogEvents > 0 ? totals.downloads / catalogEvents : 0;

  return rows
    .flatMap((row) => {
      const downloads = Number(row.downloads);
      const views = Number(row.views);
      const events = downloads + views;
      if (events <= 0) return [];
      const score = bayesianAverage(downloads / events, events, catalogMean, POPULARITY_CONFIDENCE_M);
      return score === null ? [] : [{ materialId: row.material_id, score }];
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.materialId);
}

/**
 * IDs com pelo menos 1 avaliacao, ordenados por rating Bayesian. Mesma razao
 * de loadTrendingOrder: a ordem tem que valer pro catalogo inteiro.
 * Material sem nota nenhuma fica de fora (nunca aparece como "0 estrelas").
 */
export async function loadRatingOrder(): Promise<string[]> {
  const catalogRow = await db
    .selectFrom('download_rating')
    .select(({ fn }) => [fn.avg<number>('score').as('catalog_mean')])
    .executeTakeFirst();

  const catalogMean = Number(catalogRow?.catalog_mean ?? 0);

  const rows = await db
    .selectFrom('download_rating')
    .select(({ fn }) => [
      'material_id',
      fn.avg<number>('score').as('item_mean'),
      fn.countAll<number>().as('item_count'),
    ])
    .groupBy('material_id')
    .execute();

  return rows
    .flatMap((row) => {
      const score = bayesianAverage(
        Number(row.item_mean),
        Number(row.item_count),
        catalogMean,
        RATING_CONFIDENCE_M,
      );
      return score === null ? [] : [{ materialId: row.material_id, score }];
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.materialId);
}

/**
 * Registra a visualizacao da ficha (T1B.1), deduplicada por origem+dia.
 *
 * Fail-soft: metrica nunca derruba a ficha publica. Se a gravacao falhar, o
 * material continua carregando normalmente — perder uma contagem e aceitavel,
 * devolver 500 numa pagina publica nao e.
 */
export async function registerMaterialView(materialId: string, req: Request): Promise<boolean> {
  try {
    const today = utcToday();
    const isoDate = today.toISOString().slice(0, 10);
    const viewHash = viewOriginHash(req, isoDate);

    const inserted = await db
      .insertInto('download_material_view')
      .values({ material_id: materialId, view_hash: viewHash, view_date: today })
      .onConflict((oc) => oc.columns(['material_id', 'view_hash', 'view_date']).doNothing())
      .returning('material_id')
      .executeTakeFirst();

    // Só a PRIMEIRA view daquela origem no dia incrementa — refresh repetido
    // colide na PK e vira no-op. Mesmo padrão de dedup que
    // download_user_material_download já usa pra download por conta.
    if (!inserted) return false;

    await db
      .insertInto('download_metric_daily')
      .values({ material_id: materialId, metric_date: today, view_count: 1 })
      .onConflict((oc) => oc.columns(['material_id', 'metric_date']).doUpdateSet((eb) => ({
        view_count: eb('download_metric_daily.view_count', '+', 1),
      })))
      .execute();

    return true;
  } catch (error) {
    console.error('[materials] view metric unavailable', error);
    return false;
  }
}

/** Expurgo das linhas de dedup que ja passaram da janela util. */
export async function purgeStaleViewDedup(): Promise<void> {
  const cutoff = utcToday();
  cutoff.setUTCDate(cutoff.getUTCDate() - 2);
  await db.deleteFrom('download_material_view').where('view_date', '<', cutoff).execute();
}

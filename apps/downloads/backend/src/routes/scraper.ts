import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { runScraperIngest } from '../services/scraperIngest';
import { ItchIoScraper } from '../services/scrapers/itchIoScraper';
import { GrimoriosEDadosScraper } from '../services/scrapers/grimoriosEDadosScraper';
import { OperaRpgScraper } from '../services/scrapers/operaRpgScraper';
import { DriveThruRpgScraper } from '../services/scrapers/driveThruRpgScraper';
import { DmsGuildScraper } from '../services/scrapers/dmsGuildScraper';
import { parseOneBookShelfHtml, OneBookShelfParseError, MAX_HTML_LENGTH } from '../services/scrapers/onebookshelfHtmlParser';
import { findDuplicateCandidates } from '../services/scrapers/onebookshelfDuplicateCheck';
import type { DownloadSourcePlatform } from '../db/types';
import type { ScraperAdapter, ScrapedItem } from '../services/scrapers/types';

const router = Router();

// T5.1-T5.3 (spec 084) — rotas admin do scraper. `role=admin` (nao
// moderator) em todas — acao de maior impacto/risco que criacao manual
// (spec.md §7, D118). Fire-and-forget no disparo (mesmo padrao da spec 083
// pra e-mail): responde 202 com run_id, processamento roda assincrono, nunca
// bloqueia a resposta HTTP.

const ADAPTERS: Partial<Record<DownloadSourcePlatform, () => ScraperAdapter>> = {
  itch_io: () => new ItchIoScraper(),
  grimorios_e_dados: () => new GrimoriosEDadosScraper(),
  opera_rpg: () => new OperaRpgScraper(),
  drivethrurpg: () => new DriveThruRpgScraper(),
  dms_guild: () => new DmsGuildScraper(),
};

// Achado de review PR #193 (codeRabbit, nitpick): deriva a validacao de
// source_platform do proprio ADAPTERS, nunca repete os literais — se um
// adapter for adicionado/removido, a validacao acompanha sem editar 2 lugares.
const IMPLEMENTED_SOURCE_PLATFORMS = Object.keys(ADAPTERS) as [DownloadSourcePlatform, ...DownloadSourcePlatform[]];

const runBodySchema = z.object({
  source_platform: z.enum(IMPLEMENTED_SOURCE_PLATFORMS),
});

export async function executeScraperRun(runId: string, sourcePlatform: DownloadSourcePlatform): Promise<void> {
  const factory = ADAPTERS[sourcePlatform];
  if (!factory) {
    await db
      .updateTable('download_scraper_run')
      .set({ status: 'failed', error_detail: `Fonte sem adapter implementado: ${sourcePlatform}`, finished_at: new Date() })
      .where('id', '=', runId)
      .execute();
    return;
  }

  try {
    const adapter = factory();
    await runScraperIngest(runId, sourcePlatform, adapter.discoverItems());
    await db
      .updateTable('download_scraper_run')
      .set({ status: 'completed', finished_at: new Date() })
      .where('id', '=', runId)
      .execute();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida na execução do scraper.';
    await db
      .updateTable('download_scraper_run')
      .set({ status: 'failed', error_detail: message, finished_at: new Date() })
      .where('id', '=', runId)
      .execute();
  }
}

router.post('/run', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = runBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'source_platform inválido ou ausente.', details: z.treeifyError(parsed.error) });
  }

  const run = await db
    .insertInto('download_scraper_run')
    .values({ source_platform: parsed.data.source_platform, trigger_kind: 'manual' })
    .returning('id')
    .executeTakeFirstOrThrow();

  // Fire-and-forget: nao aguarda a execucao completa antes de responder.
  // executeScraperRun ja captura toda excecao internamente e grava
  // status='failed' na run — catch aqui e defensivo (achado de review PR
  // #193), cobre so o caso de alguem remover esse try/catch interno no
  // futuro sem essa rejeicao virar unhandled rejection silenciosa.
  executeScraperRun(run.id, parsed.data.source_platform).catch((error: unknown) => {
    console.error('[scraper] executeScraperRun rejeitou inesperadamente:', error);
  });

  return res.status(202).json({ run_id: run.id });
});

router.get('/run/:id', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const run = await db
    .selectFrom('download_scraper_run')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!run) {
    return res.status(404).json({ error: 'Run não encontrada.' });
  }

  const itemLogs = await db
    .selectFrom('download_scraper_item_log')
    .selectAll()
    .where('run_id', '=', run.id)
    .orderBy('created_at', 'asc')
    .execute();

  return res.json({ ...run, item_logs: itemLogs });
});

router.get('/runs', writeRateLimiter, authMiddleware, requireRole('admin'), async (_req: Request, res: Response) => {
  const runs = await db
    .selectFrom('download_scraper_run')
    .selectAll()
    .orderBy('started_at', 'desc')
    .limit(50)
    .execute();

  return res.json({ items: runs });
});

// Formato do item de Modo 3 espelha ScrapedItem (services/scrapers/types.ts)
// — mesmo pipeline scraperIngest.ts, sem rota/logica de criacao paralela.
// T4.3 (spec 085) — parse_case_id opcional: quando o item veio de
// /parse-html, linka o resultado do ingest ao registro de auditoria
// (download_scraper_parse_log). Ausente = uso direto do Modo 3 manual,
// sem ter passado pelo parser — comportamento inalterado.
const ingestItemSchema = z.object({
  sourceUrl: z.url(),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  isFreeOrPwyw: z.boolean(),
  coverImageUrl: z.url().nullable(),
  publisherName: z.string().nullable(),
  sourceLanguageHint: z.enum(['pt', 'not_pt']).nullable(),
  parse_case_id: z.uuid().optional(),
});

const ingestBodySchema = z.object({
  source_platform: z.enum(IMPLEMENTED_SOURCE_PLATFORMS),
  items: z.array(ingestItemSchema).min(1).max(500),
});

router.post('/ingest', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = ingestBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload de ingest inválido.', details: z.treeifyError(parsed.error) });
  }

  const run = await db
    .insertInto('download_scraper_run')
    .values({ source_platform: parsed.data.source_platform, trigger_kind: 'local_ingest' })
    .returning('id')
    .executeTakeFirstOrThrow();

  // T4.3 — parse_case_id nao faz parte do ScrapedItem que o pipeline
  // consome; extraido aqui, linkado depois via source_url (unico por item
  // no payload) apos o pipeline gravar download_scraper_item_log.
  const parseCaseIdBySourceUrl = new Map<string, string>();
  const items: ScrapedItem[] = parsed.data.items.map((item) => {
    if (item.parse_case_id) parseCaseIdBySourceUrl.set(item.sourceUrl, item.parse_case_id);
    const { parse_case_id: _parseCaseId, ...scrapedItem } = item;
    return scrapedItem;
  });
  async function* asyncIterableOfItems(): AsyncIterable<ScrapedItem> {
    for (const item of items) yield item;
  }

  try {
    await runScraperIngest(run.id, parsed.data.source_platform, asyncIterableOfItems());
    await db
      .updateTable('download_scraper_run')
      .set({ status: 'completed', finished_at: new Date() })
      .where('id', '=', run.id)
      .execute();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida no ingest.';
    await db
      .updateTable('download_scraper_run')
      .set({ status: 'failed', error_detail: message, finished_at: new Date() })
      .where('id', '=', run.id)
      .execute();
    return res.status(502).json({ run_id: run.id, error: message });
  }

  // T4.3 — linka parse_case_id -> material_id criado, best-effort (falha
  // aqui nunca deve mudar o resultado do ingest, mesmo principio de logItem
  // em scraperIngest.ts: link e observabilidade, nao parte do pipeline core).
  if (parseCaseIdBySourceUrl.size > 0) {
    const itemLogs = await db
      .selectFrom('download_scraper_item_log')
      .select(['source_url', 'material_id'])
      .where('run_id', '=', run.id)
      .where('material_id', 'is not', null)
      .execute();

    for (const log of itemLogs) {
      const parseCaseId = parseCaseIdBySourceUrl.get(log.source_url);
      if (!parseCaseId || !log.material_id) continue;
      await db
        .updateTable('download_scraper_parse_log')
        .set({ confirmed_material_id: log.material_id })
        .where('parse_case_id', '=', parseCaseId)
        .execute();
    }
  }

  const finalRun = await db
    .selectFrom('download_scraper_run')
    .selectAll()
    .where('id', '=', run.id)
    .executeTakeFirstOrThrow();

  return res.json(finalRun);
});

// T2.1 (spec 085) — parser HTML determinístico (sem IA), admin cola HTML
// real de produto DMs Guild/DriveThruRPG (WAF bloqueia scraper automático).
// Escopo intencionalmente menor que IMPLEMENTED_SOURCE_PLATFORMS — não
// reaproveita a allowlist do scraper automático, só as 2 fontes bloqueadas.
const PARSE_HTML_SOURCE_PLATFORMS = ['dms_guild', 'drivethrurpg'] as const;

const parseHtmlBodySchema = z.object({
  source_platform: z.enum(PARSE_HTML_SOURCE_PLATFORMS),
  html: z.string().min(1).max(MAX_HTML_LENGTH),
});

router.post('/parse-html', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = parseHtmlBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'Payload de parse-html inválido.', details: z.treeifyError(parsed.error) });
  }

  try {
    const preview = parseOneBookShelfHtml(parsed.data.html, parsed.data.source_platform);
    // T3.3 — candidatos de duplicata nunca bloqueiam o preview (sempre 200,
    // mesmo com candidato encontrado); admin decide no frontend.
    const duplicateCandidates = await findDuplicateCandidates(preview.title);

    // T4.2 — auditoria minima: quais campos vieram preenchidos vs. vazios,
    // nunca o HTML bruto (mesma trava do requisito 6 da spec).
    const fieldsExtracted = {
      title: Boolean(preview.title),
      description: preview.description !== null,
      coverImageUrl: preview.coverImageUrl !== null,
      publisherName: preview.publisherName !== null,
      sourceLanguageHint: preview.sourceLanguageHint !== null,
      extractedPriceValue: preview.extractedPriceValue !== null,
      isFreeOrPwyw: preview.isFreeOrPwyw !== null,
    };
    const parseLog = await db
      .insertInto('download_scraper_parse_log')
      .values({
        source_platform: parsed.data.source_platform,
        admin_user_id: req.user!.userId,
        fields_extracted: fieldsExtracted,
        price_signal: preview.priceSignal,
      })
      .returning('parse_case_id')
      .executeTakeFirstOrThrow();

    return res.json({ preview, duplicateCandidates, parse_case_id: parseLog.parse_case_id });
  } catch (error: unknown) {
    if (error instanceof OneBookShelfParseError) {
      return res.status(422).json({ error: error.message, code: error.code });
    }
    throw error;
  }
});

export default router;

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
const ingestItemSchema = z.object({
  sourceUrl: z.url(),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  isFreeOrPwyw: z.boolean(),
  coverImageUrl: z.url().nullable(),
  publisherName: z.string().nullable(),
  sourceLanguageHint: z.enum(['pt', 'not_pt']).nullable(),
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

  const items: ScrapedItem[] = parsed.data.items;
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

  const finalRun = await db
    .selectFrom('download_scraper_run')
    .selectAll()
    .where('id', '=', run.id)
    .executeTakeFirstOrThrow();

  return res.json(finalRun);
});

export default router;

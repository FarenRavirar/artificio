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
import { parseHtml, GenericParseError, MAX_HTML_LENGTH } from '../services/scrapers/genericHtmlParser';
import { KNOWN_PARSER_KINDS } from '../services/scrapers/platformOverrides';
import { findDuplicateCandidates } from '../services/scrapers/onebookshelfDuplicateCheck';
import type { DownloadSourcePlatform, DownloadScraperPlatform } from '../db/types';
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
  source_platform: z.string().min(1),
  items: z.array(ingestItemSchema).min(1).max(500),
});

// Achado real (review PR #201, Codex, P1): /ingest validava source_platform
// contra IMPLEMENTED_SOURCE_PLATFORMS (Object.keys(ADAPTERS), só as 5
// fontes com scraper automático) — vestígio da Fase 5. Depois da Fase 6
// (registry em banco), qualquer site cadastrado só via /gestao/plataformas
// (ex.: storytellersvault, ou site novo do admin) nunca teria adapter em
// ADAPTERS, então /parse-html funcionava mas /ingest sempre devolvia 400 —
// quebra o fluxo prometido pela emenda (cadastrar site sem deploy).
// runScraperIngest só usa o slug como string (dedupe/gravação), não chama
// ADAPTERS — então a allowlist certa aqui é "está cadastrado no registry",
// não "tem adapter automático" (essa trava continua em ADAPTERS/executeScraperRun,
// só relevante pro disparo de scraping automático via /run e pelo cron).
// Achado real (review PR #201, Sonar): extraído do handler /ingest pra
// reduzir complexidade cognitiva — mesmo comportamento de antes (T4.3,
// best-effort, nunca sobrescreve a resposta 200 do ingest).
async function linkParseCaseIdsToMaterials(runId: string, parseCaseIdBySourceUrl: Map<string, string>): Promise<void> {
  if (parseCaseIdBySourceUrl.size === 0) return;
  try {
    const itemLogs = await db
      .selectFrom('download_scraper_item_log')
      .select(['source_url', 'material_id'])
      .where('run_id', '=', runId)
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida.';
    console.error(`[scraper] Falha ao vincular parse_case_id -> material_id (run ${runId}): ${message}`);
  }
}

router.post('/ingest', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = ingestBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload de ingest inválido.', details: z.treeifyError(parsed.error) });
  }

  const platform = await db
    .selectFrom('download_scraper_platform')
    .select('slug')
    .where('slug', '=', parsed.data.source_platform)
    .executeTakeFirst();
  if (!platform) {
    return res.status(400).json({ error: `source_platform "${parsed.data.source_platform}" não está cadastrado no registry de plataformas.` });
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
  // Achado real (review PR #199): sem try/catch, falha nesta auditoria
  // devolvia 500 mesmo com ingest já concluído com sucesso, e um retry do
  // admin batia em duplicata. Envolvido pra nunca sobrescrever a resposta 200.
  await linkParseCaseIdsToMaterials(run.id, parseCaseIdBySourceUrl);

  const finalRun = await db
    .selectFrom('download_scraper_run')
    .selectAll()
    .where('id', '=', run.id)
    .executeTakeFirstOrThrow();

  return res.json(finalRun);
});

// T7.3 (spec 085, Fase 7) — parser HTML determinístico (sem IA), admin cola
// HTML de qualquer site cadastrado no registry. Payload passa a ser SÓ
// `{ html }` — remove `source_platform` do body: elimina o bug P2 do
// review PR #200 na raiz (admin não pode escolher a plataforma errada
// porque não escolhe mais nenhuma, é sempre detectada pelo canonical).
const parseHtmlBodySchema = z.object({
  html: z.string().min(1).max(MAX_HTML_LENGTH),
});

async function findPlatformByDomain(domain: string): Promise<DownloadScraperPlatform | null> {
  const row = await db
    .selectFrom('download_scraper_platform')
    .selectAll()
    .where('domain', '=', domain)
    .executeTakeFirst();
  return row ?? null;
}

router.post('/parse-html', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = parseHtmlBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'Payload de parse-html inválido.', details: z.treeifyError(parsed.error) });
  }

  let detectedPlatform: DownloadScraperPlatform | null = null;
  try {
    const preview = await parseHtml(parsed.data.html, async (domain) => {
      detectedPlatform = await findPlatformByDomain(domain);
      return detectedPlatform;
    });
    // detectedPlatform sempre setado aqui — parseHtml lança unsupported_platform
    // antes de prosseguir quando findPlatformByDomain devolve null.
    const platform = detectedPlatform!;

    // T3.3 — candidatos de duplicata nunca bloqueiam o preview (sempre 200,
    // mesmo com candidato encontrado); admin decide no frontend.
    const duplicateCandidates = await findDuplicateCandidates(preview.title);

    // T4.2 — auditoria minima: quais campos vieram preenchidos vs. vazios,
    // nunca o HTML bruto (mesma trava do requisito 6 da spec). source_platform
    // grava a plataforma DETECTADA (T7.3), não mais escolhida pelo admin.
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
        source_platform: platform.slug,
        admin_user_id: req.user!.userId,
        fields_extracted: fieldsExtracted,
        price_signal: preview.priceSignal,
      })
      .returning('parse_case_id')
      .executeTakeFirstOrThrow();

    return res.json({
      preview,
      duplicateCandidates,
      parse_case_id: parseLog.parse_case_id,
      detectedPlatform: { slug: platform.slug, name: platform.name },
    });
  } catch (error: unknown) {
    if (error instanceof GenericParseError) {
      return res.status(422).json({ error: error.message, code: error.code });
    }
    throw error;
  }
});

// T6.4 (spec 085, Fase 6) — CRUD minimo do registry de plataformas
// (download_scraper_platform): admin cadastra site novo (100+ previstos)
// sem deploy. parser_kind restrito aos overrides que de fato existem em
// codigo (T7.2, KNOWN_PARSER_KINDS importado — fonte unica, nunca lista
// duplicada aqui) — cadastrar um kind inexistente so falharia na hora de
// usar (parse-html), 422 aqui evita esse erro tardio e confuso.

const platformSlugSchema = z
  .string()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9_]+$/, 'slug deve conter só letras minúsculas, números e underscore.');

const platformDomainSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9.-]+$/i, 'domain deve ser um hostname puro, sem scheme/path/porta.')
  .nullable();

const createPlatformBodySchema = z.object({
  slug: platformSlugSchema,
  name: z.string().min(1).max(100),
  domain: platformDomainSchema,
  supports_auto_scrape: z.boolean().optional(),
  supports_price_recheck: z.boolean().optional(),
  parser_kind: z.enum(KNOWN_PARSER_KINDS).optional(),
});

router.get('/platforms', writeRateLimiter, authMiddleware, requireRole('admin'), async (_req: Request, res: Response) => {
  const platforms = await db
    .selectFrom('download_scraper_platform')
    .selectAll()
    .orderBy('name', 'asc')
    .execute();

  return res.json({ items: platforms });
});

router.post('/platforms', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = createPlatformBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(422).json({ error: 'Payload de plataforma inválido.', details: z.treeifyError(parsed.error) });
  }

  try {
    const normalizedDomain = parsed.data.domain?.toLowerCase() ?? null;
    const platform = await db
      .insertInto('download_scraper_platform')
      .values({
        slug: parsed.data.slug,
        name: parsed.data.name,
        domain: normalizedDomain,
        supports_auto_scrape: parsed.data.supports_auto_scrape,
        supports_price_recheck: parsed.data.supports_price_recheck,
        parser_kind: parsed.data.parser_kind,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return res.status(201).json(platform);
  } catch (error: unknown) {
    // Violação de UNIQUE (slug/domain) — mesmo padrão de erro 422 já usado
    // no resto da rota, sem vazar detalhe interno do Postgres pro cliente.
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505') {
      return res.status(422).json({ error: 'slug ou domain já cadastrado.' });
    }
    throw error;
  }
});

export default router;

import { Router, type Request, type Response } from 'express';
import express from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { checkLink } from '../services/linkChecker';
import { detectAllowedFileType } from '../storage/fileTypeGuard';
import { sanitizeText } from '../services/sanitizeText';

const router = Router();

// T1.1 (spec 075) — dashboard admin: contagem por fila, usada pela sidebar de
// recursos (criterio de aceite 1/8: idade da fila visivel ao moderador).
router.get('/summary', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (_req: Request, res: Response) => {
  const [moderationQueue, oldestInReview, reportsOpen, oldestReport, degradedLinks] = await Promise.all([
    db.selectFrom('download_material').select(({ fn }) => fn.countAll<number>().as('count')).where('editorial_state', '=', 'in_review').executeTakeFirstOrThrow(),
    db.selectFrom('download_material').select('updated_at').where('editorial_state', '=', 'in_review').orderBy('updated_at', 'asc').executeTakeFirst(),
    db.selectFrom('download_report').select(({ fn }) => fn.countAll<number>().as('count')).where('case_state', 'in', ['open', 'in_review']).executeTakeFirstOrThrow(),
    db.selectFrom('download_report').select('created_at').where('case_state', 'in', ['open', 'in_review']).orderBy('created_at', 'asc').executeTakeFirst(),
    db.selectFrom('download_link_check').select(({ fn }) => fn.countAll<number>().as('count')).where('is_healthy', '=', false).executeTakeFirstOrThrow(),
  ]);

  return res.json({
    moderation_queue: {
      count: Number(moderationQueue.count),
      oldest_since: oldestInReview?.updated_at ?? null,
    },
    reports_open: {
      count: Number(reportsOpen.count),
      oldest_since: oldestReport?.created_at ?? null,
    },
    degraded_links: {
      count: Number(degradedLinks.count),
    },
  });
});

// T3.1/T3.2 (spec 075) — auditoria admin: historico completo por material,
// incluindo TODOS os links ja usados (nao so o external_url atual). O PATCH
// de materials.ts ja grava versao por campo (inclui external_url); aqui so
// filtra e expoe as trocas de external_url isoladas pra tela de auditoria.
router.get('/materials/:id/link-history', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const history = await db
    .selectFrom('download_material_version')
    .selectAll()
    .where('material_id', '=', req.params.id)
    .where('field_name', '=', 'external_url')
    .orderBy('changed_at', 'desc')
    .execute();

  return res.json(history);
});

// T5.1-T5.3 (spec 075) — link checker sob demanda, admin/moderador. Job
// agendado real (cron) fica fora deste escopo (sem infra de scheduler
// disponivel nesta rodada); esta rota cobre o contrato de checagem+gravacao,
// reusavel por qualquer scheduler futuro.
router.post('/materials/:id/check-link', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .select(['id', 'external_url'])
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  if (!material.external_url) {
    return res.status(409).json({ error: 'Material não tem link externo configurado.' });
  }

  const result = await checkLink(material.external_url);

  const saved = await db
    .insertInto('download_link_check')
    .values({
      material_id: material.id,
      checked_url: result.checkedUrl,
      http_status: result.httpStatus,
      is_healthy: result.isHealthy,
      error_detail: result.errorDetail,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.json(saved);
});

// T3.4/T6.3 (spec 061) — status mais recente de link por material, pra tela
// "Links" do admin sinalizar destino degradado sem recalcular tudo.
router.get('/links', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (_req: Request, res: Response) => {
  const latestChecks = await db
    .selectFrom('download_link_check as lc1')
    .innerJoin('download_material', 'download_material.id', 'lc1.material_id')
    .selectAll('lc1')
    .select(['download_material.slug as material_slug', 'download_material.title as material_title'])
    .where('lc1.checked_at', '=', (eb) =>
      eb
        .selectFrom('download_link_check as lc2')
        .select(({ fn }) => fn.max('lc2.checked_at').as('max_checked_at'))
        .whereRef('lc2.material_id', '=', 'lc1.material_id'),
    )
    .orderBy('lc1.checked_at', 'desc')
    .execute();

  return res.json(latestChecks);
});

// T6.3 (spec 075) — metricas administrativas completas, nunca expostas fora
// do admin (criterio de aceite: acesso completo pais/dispositivo/horario
// quando aplicavel). MVP: download_metric_daily nao tem coluna de
// pais/dispositivo (nao coletado ainda por analytics proprio do downloads;
// GA4 cobre isso fora do banco) — aqui agrega o que existe (por material/dia)
// e documenta a lacuna como leitura completa do que ha hoje, nao parcial.
router.get('/metrics', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (_req: Request, res: Response) => {
  const perMaterial = await db
    .selectFrom('download_metric_daily')
    .innerJoin('download_material', 'download_material.id', 'download_metric_daily.material_id')
    .select([
      'download_material.id as material_id',
      'download_material.slug as material_slug',
      'download_material.title as material_title',
      ({ fn }) => fn.sum<number>('download_metric_daily.download_count').as('total_downloads'),
      ({ fn }) => fn.sum<number>('download_metric_daily.view_count').as('total_views'),
    ])
    .groupBy(['download_material.id', 'download_material.slug', 'download_material.title'])
    .orderBy('total_downloads', 'desc')
    .execute();

  return res.json({
    per_material: perMaterial,
    note: 'País/dispositivo/horário não coletados no banco do downloads (GA4 cobre fora do banco); esta rota expõe download/view agregados, que é toda a métrica administrativa hoje disponível.',
  });
});

const evidenceUploadQuerySchema = z.object({
  filename: z.string().trim().min(1),
});

// T6.2 (spec 075) — reforco de magic bytes no fluxo admin, mesmo sem storage
// real conectado (upload real depende de credencial de provider, DEB-073-03/
// 071 T6.2). Contrato: valida o arquivo por magic bytes e persiste so o
// registro de evidencia (download_evidence), nunca o arquivo em si — storage
// real e plugado depois sem mudar este contrato de validacao.
router.post(
  '/materials/:id/evidence/upload',
  writeRateLimiter,
  authMiddleware,
  requireRole(['moderator', 'admin']),
  express.raw({ type: '*/*', limit: '20mb' }),
  async (req: Request, res: Response) => {
    // Narrowing explicito e isolado (CodeQL js/type-confusion-through-parameter-tampering,
    // achados #207/#208 PR #151): Express aceita ?filename=a&filename=b como
    // string[]. `filenameRaw` e a UNICA leitura de req.query.filename nesta rota;
    // todo uso posterior (Zod, split, detectAllowedFileType) parte dela, ja
    // estreitada para string, nunca do req.query cru de novo.
    const filenameRaw: unknown = Array.isArray(req.query.filename) ? undefined : req.query.filename;
    const parsedQuery = evidenceUploadQuerySchema.safeParse({ filename: filenameRaw });
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Parâmetro "filename" é obrigatório.' });
    }
    const filename: string = parsedQuery.data.filename;

    const material = await db
      .selectFrom('download_material')
      .select('id')
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!material) {
      return res.status(404).json({ error: 'Material não encontrado.' });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Corpo da requisição deve ser o arquivo binário.' });
    }

    const extension: string = filename.includes('.') ? (filename.split('.').pop() as string) : '';
    const detectedType = detectAllowedFileType(req.body, extension);

    if (!detectedType) {
      return res.status(422).json({ error: 'Tipo de arquivo não reconhecido/permitido pelos magic bytes.' });
    }

    const evidence = await db
      .insertInto('download_evidence')
      .values({
        material_id: material.id,
        evidence_kind: detectedType,
        submitted_by: req.user!.userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return res.status(201).json(evidence);
  },
);

const sanitizePreviewSchema = z.object({
  text: z.string().max(8000),
});

// T6.1 (spec 075) — endpoint auxiliar pro frontend admin previsualizar texto
// sanitizado antes de renderizar (comentario/resolution_note/descricao).
router.post('/sanitize-preview', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), (req: Request, res: Response) => {
  const parsed = sanitizePreviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  return res.json({ sanitized: sanitizeText(parsed.data.text) });
});

export default router;

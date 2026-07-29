import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { CoverImageValidationError } from '../services/coverImage';
import { CoverMetadataWriteError, isCloudinaryCoverEnabled, storeCoverBuffer, storeCoverFromPublicUrl } from '../services/coverStorage';

const router = Router();
const coverQuerySchema = z.object({
  filename: z.string().trim().min(1).max(255),
});

const coverUrlSchema = z.object({ url: z.url({ protocol: /^https?$/ }).trim() });

router.get('/cover-capabilities', (_req: Request, res: Response) => {
  return res.json({ cloudinary_enabled: isCloudinaryCoverEnabled() });
});

router.post('/:id/cover-url', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = coverUrlSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'URL de capa inválida.' });
  const material = await db.selectFrom('download_material').select(['id', 'creator_id']).where('id', '=', req.params.id).executeTakeFirst();
  if (!material) return res.status(404).json({ error: 'Material não encontrado.' });
  const canEdit = material.creator_id === req.user!.userId || req.user!.role === 'moderator' || req.user!.role === 'admin';
  if (!canEdit) return res.status(403).json({ error: 'Você não tem permissão para alterar a capa deste material.' });
  try {
    return res.status(201).json(await storeCoverFromPublicUrl(material.id, parsed.data.url));
  } catch (error) {
    console.error('[material-cover] remote cover failed', error);
    return res.status(422).json({ error: error instanceof Error ? error.message : 'Falha ao importar capa.' });
  }
});

router.post(
  '/:id/cover',
  writeRateLimiter,
  authMiddleware,
  express.raw({ type: '*/*', limit: '6mb' }),
  async (req: Request, res: Response) => {
    // Achado CodeQL PR #228: estreitar o parâmetro na própria fronteira HTTP.
    // Query repetida pode virar string[]; objeto também não é nome de arquivo.
    const filenameParam = req.query.filename;
    if (typeof filenameParam !== 'string') {
      return res.status(400).json({ error: 'Parâmetro "filename" é obrigatório.' });
    }
    const parsedQuery = coverQuerySchema.safeParse({ filename: filenameParam });
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Parâmetro "filename" é obrigatório.' });
    }
    const filename: string = parsedQuery.data.filename;

    const material = await db
      .selectFrom('download_material')
      .select(['id', 'creator_id'])
      .where('id', '=', req.params.id)
      .executeTakeFirst();
    if (!material) return res.status(404).json({ error: 'Material não encontrado.' });

    const isOwner = material.creator_id === req.user!.userId;
    const canEditAny = req.user!.role === 'moderator' || req.user!.role === 'admin';
    if (!isOwner && !canEditAny) {
      return res.status(403).json({ error: 'Você não tem permissão para alterar a capa deste material.' });
    }

    const declaredMimeType = req.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!isCloudinaryCoverEnabled()) return res.status(503).json({ error: 'Upload de capa está desligado.' });
    // Achado de review PR #228 (CodeQL, type confusion): `express.raw` só
    // popula `req.body` como Buffer quando o content-type casa; guardar e
    // estreitar aqui evita passar `any` adiante e torna o 400 explícito.
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Corpo da requisição inválido para upload de capa.' });
    }
    const coverBuffer: Buffer = req.body;
    try {
      const result = await storeCoverBuffer(material.id, coverBuffer, filename, declaredMimeType);
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof CoverImageValidationError) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof CoverMetadataWriteError) return res.status(500).json({ error: 'Falha ao salvar a capa.' });
      console.error('[material-cover] Cloudinary upload failed', error);
      return res.status(502).json({ error: error instanceof Error ? error.message : 'Falha ao enviar a capa.' });
    }
  },
);

export default router;

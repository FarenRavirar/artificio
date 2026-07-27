import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { registerMaterialDownload } from '../services/downloadRegistry';

const router = Router();

const registerDownloadSchema = z.object({
  material_id: z.string().trim().min(1),
});

// T3.1/T3.2 (spec 074) — clique logado no CTA registra download. Dedup por
// (conta, material) via PK composta em download_user_material_download:
// so a PRIMEIRA insercao incrementa download_metric_daily (criterio de
// aceite 4); cliques seguintes da mesma conta retornam already=true sem
// incrementar de novo, mas o CTA continua redirecionando normalmente.
router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = registerDownloadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const material = await db
    .selectFrom('download_material')
    .select('id')
    .where('id', '=', parsed.data.material_id)
    .where('editorial_state', '=', 'published')
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  // Spec 088 — logica movida pra `services/downloadRegistry.ts`: a resolucao
  // de destino tambem precisa registrar (ancora nativa nao dispara `onClick`
  // em botao do meio / "Abrir em nova aba"), e duas copias divergiriam.
  const { countedNow } = await registerMaterialDownload(req.user!.userId, material.id);

  return res.status(200).json({ already_counted: !countedNow });
});

export default router;

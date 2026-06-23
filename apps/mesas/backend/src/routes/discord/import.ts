import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { importDiscordChatExporterJson, extractJsonPayload } from '../../discord/chatExporterImportService';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';

const router = Router();

function isAdmin(req: Request, res: Response): boolean {
  if ((req as any).user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return false;
  }
  return true;
}

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;

  try {
    const extracted = extractJsonPayload(req.body);
    if ('error' in extracted) {
      return res.status(extracted.status).json({ error: extracted.error });
    }

    const result = await importDiscordChatExporterJson(extracted.payload);

    return res.json({
      data: {
        total: result.total,
        inserted: result.inserted,
        updated: result.updated,
        ignored: result.ignored,
        failed: result.failed,
      },
    });
  } catch (error: unknown) {
    if (error instanceof DiscordChatExporterValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[POST /admin/discord-sync/import-json]', error);
    return res.status(500).json({ error: 'Erro ao importar JSON do DiscordChatExporter.' });
  }
});

export default router;

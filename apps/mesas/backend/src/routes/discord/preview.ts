import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { extractJsonPayload } from '../../discord/chatExporterImportService';
import { discordChatExporterExportSchema } from '../../discord/discordChatExporterTypes';

const router = Router();

function isAdmin(req: Request, res: Response): boolean {
  if ((req as any).user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return false;
  }
  return true;
}

router.post('/preview', authMiddleware, async (req: Request, res: Response) => {
  if (!isAdmin(req, res)) return;

  try {
    const extracted = extractJsonPayload(req.body);
    if ('error' in extracted) {
      return res.status(extracted.status).json({ error: extracted.error });
    }

    const jsonPayload = extracted.payload;
    const exportData = discordChatExporterExportSchema.parse(jsonPayload);

    const attachmentsCount = exportData.messages.reduce((sum, msg) => sum + (msg.attachments?.length ?? 0), 0);
    const embedsCount = exportData.messages.reduce((sum, msg) => sum + (msg.embeds?.length ?? 0), 0);

    return res.json({
      data: {
        guild: exportData.guild,
        channel: exportData.channel,
        dateRange: exportData.dateRange ?? null,
        exportedAt: exportData.exportedAt ?? null,
        messageCount: exportData.messageCount ?? exportData.messages.length,
        messagesWithAttachments: attachmentsCount,
        messagesWithEmbeds: embedsCount,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: `JSON inválido ou incompatível com o formato esperado.${issues.length ? ` ${issues.join('; ')}` : ''}` });
    }
    console.error('[POST /admin/discord-sync/import-json/preview]', error);
    return res.status(500).json({ error: 'Erro ao analisar JSON do DiscordChatExporter.' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/auth';
import { extractJsonPayload } from '../../discord/chatExporterImportService';
import { discordChatExporterExportSchema } from '../../discord/discordChatExporterTypes';

const router = Router();

router.post('/preview', requireAdmin, async (req: Request, res: Response) => {

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
        totalAttachments: attachmentsCount,
        totalEmbeds: embedsCount,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
      const detail = issues.length > 0 ? ` ${issues.join('; ')}` : '';
      return res.status(400).json({ error: `JSON inválido ou incompatível com o formato esperado.${detail}` });
    }
    console.error('[POST /admin/discord-sync/import-json/preview]', error);
    return res.status(500).json({ error: 'Erro ao analisar JSON do DiscordChatExporter.' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAdmin } from '../../middleware/auth';
import { extractJsonPayload, buildPreviewFromExport, MAX_IMPORT_JSON_BYTES, MAX_IMPORT_MESSAGES } from '../../discord/chatExporterImportService';
import { discordChatExporterExportSchema } from '../../discord/discordChatExporterTypes';

const router = Router();

export const jsonFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_JSON_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.toLowerCase().endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Envie apenas arquivos .json.'));
    }
  },
});

router.post('/preview', requireAdmin, async (req: Request, res: Response) => {

  try {
    const extracted = extractJsonPayload(req.body);
    if ('error' in extracted) {
      return res.status(extracted.status).json({ error: extracted.error });
    }

    const jsonPayload = extracted.payload;
    const exportData = discordChatExporterExportSchema.parse(jsonPayload);

    return res.json({ data: buildPreviewFromExport(exportData) });
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

router.post('/preview/file', requireAdmin, jsonFileUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const rawJson = req.file.buffer.toString('utf-8');

    if (rawJson.length > MAX_IMPORT_JSON_BYTES) {
      return res.status(413).json({ error: `JSON muito grande (${(rawJson.length / 1024 / 1024).toFixed(1)} MB). O limite é ${MAX_IMPORT_JSON_BYTES / 1024 / 1024} MB.` });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return res.status(400).json({ error: 'JSON inválido: o arquivo não contém JSON válido.' });
    }

    const exportData = discordChatExporterExportSchema.parse(parsed);

    if (exportData.messages.length > MAX_IMPORT_MESSAGES) {
      return res.status(413).json({ error: `Muitas mensagens (${exportData.messages.length}). O limite é ${MAX_IMPORT_MESSAGES}.` });
    }

    return res.json({ data: buildPreviewFromExport(exportData) });
  } catch (error: unknown) {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `Arquivo muito grande. O limite é ${MAX_IMPORT_JSON_BYTES / 1024 / 1024} MB.` });
      }
      return res.status(400).json({ error: 'Erro ao processar arquivo.' });
    }
    if (error instanceof Error && error.message === 'Formato inválido. Envie apenas arquivos .json.') {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      const issues = error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
      const detail = issues.length > 0 ? ` ${issues.join('; ')}` : '';
      return res.status(400).json({ error: `JSON inválido ou incompatível com o formato esperado.${detail}` });
    }
    console.error('[POST /admin/discord-sync/import-json/preview/file]', error);
    return res.status(500).json({ error: 'Erro ao analisar JSON do DiscordChatExporter.' });
  }
});

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAdmin } from '../../middleware/auth';
import { extractJsonPayload, buildPreviewFromExport, MAX_IMPORT_JSON_BYTES, MAX_IMPORT_MESSAGES, parseUploadedJsonBuffer } from '../../discord/chatExporterImportService';
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

/**
 * Middleware de upload com tratamento de erro do multer.
 * CodeRabbit (Major): multer roda ANTES do handler, então MulterError e o erro
 * do fileFilter não caem no try/catch da rota — sem isto, viram 500 no global.
 */
export function uploadJsonFile(req: Request, res: Response, next: NextFunction): void {
  jsonFileUpload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: `Arquivo muito grande. O limite é ${MAX_IMPORT_JSON_BYTES / 1024 / 1024} MB.` });
        return;
      }
      res.status(400).json({ error: 'Erro ao processar arquivo.' });
      return;
    }
    if (err instanceof Error && err.message === 'Formato inválido. Envie apenas arquivos .json.') {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  });
}

// REV-016: helper de erro (DRY — elimina duplicação entre POST /preview e POST /preview/file)
function respondPreviewError(res: Response, error: unknown, route: string): void {
  if (error instanceof z.ZodError) {
    const issues = error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
    const detail = issues.length > 0 ? ` ${issues.join('; ')}` : '';
    res.status(400).json({ error: `JSON inválido ou incompatível com o formato esperado.${detail}` });
    return;
  }
  console.error(`[POST ${route}]`, error);
  res.status(500).json({ error: 'Erro ao analisar JSON do DiscordChatExporter.' });
}

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
    respondPreviewError(res, error, '/admin/discord/import-json/preview');
  }
});

router.post('/preview/file', requireAdmin, uploadJsonFile, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const parsed = parseUploadedJsonBuffer(req.file);
    if ('error' in parsed) return res.status(parsed.status).json({ error: parsed.error });

    const exportData = discordChatExporterExportSchema.parse(parsed.parsed);

    if (exportData.messages.length > MAX_IMPORT_MESSAGES) {
      return res.status(413).json({ error: `Muitas mensagens (${exportData.messages.length}). O limite é ${MAX_IMPORT_MESSAGES}.` });
    }

    return res.json({ data: buildPreviewFromExport(exportData) });
  } catch (error: unknown) {
    // Erros do multer (LIMIT_FILE_SIZE / fileFilter) já são tratados em uploadJsonFile.
    respondPreviewError(res, error, '/admin/discord/import-json/preview/file');
  }
});

export default router;

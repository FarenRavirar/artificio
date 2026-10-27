import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { strictRateLimiter } from '../middleware/rateLimit.js';
import { parseClientErrorBody, recordClientError } from '../services/clientErrors.js';

const router = Router();

/** Corpo legitimo cabe em ~10 KB (campos truncados); acima disso e abuso. */
const MAX_BODY_BYTES = 16 * 1024;

// POST /api/v1/client-errors — erro de renderizacao/rota no navegador (spec 106 R19).
// Publico (o erro pode ser de quem nao logou). Responde 204 mesmo quando o teto
// descarta: o cliente nunca precisa saber, e nunca deve tentar de novo.
router.post('/', strictRateLimiter, optionalAuth, async (req: Request, res: Response) => {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > MAX_BODY_BYTES) return res.status(413).json({ error: 'Corpo grande demais.' });

  const input = parseClientErrorBody(req.body);
  if (!input) return res.status(400).json({ error: 'Payload inválido.' });

  try {
    await recordClientError(input, req.user?.userId ?? null);
  } catch (error: unknown) {
    // Telemetria nunca derruba nada: falha vira log do servidor, resposta segue 204.
    console.error('[POST /client-errors]', error);
  }
  return res.status(204).end();
});

export default router;

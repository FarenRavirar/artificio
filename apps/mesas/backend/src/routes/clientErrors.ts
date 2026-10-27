import express, { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { clientErrorRateLimiter } from '../middleware/rateLimit.js';
import { parseClientErrorBody, recordClientError } from '../services/clientErrors.js';

const router = Router();

/**
 * Corpo legitimo: o cliente trunca cada campo (`reportClientError.ts`), no pior caso
 * ~5,5 mil caracteres, ate ~22 KB em UTF-8 multibyte; 64 KB cobre com folga e
 * ainda e abuso acima disso. O parser
 * proprio recusa com 413 ate requisicao sem `Content-Length` (chunked), que o
 * teste por cabecalho deixava passar. Precisa ser montado ANTES do `express.json`
 * global de 12 MB (`server.ts`), que senao consome o corpo primeiro.
 */
const MAX_BODY = '64kb';
router.use(express.json({ limit: MAX_BODY }));

// POST /api/v1/client-errors — erro de renderizacao/rota no navegador (spec 106 R19).
// Publico (o erro pode ser de quem nao logou). Responde 204 mesmo quando o teto
// descarta: o cliente nunca precisa saber, e nunca deve tentar de novo.
router.post('/', clientErrorRateLimiter, optionalAuth, async (req: Request, res: Response) => {
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

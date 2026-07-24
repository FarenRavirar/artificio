import request from 'supertest';
import express from 'express';

// T8.1 (spec 084) — submit roda detectPortuguese 1x, persiste resultado
// (detected_language/language_confident/language_checked_at), NUNCA bloqueia
// o envio mesmo quando confirma não-português (decisão do mantenedor: só
// alerta o moderador na fila, quem decide reprovar é humano).

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, updateTable: dbMocks.updateTable },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'owner-1', role: 'user' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../services/moderationEmail', () => ({
  sendModerationEmail: vi.fn().mockResolvedValue(undefined),
}));

const detectPortugueseMock = vi.hoisted(() => vi.fn());
vi.mock('../services/languageDetector', () => ({
  detectPortuguese: detectPortugueseMock,
}));

import moderationRoutes from './moderation';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/moderation', moderationRoutes);
  return server;
}

function materialQuery(material: unknown) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(material),
  };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.updateTable.mockReset();
  detectPortugueseMock.mockReset();
});

describe('POST /api/v1/moderation/:id/submit — detecção de idioma (Fase 8)', () => {
  it('material não-português confirmado: envio SEMPRE funciona (200), resultado persistido pra fila', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', editorial_state: 'draft', title: 'English Adventure', description: 'A dungeon crawl' };
    dbMocks.selectFrom.mockReturnValueOnce(materialQuery(material));
    detectPortugueseMock.mockResolvedValue({ isPortuguese: false, detectedLanguage: 'eng', confident: true });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'in_review' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);

    await request(app()).post('/api/v1/moderation/material-1/submit').expect(200);

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        editorial_state: 'in_review',
        detected_language: 'eng',
        language_confident: true,
      }),
    );
  });

  it('detecção não-confiante (baixa confiança): persiste confident=false, ainda não bloqueia', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', editorial_state: 'draft', title: 'X', description: null };
    dbMocks.selectFrom.mockReturnValueOnce(materialQuery(material));
    detectPortugueseMock.mockResolvedValue({ isPortuguese: false, detectedLanguage: 'und', confident: false });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'in_review' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);

    await request(app()).post('/api/v1/moderation/material-1/submit').expect(200);

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ language_confident: false }),
    );
  });

  it('português confirmado: persiste detected_language=por, confident=true', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', editorial_state: 'draft', title: 'Aventura completa em português', description: 'Um cenário de mistério ambientado numa vila pequena com muitos segredos.' };
    dbMocks.selectFrom.mockReturnValueOnce(materialQuery(material));
    detectPortugueseMock.mockResolvedValue({ isPortuguese: true, detectedLanguage: 'por', confident: true });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'in_review' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);

    await request(app()).post('/api/v1/moderation/material-1/submit').expect(200);

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ detected_language: 'por', language_confident: true }),
    );
  });
});

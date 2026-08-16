import express from 'express';
import request from 'supertest';

/**
 * T5.3/T5.7 (spec 090) — o contrato da rota legada depois do cutover.
 *
 * Este arquivo nasceu como contract test do comportamento ANTERIOR (6 casos do
 * `POST`, escritos antes de qualquer troca, conforme T5.3 exige). Com a
 * conversa migrada para o `accounts.`, ele passou a fixar a outra metade do
 * contrato: a leitura do acervo legado continua servindo, e a escrita está
 * fechada — **não** silenciosamente desviada.
 *
 * O que os casos do `POST` provavam (material publicado, corpo sanitizado,
 * vazio-após-sanitizar, sessão obrigatória) segue coberto, agora onde a escrita
 * de fato acontece: `communityComments.test.ts` (guard + fachada) e, do lado do
 * `accounts.`, os invariantes de §3.
 */

const dbMocks = vi.hoisted(() => ({ selectFrom: vi.fn(), insertInto: vi.fn() }));
vi.mock('../db', () => ({ db: dbMocks }));

vi.mock('../middleware/rateLimit', () => ({
  readRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

import commentsRoutes from './comments';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/comments', commentsRoutes);
  return server;
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.insertInto.mockReset();
});

describe('GET /api/v1/comments/:materialId — acervo legado continua legível', () => {
  it('devolve o que está gravado, com o corpo sanitizado', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    dbMocks.selectFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([
        {
          id: 'legado-1',
          material_id: 'material-1',
          user_id: 'user-1',
          body: 'Comentário antigo',
          removed_at: null,
          created_at: createdAt,
        },
      ]),
    });

    const response = await request(app()).get('/api/v1/comments/material-1').expect(200);

    expect(response.body[0]).toMatchObject({
      id: 'legado-1',
      material_id: 'material-1',
      user_id: 'user-1',
      body: 'Comentário antigo',
      removed_by_moderation: false,
    });
    expect(response.body[0].created_at).toBe(createdAt.toISOString());
  });

  it('preserva comentário removido sem vazar o corpo', async () => {
    dbMocks.selectFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([
        { id: 'removido', material_id: 'material-1', user_id: 'user-2', body: 'Corpo que não pode vazar', removed_at: new Date(), created_at: new Date() },
      ]),
    });

    const response = await request(app()).get('/api/v1/comments/material-1').expect(200);

    expect(response.body[0]).toMatchObject({ body: null, removed_by_moderation: true });
    expect(response.text).not.toContain('Corpo que não pode vazar');
  });
});

describe('POST /api/v1/comments — escrita fechada (T5.7)', () => {
  it('devolve 410 e aponta o substituto, sem tocar a tabela', async () => {
    const response = await request(app())
      .post('/api/v1/comments')
      .send({ material_id: 'material-1', body: 'Tentativa de escrita' })
      .expect(410);

    expect(response.body).toMatchObject({ error: 'comments_moved' });
    expect(response.body.detail).toContain('/api/v1/community/conversation');
    // A trava que importa: nenhuma linha nova entra em `download_comment`
    // depois do cutover, senão a conversa diverge entre duas origens e ninguém
    // reconcilia depois.
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('recusa antes de qualquer validação — não é 400 disfarçado', async () => {
    // Payload inválido devolve o MESMO 410: a rota não existe mais como
    // escrita, então validar o corpo daria a impressão de que um payload certo
    // funcionaria.
    await request(app()).post('/api/v1/comments').send({}).expect(410);
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });
});

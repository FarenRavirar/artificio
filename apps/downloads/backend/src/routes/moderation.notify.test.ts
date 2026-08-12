import request from 'supertest';
import express from 'express';

// DEB-074-04 (spec 074/075) — aprovacao/reprovacao devem emitir notificacao
// pro dono do material.
//
// T3.5 (spec 090) — o DESTINO da emissao mudou, e uma garantia foi
// deliberadamente invertida:
//
// 1. A gravacao nao vai mais direto em `download_notification`. Vai no outbox
//    local (`download_notification_outbox`, migration_038), entregue depois ao
//    par consolidado do `accounts.` (requisito 13a-i). `download_notification`
//    fica read-only ate o historico migrar (T3.16).
//
// 2. "Falha fechada" DEIXOU de ser o comportamento correto. O teste antigo
//    fixava 500 quando a notificacao falhava — a moderacao inteira revertia por
//    causa de um aviso. Medido em 2026-08-10 e nomeado em 13c-i (`spec.md:248`)
//    como defeito, nao como garantia: o moderador via a aprovacao nao concluida
//    e nao tinha como saber que o material estava intacto. Agora a acao de
//    merito commita e o aviso fica durável no outbox, entregue fora da
//    transacao. O caso oposto (aviso perdido em silencio) continua coberto: a
//    linha do outbox e transacional, entao ou a moderacao reverte por inteiro ou
//    o aviso existe.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
  insertInto: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    selectFrom: dbMocks.selectFrom,
    updateTable: dbMocks.updateTable,
    insertInto: dbMocks.insertInto,
    transaction: dbMocks.transaction,
  },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'moderator-1', role: 'moderator' };
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

// T3.5 — a entrega roda fora da transacao. Mockada rejeitando no teste abaixo
// para provar que falha dela nao alcanca a resposta da moderacao.
const deliveryMock = vi.hoisted(() => vi.fn().mockResolvedValue({ delivered: 0, failed: 0, skipped: 0 }));
vi.mock('../services/notificationOutboxDelivery', () => ({
  deliverPendingNotifications: deliveryMock,
  startNotificationOutboxSweep: vi.fn(),
}));

import moderationRoutes from './moderation';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/moderation', moderationRoutes);
  return server;
}

function makeMaterialQuery(material: unknown) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(material),
  };
}

describe('POST /api/v1/moderation/:id/approve — emite notificacao', () => {
  beforeEach(() => {
    dbMocks.selectFrom.mockReset();
    dbMocks.updateTable.mockReset();
    dbMocks.insertInto.mockReset();
    dbMocks.transaction.mockReset();
    dbMocks.transaction.mockReturnValue({
      execute: (callback: (trx: unknown) => unknown) => callback({
        updateTable: dbMocks.updateTable,
        insertInto: dbMocks.insertInto,
      }),
    });
  });

  it('enfileira no outbox apos aprovar, dentro da transacao', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', title: 'Meu material', editorial_state: 'in_review', slug: 'meu-material' };
    dbMocks.selectFrom
      .mockReturnValueOnce(makeMaterialQuery(material))
      .mockReturnValueOnce(makeMaterialQuery({ id: 'evidence-1' }));

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'published' }),
    };
    dbMocks.updateTable.mockReturnValue(updateChain);

    const insertChain = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    dbMocks.insertInto.mockReturnValue(insertChain);

    await request(app()).post('/api/v1/moderation/material-1/approve').expect(200);

    expect(dbMocks.insertInto).toHaveBeenCalledWith('download_notification_outbox');
    // `download_notification` nao recebe mais escrita nova (requisito 13a-i):
    // asserir a ausencia impede que um chamador volte a gravar ali sem que
    // ninguem perceba, deixando o aviso fora do registro consolidado.
    expect(dbMocks.insertInto).not.toHaveBeenCalledWith('download_notification');
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'downloads.material_approved',
        subject_id: 'material-1',
        recipients: JSON.stringify(['owner-1']),
      }),
    );
  });

  it('falha no enfileiramento reverte a aprovacao junto — a linha do outbox e transacional', async () => {
    const material = { id: 'material-1', creator_id: 'owner-1', title: 'Meu material', editorial_state: 'in_review', slug: 'meu-material' };
    dbMocks.selectFrom
      .mockReturnValueOnce(makeMaterialQuery(material))
      .mockReturnValueOnce(makeMaterialQuery({ id: 'evidence-1' }));
    dbMocks.updateTable.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'published' }),
    });
    dbMocks.insertInto.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockRejectedValue(new Error('notification insert failed')),
    });

    // Distincao que importa e nao e obvia: o outbox NAO torna o enfileiramento
    // best-effort. Ele continua dentro da transacao, entao um INSERT que falha
    // ainda reverte a aprovacao — e e disso que vem a garantia de que aviso
    // nunca se perde em silencio (a outra ponta do defeito de 13c-i).
    //
    // O que 13c-i remove e a dependencia da ENTREGA: antes, a moderacao so
    // commitava se `download_notification` aceitasse a linha final; agora
    // commita assim que a intencao esta durável, e a entrega ao `accounts.`
    // acontece fora, com retry proprio. Falha de rede, `accounts.` fora do ar ou
    // 500 na ingestao nao tocam mais a moderacao — o que este teste nao cobre
    // por nao haver rede nele, e `notificationOutboxDelivery` trata.
    await request(app()).post('/api/v1/moderation/material-1/approve').expect(500);
    expect(dbMocks.transaction).toHaveBeenCalledOnce();
  });

  it('entrega que falha nao derruba a aprovacao — e o ponto de 13c-i', async () => {
    // O caso que motivou T3.5. Antes, a notificacao e a moderacao dividiam a
    // mesma transacao: `accounts.` fora do ar significaria moderador incapaz de
    // aprovar. Agora a entrega e uma promise rejeitada fora da transacao, e a
    // aprovacao responde 200 com a linha do outbox durável esperando o sweep.
    deliveryMock.mockRejectedValueOnce(new Error('accounts indisponivel'));

    const material = { id: 'material-1', creator_id: 'owner-1', title: 'Meu material', editorial_state: 'in_review', slug: 'meu-material' };
    dbMocks.selectFrom
      .mockReturnValueOnce(makeMaterialQuery(material))
      .mockReturnValueOnce(makeMaterialQuery({ id: 'evidence-1' }));
    dbMocks.updateTable.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...material, editorial_state: 'published' }),
    });
    dbMocks.insertInto.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    });

    await request(app()).post('/api/v1/moderation/material-1/approve').expect(200);
  });
});

// T2.1 (spec 084) — busca antes de criar (idempotencia normal), e corrida
// perdida no ON CONFLICT (2 chamadas concorrentes na primeira execucao).

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, insertInto: dbMocks.insertInto },
}));

import { getOrCreateScraperCreatorId } from './scraperCreator';

function selectChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(result),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(result),
  };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.insertInto.mockReset();
});

describe('getOrCreateScraperCreatorId', () => {
  it('retorna id existente sem inserir quando ja existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ id: 'creator-existente' }));

    const id = await getOrCreateScraperCreatorId();

    expect(id).toBe('creator-existente');
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('cria com user_id=NULL e slug fixo quando nao existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain(undefined));

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: 'creator-novo' }),
    };
    dbMocks.insertInto.mockReturnValueOnce(insertChain);

    const id = await getOrCreateScraperCreatorId();

    expect(id).toBe('creator-novo');
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, slug: 'indexacao-automatica', role: 'admin' }),
    );
  });

  it('busca de novo quando perde a corrida no ON CONFLICT (2 chamadas simultaneas)', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectChain(undefined))
      .mockReturnValueOnce(selectChain({ id: 'creator-criado-por-outra-chamada' }));

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    };
    dbMocks.insertInto.mockReturnValueOnce(insertChain);

    const id = await getOrCreateScraperCreatorId();

    expect(id).toBe('creator-criado-por-outra-chamada');
  });
});

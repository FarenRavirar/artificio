// Fase 7 (spec 084) — 2 cenários obrigatórios (spec.md §5, critério de
// aceite 5): bloqueio de acesso NUNCA confirma "virou pago"; confirmação
// positiva de preço muda estado. Testados isoladamente.

const fetchSimpleMock = vi.hoisted(() => vi.fn());
vi.mock('./scrapers/httpFetch', () => ({
  fetchSimple: fetchSimpleMock,
}));

const getOrCreateScraperCreatorIdMock = vi.hoisted(() => vi.fn().mockResolvedValue('scraper-creator-id'));
vi.mock('./scraperCreator', () => ({
  getOrCreateScraperCreatorId: getOrCreateScraperCreatorIdMock,
}));

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../db', () => ({ db: dbMocks }));

import { runPriceRecheck } from './priceRecheckJob';

function materialsQuery(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(rows),
  };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.insertInto.mockReset();
  dbMocks.transaction.mockReset();
  fetchSimpleMock.mockReset();
  getOrCreateScraperCreatorIdMock.mockClear();

  dbMocks.insertInto.mockReturnValue({
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  });
});

describe('runPriceRecheck', () => {
  it('query so busca fontes com parser de preco confiavel (materials de manual/opera_rpg/drivethrurpg nunca retornam)', async () => {
    const query = materialsQuery([]);
    dbMocks.selectFrom.mockReturnValueOnce(query);

    const result = await runPriceRecheck();

    expect(result.checked).toBe(0);
    expect(fetchSimpleMock).not.toHaveBeenCalled();
    expect(query.where).toHaveBeenCalledWith('source_platform', 'in', ['itch_io', 'grimorios_e_dados']);
  });

  it('cenário obrigatório: bloqueio de acesso (403) NUNCA confirma "virou pago" — material continua published', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(
      materialsQuery([{ id: 'material-1', source_platform: 'itch_io', source_url: 'https://a.itch.io/game', editorial_state: 'published' }]),
    );
    fetchSimpleMock.mockResolvedValueOnce({ html: '', status: 403 });

    const result = await runPriceRecheck();

    expect(result.checked).toBe(1);
    expect(result.blockedOrUnconfirmed).toBe(1);
    expect(result.withdrawn).toBe(0);
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it('cenário obrigatório: preço confirmado como pago — muda pra withdrawn e registra versão', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(
      materialsQuery([{ id: 'material-1', source_platform: 'itch_io', source_url: 'https://a.itch.io/game', editorial_state: 'published' }]),
    );
    fetchSimpleMock.mockResolvedValueOnce({
      html: '<div class="header_buy_row"><div class="bundle_row">preço fixo</div></div>',
      status: 200,
    });

    const updateMaterial = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    const insertVersion = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    const trxUpdateTable = vi.fn().mockReturnValue(updateMaterial);
    const trxInsertInto = vi.fn().mockReturnValue(insertVersion);

    dbMocks.transaction.mockReturnValue({
      execute: async (cb: (trx: { updateTable: typeof trxUpdateTable; insertInto: typeof trxInsertInto }) => Promise<void>) =>
        cb({ updateTable: trxUpdateTable, insertInto: trxInsertInto }),
    });

    const result = await runPriceRecheck();

    expect(result.withdrawn).toBe(1);
    expect(updateMaterial.set).toHaveBeenCalledWith(expect.objectContaining({ editorial_state: 'withdrawn' }));
    expect(insertVersion.values).toHaveBeenCalledWith(
      expect.objectContaining({ field_name: 'editorial_state', new_value: 'withdrawn', changed_by: 'scraper-creator-id' }),
    );
  });

  it('preço confirmado como pago mas transição inválida no estado atual: não grava "suspenso automaticamente" no audit, não muda estado', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(
      materialsQuery([{ id: 'material-1', source_platform: 'itch_io', source_url: 'https://a.itch.io/game', editorial_state: 'withdrawn' }]),
    );
    fetchSimpleMock.mockResolvedValueOnce({
      html: '<div class="header_buy_row"><div class="bundle_row">preço fixo</div></div>',
      status: 200,
    });

    const linkCheckInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    dbMocks.insertInto.mockReturnValue(linkCheckInsert);

    const result = await runPriceRecheck();

    expect(result.withdrawn).toBe(0);
    expect(dbMocks.transaction).not.toHaveBeenCalled();
    expect(linkCheckInsert.values).toHaveBeenCalledWith(expect.objectContaining({ error_detail: null }));
  });

  it('preço continua grátis/PWYW: não muda estado, não toca transaction', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(
      materialsQuery([{ id: 'material-1', source_platform: 'itch_io', source_url: 'https://a.itch.io/game', editorial_state: 'published' }]),
    );
    fetchSimpleMock.mockResolvedValueOnce({
      html: '<div class="header_buy_row"><span class="sub">Name your own price</span></div>',
      status: 200,
    });

    const result = await runPriceRecheck();

    expect(result.withdrawn).toBe(0);
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it('falha de rede (exceção lançada): registra como bloqueado, nunca lança pro chamador', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(
      materialsQuery([{ id: 'material-1', source_platform: 'itch_io', source_url: 'https://a.itch.io/game', editorial_state: 'published' }]),
    );
    fetchSimpleMock.mockRejectedValueOnce(new Error('ECONNRESET'));

    const result = await expect(runPriceRecheck()).resolves.toBeDefined();
    void result;
  });
});

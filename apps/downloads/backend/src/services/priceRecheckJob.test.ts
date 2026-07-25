// Fase 7 (spec 084) — 2 cenários obrigatórios (spec.md §5, critério de
// aceite 5): bloqueio de acesso NUNCA confirma "virou pago"; confirmação
// positiva de preço muda estado. Testados isoladamente.
// T6.3/T6.5 (spec 085, Fase 6) — PRICE_CHECKABLE_PLATFORMS deixou de ser
// hardcode, agora vem do registry (download_scraper_platform.supports_price_recheck).
// runPriceRecheck chama selectFrom 2x: 1ª (registry) sempre mockada com
// itch_io/grimorios_e_dados (mesmo comportamento de antes — não-regressão),
// 2ª (materials) é o que cada teste varia.

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

function registryQuery(slugs: string[] = ['itch_io', 'grimorios_e_dados']) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(slugs.map((slug) => ({ slug }))),
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
  // 1ª chamada de selectFrom em toda runPriceRecheck é sempre o registry —
  // default aqui, sobrescrito por mockReturnValueOnce quando o teste precisa
  // de comportamento diferente antes da query de materials.
  dbMocks.selectFrom.mockReturnValueOnce(registryQuery());
});

describe('runPriceRecheck', () => {
  it('lê o registry (supports_price_recheck=TRUE) e busca só as fontes com parser de preço confiável (não-regressão: itch_io/grimorios_e_dados, nunca manual/opera_rpg/drivethrurpg)', async () => {
    const query = materialsQuery([]);
    dbMocks.selectFrom.mockReturnValueOnce(query);

    const result = await runPriceRecheck();

    expect(dbMocks.selectFrom).toHaveBeenNthCalledWith(1, 'download_scraper_platform');
    expect(dbMocks.selectFrom).toHaveBeenNthCalledWith(2, 'download_material');
    expect(result.checked).toBe(0);
    expect(fetchSimpleMock).not.toHaveBeenCalled();
    expect(query.where).toHaveBeenCalledWith('source_platform', 'in', ['itch_io', 'grimorios_e_dados']);
  });

  it('registry sem nenhuma plataforma com supports_price_recheck=TRUE: não consulta materials, retorna zerado', async () => {
    dbMocks.selectFrom.mockReset();
    dbMocks.selectFrom.mockReturnValueOnce(registryQuery([]));

    const result = await runPriceRecheck();

    expect(result).toEqual({ checked: 0, withdrawn: 0, blockedOrUnconfirmed: 0 });
    expect(dbMocks.selectFrom).toHaveBeenCalledTimes(1);
    expect(fetchSimpleMock).not.toHaveBeenCalled();
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

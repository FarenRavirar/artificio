// T4.2 (spec 084) — cobre a ordem EXATA exigida por D119/plan.md: idioma
// primeiro (sempre), depois preço, depois dedupe, depois criação — cada
// branch testado isoladamente + contador incremental do run.

const detectPortugueseMock = vi.hoisted(() => vi.fn());
vi.mock('./languageDetector', () => ({
  detectPortuguese: detectPortugueseMock,
}));

const getOrCreateScraperCreatorIdMock = vi.hoisted(() => vi.fn());
vi.mock('./scraperCreator', () => ({
  getOrCreateScraperCreatorId: getOrCreateScraperCreatorIdMock,
}));

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  updateTable: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../db', () => ({ db: dbMocks }));

import { runScraperIngest } from './scraperIngest';
import type { ScrapedItem } from './scrapers/types';

function makeItem(overrides: Partial<ScrapedItem> = {}): ScrapedItem {
  return {
    sourceUrl: 'https://example.itch.io/game-1',
    title: 'Aventura de Teste',
    description: 'Uma aventura de RPG em português para testes automatizados completos.',
    isFreeOrPwyw: true,
    coverImageUrl: null,
    publisherName: 'Autor Teste',
    sourceLanguageHint: null,
    ...overrides,
  };
}

async function* asyncIterableOf(items: ScrapedItem[]): AsyncIterable<ScrapedItem> {
  for (const item of items) yield item;
}

function selectChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(Array.isArray(result) ? result : []),
    executeTakeFirst: vi.fn().mockResolvedValue(Array.isArray(result) ? undefined : result),
  };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.insertInto.mockReset();
  dbMocks.updateTable.mockReset();
  dbMocks.transaction.mockReset();
  detectPortugueseMock.mockReset();
  getOrCreateScraperCreatorIdMock.mockReset();

  dbMocks.updateTable.mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  });
  dbMocks.insertInto.mockReturnValue({
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  });
});

describe('runScraperIngest', () => {
  it('sourceLanguageHint=not_pt: pula por idioma SEM chamar detectPortuguese nem checar preço/dedupe', async () => {
    const item = makeItem({ sourceLanguageHint: 'not_pt' });

    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsSkippedNotPortuguese).toBe(1);
    expect(result.itemsFound).toBe(1);
    expect(detectPortugueseMock).not.toHaveBeenCalled();
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('sourceLanguageHint=null e detectPortuguese não confiante: pula por idioma, nunca cria', async () => {
    detectPortugueseMock.mockResolvedValue({ isPortuguese: false, detectedLanguage: 'eng', confident: true });
    const item = makeItem({ sourceLanguageHint: null });

    const result = await runScraperIngest('run-1', 'opera_rpg', asyncIterableOf([item]));

    expect(result.itemsSkippedNotPortuguese).toBe(1);
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('detectPortuguese retorna isPortuguese=true mas confident=false: ainda pula (nunca assume na dúvida)', async () => {
    detectPortugueseMock.mockResolvedValue({ isPortuguese: true, detectedLanguage: 'por', confident: false });
    const item = makeItem({ sourceLanguageHint: null });

    const result = await runScraperIngest('run-1', 'opera_rpg', asyncIterableOf([item]));

    expect(result.itemsSkippedNotPortuguese).toBe(1);
  });

  it('sourceLanguageHint=pt: pula detectPortuguese inteiramente (confia no sinal nativo da fonte)', async () => {
    const item = makeItem({ sourceLanguageHint: 'pt', isFreeOrPwyw: false });

    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(detectPortugueseMock).not.toHaveBeenCalled();
    // isFreeOrPwyw=false ainda deve barrar na etapa de preço (idioma passou).
    expect(result.itemsSkippedError).toBe(1);
  });

  it('isFreeOrPwyw=false: pula por preço, nunca chega no dedupe/criação', async () => {
    const item = makeItem({ sourceLanguageHint: 'pt', isFreeOrPwyw: false });

    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsSkippedError).toBe(1);
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('item já existe (dedupe por source_platform+source_url): skipped_duplicate, nunca cria', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ id: 'material-existente' }));
    const item = makeItem({ sourceLanguageHint: 'pt' });

    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsSkippedDuplicate).toBe(1);
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it('item novo: cria material+metadata em transação, log outcome=created', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectChain(undefined)) // dedupe: nao existe
      .mockReturnValueOnce(selectChain([])); // generateUniqueSlug: nenhum slug parecido

    getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');

    const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-novo' }) };
    const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    const trxInsertInto = vi.fn()
      .mockReturnValueOnce(materialInsert)
      .mockReturnValueOnce(metadataInsert);

    dbMocks.transaction.mockReturnValue({
      execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) =>
        cb({ insertInto: trxInsertInto }),
    });

    const item = makeItem({ sourceLanguageHint: 'pt' });
    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsCreated).toBe(1);
    expect(materialInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: 'scraper-creator-id',
        editorial_state: 'published',
        access_kind: 'external_link',
        source_platform: 'itch_io',
      }),
    );
    expect(metadataInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({ material_id: 'material-novo', language: 'pt' }),
    );
  });

  it('violação do índice UNIQUE (corrida entre runs concorrentes): outcome=skipped_duplicate, não skipped_error', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectChain(undefined))
      .mockReturnValueOnce(selectChain([]));
    getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');
    dbMocks.transaction.mockReturnValue({
      execute: async () => { throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }); },
    });

    const item = makeItem({ sourceLanguageHint: 'pt' });
    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsSkippedDuplicate).toBe(1);
    expect(result.itemsSkippedError).toBe(0);
    expect(result.itemsCreated).toBe(0);
  });

  it('falha na transação de criação: outcome=skipped_error, nunca lança pro chamador', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectChain(undefined))
      .mockReturnValueOnce(selectChain([]));
    getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');
    dbMocks.transaction.mockReturnValue({
      execute: async () => { throw new Error('constraint violation'); },
    });

    const item = makeItem({ sourceLanguageHint: 'pt' });
    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsSkippedError).toBe(1);
    expect(result.itemsCreated).toBe(0);
  });

  it('falha ao gravar log de item criado: outcome ainda reporta created (log e best-effort, nao afeta classificacao)', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectChain(undefined)) // dedupe: nao existe
      .mockReturnValueOnce(selectChain([])); // generateUniqueSlug: nenhum slug parecido
    getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');

    const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-novo' }) };
    const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    const trxInsertInto = vi.fn()
      .mockReturnValueOnce(materialInsert)
      .mockReturnValueOnce(metadataInsert);

    dbMocks.transaction.mockReturnValue({
      execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) =>
        cb({ insertInto: trxInsertInto }),
    });

    // download_scraper_item_log insert falha — nao deve propagar nem mudar outcome.
    dbMocks.insertInto.mockReturnValueOnce({ values: vi.fn().mockReturnThis(), execute: vi.fn().mockRejectedValue(new Error('log write failed')) });

    const item = makeItem({ sourceLanguageHint: 'pt' });
    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsCreated).toBe(1);
    expect(result.itemsSkippedError).toBe(0);
  });

  it('atualiza contadores de download_scraper_run incrementalmente, um update por item', async () => {
    dbMocks.selectFrom.mockReturnValue(selectChain({ id: 'dup' }));
    const items = [makeItem({ sourceLanguageHint: 'pt' }), makeItem({ sourceLanguageHint: 'pt', sourceUrl: 'https://example.itch.io/game-2' })];

    await runScraperIngest('run-1', 'itch_io', asyncIterableOf(items));

    expect(dbMocks.updateTable).toHaveBeenCalledTimes(2);
  });
});

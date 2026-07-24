// T3.3 (spec 084) — mesma logica defensiva do driveThruRpgScraper.test.ts
// (mesma plataforma OneBookShelf, mesmo WAF).

const rateLimiterWaitMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../scraperRateLimiter', () => ({
  ScraperRateLimiter: vi.fn().mockImplementation(() => ({ wait: rateLimiterWaitMock })),
}));

const fetchSimpleMock = vi.hoisted(() => vi.fn());
vi.mock('./httpFetch', () => ({
  fetchSimple: fetchSimpleMock,
  looksBlocked: (result: { status: number }) => result.status === 403 || result.status === 429,
}));

const patchrightFetchMock = vi.hoisted(() => vi.fn());
vi.mock('../headlessEngine/patchrightClient', () => ({
  PatchrightEngine: vi.fn().mockImplementation(() => ({ fetchRendered: patchrightFetchMock })),
}));

const camoufoxFetchMock = vi.hoisted(() => vi.fn());
vi.mock('../headlessEngine/camoufoxClient', () => ({
  CamoufoxEngine: vi.fn().mockImplementation(() => ({ fetchRendered: camoufoxFetchMock })),
}));

import { DmsGuildScraper } from './dmsGuildScraper';

beforeEach(() => {
  fetchSimpleMock.mockReset();
  patchrightFetchMock.mockReset();
  camoufoxFetchMock.mockReset();
  rateLimiterWaitMock.mockClear();
});

describe('DmsGuildScraper', () => {
  it('todos os 3 modos bloqueiam — lança erro claro, sem criar item', async () => {
    fetchSimpleMock.mockResolvedValueOnce({ html: '', status: 403 });
    patchrightFetchMock.mockResolvedValueOnce({ html: '', status: 403 });
    camoufoxFetchMock.mockResolvedValueOnce({ html: '', status: 403 });

    const items = [];
    let thrown: Error | null = null;
    try {
      for await (const item of new DmsGuildScraper().discoverItems()) items.push(item);
    } catch (error) {
      thrown = error as Error;
    }

    expect(items).toHaveLength(0);
    expect(thrown?.message).toMatch(/bloqueou todos os modos/);
  });

  it('desbloqueado sem parser implementado: lança erro explícito', async () => {
    fetchSimpleMock.mockResolvedValueOnce({ html: '<html>nunca visto</html>', status: 200 });

    let thrown: Error | null = null;
    try {
      const iterator = new DmsGuildScraper().discoverItems()[Symbol.asyncIterator]();
      await iterator.next();
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toMatch(/nenhum parser de listagem foi implementado/);
  });
});

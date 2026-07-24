// T3.3 (spec 084) — cenário real confirmado nesta implementação: Modo 1
// (fetch) e Modo 2a (patchright) ambos retornam 403 com Cf-Mitigated:
// challenge contra DriveThruRPG (testado via fetch/patchright reais). Modo
// 2b (Camoufox) não foi testado ao vivo (custo alto), mas o adapter precisa
// tratar corretamente tanto "todos bloqueiam" quanto "desbloqueou sem
// parser pronto" — os 2 casos reais possíveis hoje.

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

import { DriveThruRpgScraper } from './driveThruRpgScraper';

async function collectOrThrow(adapter: DriveThruRpgScraper): Promise<{ items: unknown[]; error: Error | null }> {
  const items: unknown[] = [];
  try {
    for await (const item of adapter.discoverItems()) {
      items.push(item);
    }
    return { items, error: null };
  } catch (error) {
    return { items, error: error as Error };
  }
}

beforeEach(() => {
  fetchSimpleMock.mockReset();
  patchrightFetchMock.mockReset();
  camoufoxFetchMock.mockReset();
  rateLimiterWaitMock.mockClear();
});

describe('DriveThruRpgScraper', () => {
  it('cenário real confirmado: todos os 3 modos bloqueiam — lança erro claro, sem criar item', async () => {
    fetchSimpleMock.mockResolvedValueOnce({ html: '', status: 403 });
    patchrightFetchMock.mockResolvedValueOnce({ html: '', status: 403 });
    camoufoxFetchMock.mockResolvedValueOnce({ html: '', status: 403 });

    const { items, error } = await collectOrThrow(new DriveThruRpgScraper());

    expect(items).toHaveLength(0);
    expect(error?.message).toMatch(/bloqueou todos os modos/);
    expect(error?.message).toMatch(/fetch=403/);
  });

  it('Modo 1 desbloqueado sem parser implementado: lança erro explícito em vez de silenciosamente não criar nada', async () => {
    fetchSimpleMock.mockResolvedValueOnce({ html: '<html>conteúdo real nunca visto</html>', status: 200 });

    const { items, error } = await collectOrThrow(new DriveThruRpgScraper());

    expect(items).toHaveLength(0);
    expect(error?.message).toMatch(/nenhum parser de listagem foi implementado/);
    expect(patchrightFetchMock).not.toHaveBeenCalled();
  });

  it('Modo 2a desbloqueado sem parser implementado: lança erro explícito', async () => {
    fetchSimpleMock.mockResolvedValueOnce({ html: '', status: 403 });
    patchrightFetchMock.mockResolvedValueOnce({ html: '<html>renderizado</html>', status: 200 });

    const { items, error } = await collectOrThrow(new DriveThruRpgScraper());

    expect(items).toHaveLength(0);
    expect(error?.message).toMatch(/Modo 2a \(patchright\)/);
    expect(camoufoxFetchMock).not.toHaveBeenCalled();
  });
});

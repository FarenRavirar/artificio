// T3.2 (spec 084) — fixture e trecho MINIMO real (extraido via fetch direto
// de operarpg.com.br/downloads/aventuras durante a implementacao), formato
// confirmado: <a class="download-item" href="...pdf"><span><b>Titulo</b>
// <br/><small>por Autor · Descricao</small></span></a>.

const rateLimiterWaitMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../scraperRateLimiter', () => ({
  ScraperRateLimiter: vi.fn().mockImplementation(() => ({ wait: rateLimiterWaitMock })),
}));

const fetchSimpleMock = vi.hoisted(() => vi.fn());
vi.mock('./httpFetch', () => ({
  fetchSimple: fetchSimpleMock,
  looksBlocked: (result: { status: number }) => result.status === 403 || result.status === 429,
}));

import { OperaRpgScraper } from './operaRpgScraper';

const SECTION_HTML_FIXTURE = `
<a class="download-item" href="https://arquivos.operarpg.com.br/aventuras/AOAsesFlp.pdf" target="_blank" rel="noopener noreferrer"><span><b>Ases das Filipinas</b><br/><small>por Intruder · Após o ataque japonês contra Pearl Harbor.</small></span><span>Abrir ↗</span></a>
<a class="download-item" href="https://arquivos.operarpg.com.br/aventuras/ABariloche.pdf" target="_blank" rel="noopener noreferrer"><span><b>Inverno em Bariloche</b><br/><small>por Roj Ventura · Aventura de mistério e horror.</small></span><span>Abrir ↗</span></a>
`;

beforeEach(() => {
  fetchSimpleMock.mockReset();
  rateLimiterWaitMock.mockClear();
});

describe('OperaRpgScraper', () => {
  it('descobre itens de todas as seções, extraindo título/autor/descrição', async () => {
    fetchSimpleMock.mockResolvedValue({ html: SECTION_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new OperaRpgScraper().discoverItems()) {
      items.push(item);
    }

    // 6 seções * 2 itens fixos (mock retorna a mesma fixture pra todas) —
    // mas dedupe por sourceUrl garante que so 2 itens unicos sobrevivem.
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sourceUrl: 'https://arquivos.operarpg.com.br/aventuras/AOAsesFlp.pdf',
      title: 'Ases das Filipinas',
      publisherName: 'Intruder',
      description: 'Após o ataque japonês contra Pearl Harbor.',
      isFreeOrPwyw: true,
      sourceLanguageHint: null,
    });
  });

  it('pula seção bloqueada (403) sem interromper as demais', async () => {
    fetchSimpleMock
      .mockResolvedValueOnce({ html: '', status: 403 })
      .mockResolvedValue({ html: SECTION_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new OperaRpgScraper().discoverItems()) {
      items.push(item);
    }

    expect(items.length).toBeGreaterThan(0);
  });

  it('nao duplica item com mesma sourceUrl em seções diferentes', async () => {
    fetchSimpleMock.mockResolvedValue({ html: SECTION_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new OperaRpgScraper().discoverItems()) {
      items.push(item);
    }

    const urls = items.map((i) => i.sourceUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

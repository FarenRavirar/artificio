// T3.1 (spec 084) — fixtures sao trechos MINIMOS reais (extraidos via fetch
// direto de itch.io durante a implementacao, nao especulados) preservando os
// seletores exatos confirmados: card `class="title game_link"`, preco via
// `Name your own price`/`bundle_row`/`header_buy_row`, meta og:image/
// og:description com atributo `content` antes de `property`.

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

import { ItchIoScraper } from './itchIoScraper';

const LISTING_HTML_FIXTURE = `
<div dir="auto" class="game_cell has_cover lazy_images" data-game_id="4754247">
<a href="https://twistandscream.itch.io/exorcist-candy" data-action="game_grid" data-label="game:4754247:title" class="title game_link">Exorcist Candy</a>
</div>
<div dir="auto" class="game_cell has_cover lazy_images" data-game_id="583454">
<a href="https://futurecatgames.itch.io/oneshot" data-action="game_grid" data-label="game:583454:title" class="title game_link">Paid Game</a>
</div>
`;

const PWYW_GAME_HTML_FIXTURE = `
<meta content="https://img.itch.zone/aW1nLzI4MzU2NTI4LnBuZw==/original/JODl03.png" property="og:image"/>
<meta content="Exorcise your possessed daughter" property="og:description"/>
<div class="header_buy_row"><p>A downloadable game for Windows</p><div class="buy_row"><div class="button_message"><a class="button buy_btn" href="https://twistandscream.itch.io/exorcist-candy/purchase">Download Now</a><span class="buy_message"><span class="sub">Name your own price</span></span></div></div></div>
<a href="https://twistandscream.itch.io">Twist And Scream</a>
`;

const PAID_GAME_HTML_FIXTURE = `
<div class="header_buy_row"><p>A downloadable game</p><div class="bundle_row"><div class="bundle_info"><div class="bundle_label">Get this game and 1 more for $7.48 USD</div></div></div></div>
`;

beforeEach(() => {
  fetchSimpleMock.mockReset();
  patchrightFetchMock.mockReset();
  camoufoxFetchMock.mockReset();
  rateLimiterWaitMock.mockClear();
});

const LISTING_HTML_CLASS_BEFORE_HREF_FIXTURE = `
<a class="title game_link" href="https://grimorios-e-dados.itch.io/naraka-space" data-action="game_grid" data-label="game:4644972:title">Naraka Space</a>
`;

describe('ItchIoScraper', () => {
  it('descobre jogo quando class vem antes de href (storefront de dev, ordem de atributo diferente da listagem geral)', async () => {
    fetchSimpleMock
      .mockResolvedValueOnce({ html: LISTING_HTML_CLASS_BEFORE_HREF_FIXTURE, status: 200 })
      .mockResolvedValueOnce({ html: PWYW_GAME_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new ItchIoScraper().discoverItems()) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0].sourceUrl).toBe('https://grimorios-e-dados.itch.io/naraka-space');
    expect(items[0].title).toBe('Naraka Space');
  });

  it('descobre jogos PWYW/gratis via Modo 1 e pula jogos pagos', async () => {
    fetchSimpleMock
      .mockResolvedValueOnce({ html: LISTING_HTML_FIXTURE, status: 200 })
      .mockResolvedValueOnce({ html: PWYW_GAME_HTML_FIXTURE, status: 200 })
      .mockResolvedValueOnce({ html: PAID_GAME_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new ItchIoScraper().discoverItems()) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: 'https://twistandscream.itch.io/exorcist-candy',
      title: 'Exorcist Candy',
      isFreeOrPwyw: true,
      coverImageUrl: 'https://img.itch.zone/aW1nLzI4MzU2NTI4LnBuZw==/original/JODl03.png',
      description: 'Exorcise your possessed daughter',
      publisherName: 'Twist And Scream',
      sourceLanguageHint: 'pt',
    });
    expect(patchrightFetchMock).not.toHaveBeenCalled();
    expect(camoufoxFetchMock).not.toHaveBeenCalled();
  });

  it('escalona pra patchright quando Modo 1 da listagem e bloqueado (403)', async () => {
    fetchSimpleMock.mockResolvedValueOnce({ html: '', status: 403 });
    patchrightFetchMock.mockResolvedValueOnce({ html: LISTING_HTML_FIXTURE, status: 200 });
    fetchSimpleMock
      .mockResolvedValueOnce({ html: PWYW_GAME_HTML_FIXTURE, status: 200 })
      .mockResolvedValueOnce({ html: PAID_GAME_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new ItchIoScraper().discoverItems()) {
      items.push(item);
    }

    expect(patchrightFetchMock).toHaveBeenCalledTimes(1);
    expect(camoufoxFetchMock).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
  });

  it('escalona pra camoufox quando Modo 1 E patchright falham na listagem', async () => {
    fetchSimpleMock.mockResolvedValueOnce({ html: '', status: 403 });
    patchrightFetchMock.mockResolvedValueOnce({ html: '', status: 403 });
    camoufoxFetchMock.mockResolvedValueOnce({ html: LISTING_HTML_FIXTURE, status: 200 });
    fetchSimpleMock
      .mockResolvedValueOnce({ html: PWYW_GAME_HTML_FIXTURE, status: 200 })
      .mockResolvedValueOnce({ html: PAID_GAME_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new ItchIoScraper().discoverItems()) {
      items.push(item);
    }

    expect(camoufoxFetchMock).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(1);
  });

  it('pagina individual bloqueada: escalona pra patchright/camoufox antes de desistir (achado de review PR #193)', async () => {
    fetchSimpleMock
      .mockResolvedValueOnce({ html: LISTING_HTML_FIXTURE, status: 200 })
      .mockResolvedValueOnce({ html: '', status: 403 }) // pagina do 1o jogo, Modo 1 bloqueado
      .mockResolvedValueOnce({ html: PAID_GAME_HTML_FIXTURE, status: 200 }); // pagina do 2o jogo, Modo 1 ok
    patchrightFetchMock.mockResolvedValueOnce({ html: PWYW_GAME_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new ItchIoScraper().discoverItems()) {
      items.push(item);
    }

    expect(patchrightFetchMock).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(1);
    expect(items[0].sourceUrl).toBe('https://twistandscream.itch.io/exorcist-candy');
  });

  it('pagina individual bloqueada em todos os modos: pula o item, nunca lança pro chamador', async () => {
    fetchSimpleMock
      .mockResolvedValueOnce({ html: LISTING_HTML_FIXTURE, status: 200 })
      .mockResolvedValueOnce({ html: '', status: 403 })
      .mockResolvedValueOnce({ html: PAID_GAME_HTML_FIXTURE, status: 200 });
    patchrightFetchMock.mockResolvedValueOnce({ html: '', status: 403 });
    camoufoxFetchMock.mockResolvedValueOnce({ html: '', status: 403 });

    const items = [];
    for await (const item of new ItchIoScraper().discoverItems()) {
      items.push(item);
    }

    expect(items).toHaveLength(0);
    expect(camoufoxFetchMock).toHaveBeenCalledTimes(1);
  });
});

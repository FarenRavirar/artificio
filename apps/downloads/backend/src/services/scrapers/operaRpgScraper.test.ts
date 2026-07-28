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

import { OperaRpgScraper, resolveOperaMaterialTypeHint } from './operaRpgScraper';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURE_DIR = path.resolve(__dirname, '../../../test/fixtures/spec-089');
const SECTION_HTML_FIXTURE = fs.readFileSync(path.join(FIXTURE_DIR, 'opera-aventuras-section.html'), 'utf8');

beforeEach(() => {
  fetchSimpleMock.mockReset();
  rateLimiterWaitMock.mockClear();
});

describe('OperaRpgScraper', () => {
  it('decodifica entidade do DOM real antes de entregar o item', async () => {
    const html = fs.readFileSync(
      path.join(FIXTURE_DIR, 'opera-regras-section.html'),
      'utf8',
    );
    fetchSimpleMock.mockImplementation(async (url: string) => ({
      html: url.endsWith('/downloads/regras-e-fichas') ? html : '',
      status: 200,
    }));

    const items = [];
    for await (const item of new OperaRpgScraper().discoverItems()) items.push(item);

    expect(items[0]?.title).toBe('Raças D&D');
    expect(items[0]?.description).toContain('D&D para OPERA RPG');
    expect(items[0]?.sourceUrl).toContain('RRacasDD.pdf');
    expect(items[0]?.systemHint).toBe('OPERA RPG');
    expect(items[0]?.materialTypeHint).toBeNull();
  });

  it('descobre itens de todas as seções, extraindo título/autor/descrição', async () => {
    fetchSimpleMock.mockResolvedValue({ html: SECTION_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new OperaRpgScraper().discoverItems()) {
      items.push(item);
    }

    // Mesmo fixture real devolvido às seis rotas; dedupe prova que um URL não
    // vira seis materiais.
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: 'https://arquivos.operarpg.com.br/aventuras/AOAsesFlp.pdf',
      title: 'Ases das Filipinas',
      // Spec 088 (requisito 40) — "por Intruder" é AUTORIA. Antes ia pra
      // `publisherName`, afirmando que a pessoa era a editora do material.
      authorsCredits: 'Intruder',
      description: expect.stringContaining('Após o ataque japonês contra Pearl Harbor'),
      isFreeOrPwyw: true,
      sourceLanguageEvidence: null,
      systemHint: 'OPERA RPG',
      materialTypeHint: 'aventura',
      sourceCategory: 'aventuras',
    });
  });

  it('Gaia 400X fica sem sistema singular e mantém tipo da seção Cenários', async () => {
    const html = fs.readFileSync(
      path.join(FIXTURE_DIR, 'opera-cenarios-section.html'),
      'utf8',
    );
    fetchSimpleMock.mockImplementation(async (url: string) => ({
      html: url.endsWith('/downloads/cenarios') ? html : '',
      status: 200,
    }));

    const items = [];
    for await (const item of new OperaRpgScraper().discoverItems()) items.push(item);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Gaia 400X',
      systemHint: null,
      materialTypeHint: 'cenario',
      sourceCategory: 'cenarios',
    });
  });

  it.each([
    ['/downloads/aventuras', 'aventura'],
    ['/downloads/cenarios', 'cenario'],
    ['/downloads/personagens', null],
    ['/downloads/personagens-digitais', null],
    ['/downloads/regras-e-fichas', null],
    ['/downloads/outros', null],
  ])('classifica seção OPERA %s sem tipo global inventado', (section, expected) => {
    expect(resolveOperaMaterialTypeHint(section)).toBe(expected);
  });

  // Requisito 38/40 — a listagem não expõe editora em lugar nenhum, então
  // `publisherName` é `null` explícito. Reaproveitar o autor aqui era a
  // origem de 77 dos 103 `publisher_name` preenchidos no acervo de beta,
  // enquanto `credits` ficava zerado.
  it('nunca grava o autor como se fosse a editora', async () => {
    fetchSimpleMock.mockResolvedValue({ html: SECTION_HTML_FIXTURE, status: 200 });

    const items = [];
    for await (const item of new OperaRpgScraper().discoverItems()) {
      items.push(item);
    }

    expect(items.every((item) => item.publisherName === null)).toBe(true);
    expect(items.map((item) => item.authorsCredits)).toEqual(['Intruder']);
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

  it('reconhece item quando class vem antes de href e <br> sem barra de fechamento (achado de review PR #193)', async () => {
    const fixture = '<a class="download-item" href="https://arquivos.operarpg.com.br/aventuras/Teste.pdf" target="_blank"><span><b>Item Teste</b><br><small>por Autor Teste · Descrição de teste.</small></span></a>';
    fetchSimpleMock.mockResolvedValue({ html: fixture, status: 200 });

    const items = [];
    for await (const item of new OperaRpgScraper().discoverItems()) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: 'https://arquivos.operarpg.com.br/aventuras/Teste.pdf',
      title: 'Item Teste',
      authorsCredits: 'Autor Teste',
      publisherName: null,
    });
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

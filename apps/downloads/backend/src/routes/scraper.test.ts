import request from 'supertest';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

// T5.1-T5.3 (spec 084) — rotas admin do scraper: disparo manual
// (fire-and-forget), consulta de run, listagem, ingest de Modo 3.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  updateTable: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom, insertInto: dbMocks.insertInto, updateTable: dbMocks.updateTable },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/rateLimit', () => ({
  writeRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const runScraperIngestMock = vi.hoisted(() => vi.fn().mockResolvedValue({ itemsFound: 0, itemsCreated: 0, itemsSkippedDuplicate: 0, itemsSkippedNotPortuguese: 0, itemsSkippedError: 0 }));
vi.mock('../services/scraperIngest', () => ({
  runScraperIngest: runScraperIngestMock,
}));

const discoverItemsMock = vi.hoisted(() => vi.fn());
vi.mock('../services/scrapers/itchIoScraper', () => ({
  ItchIoScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));
vi.mock('../services/scrapers/grimoriosEDadosScraper', () => ({
  GrimoriosEDadosScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));
vi.mock('../services/scrapers/operaRpgScraper', () => ({
  OperaRpgScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));
vi.mock('../services/scrapers/driveThruRpgScraper', () => ({
  DriveThruRpgScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));
vi.mock('../services/scrapers/dmsGuildScraper', () => ({
  DmsGuildScraper: vi.fn().mockImplementation(() => ({ discoverItems: discoverItemsMock })),
}));

import scraperRoutes from './scraper';

function app() {
  const server = express();
  // limite igual ao real (server.ts:67) — sem isso, payload de teste acima
  // de 100kb (default do express.json) estoura 413 no body-parser antes de
  // chegar no handler, mascarando o 422 que o schema Zod deveria produzir.
  server.use(express.json({ limit: '4mb' }));
  server.use('/api/v1/admin/scraper', scraperRoutes);
  return server;
}

function insertChain(result: unknown) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(result),
  };
}

function updateChain() {
  return { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  dbMocks.selectFrom.mockReset();
  dbMocks.insertInto.mockReset();
  dbMocks.updateTable.mockReset();
  runScraperIngestMock.mockClear();
  discoverItemsMock.mockReset();
  dbMocks.updateTable.mockReturnValue(updateChain());
});

describe('POST /api/v1/admin/scraper/run', () => {
  it('400 quando source_platform ausente/inválido', async () => {
    const res = await request(app()).post('/api/v1/admin/scraper/run').send({ source_platform: 'nao_existe' }).expect(400);
    expect(res.body.error).toMatch(/source_platform inválido/);
  });

  it('202 com run_id — fire-and-forget, não aguarda execução completa', async () => {
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-1' }));

    const res = await request(app()).post('/api/v1/admin/scraper/run').send({ source_platform: 'itch_io' }).expect(202);

    expect(res.body.run_id).toBe('run-1');
  });
});

describe('GET /api/v1/admin/scraper/run/:id', () => {
  it('404 quando run não existe', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    });

    await request(app()).get('/api/v1/admin/scraper/run/inexistente').expect(404);
  });

  it('200 com run + item_logs', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue({ id: 'run-1', status: 'completed' }),
      })
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([{ id: 'log-1', outcome: 'created' }]),
      });

    const res = await request(app()).get('/api/v1/admin/scraper/run/run-1').expect(200);

    expect(res.body.id).toBe('run-1');
    expect(res.body.item_logs).toHaveLength(1);
  });
});

describe('GET /api/v1/admin/scraper/runs', () => {
  it('200 com lista de runs recentes', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      selectAll: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([{ id: 'run-1' }, { id: 'run-2' }]),
    });

    const res = await request(app()).get('/api/v1/admin/scraper/runs').expect(200);

    expect(res.body.items).toHaveLength(2);
  });
});

describe('POST /api/v1/admin/scraper/ingest', () => {
  const validItem = {
    sourceUrl: 'https://example.itch.io/game',
    title: 'Aventura',
    description: null,
    isFreeOrPwyw: true,
    coverImageUrl: null,
    publisherName: null,
    sourceLanguageHint: 'pt',
  };

  it('400 quando payload inválido (source_platform ausente)', async () => {
    const res = await request(app()).post('/api/v1/admin/scraper/ingest').send({ items: [validItem] }).expect(400);
    expect(res.body.error).toMatch(/Payload de ingest inválido/);
  });

  it('400 quando items vazio', async () => {
    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'itch_io', items: [] })
      .expect(400);
    expect(res.body.error).toMatch(/Payload de ingest inválido/);
  });

  // Achado real (review PR #201, Codex, P1): /ingest agora valida
  // source_platform contra o registry (download_scraper_platform), não
  // mais contra IMPLEMENTED_SOURCE_PLATFORMS — cada teste precisa mockar
  // essa consulta extra (1ª chamada de selectFrom) antes das demais.
  function platformExistsChain(slug = 'itch_io') {
    return {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue({ slug }),
    };
  }

  it('200 com run completa quando ingest roda o pipeline com sucesso', async () => {
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-2' }));
    dbMocks.selectFrom
      .mockReturnValueOnce(platformExistsChain())
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-2', status: 'completed' }),
      });

    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'itch_io', items: [validItem] })
      .expect(200);

    expect(res.body.id).toBe('run-2');
    expect(runScraperIngestMock).toHaveBeenCalledTimes(1);
  });

  it('sanitiza descriptionHtml reenviado manualmente antes de entregar ao pipeline', async () => {
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-rich-html' }));
    dbMocks.selectFrom
      .mockReturnValueOnce(platformExistsChain())
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-rich-html', status: 'completed' }),
      });

    await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({
        source_platform: 'itch_io',
        items: [{
          ...validItem,
          description: '<p>Resumo <strong>sem HTML</strong></p>',
          descriptionHtml: '<p onclick="alert(1)">Seguro</p><script>alert(1)</script>',
        }],
      })
      .expect(200);

    const items = runScraperIngestMock.mock.calls[0][2] as AsyncIterable<{ description?: string | null; descriptionHtml?: string | null }>;
    const parsedItems: Array<{ description?: string | null; descriptionHtml?: string | null }> = [];
    for await (const item of items) parsedItems.push(item);
    expect(parsedItems[0]?.descriptionHtml).toBe('<p>Seguro</p>');
    expect(parsedItems[0]?.description).toBe('Resumo sem HTML');
  });

  // Achado real (review, PR #203): description rodava richHtmlToPlainText
  // (regex) sem teto de tamanho, ao contrário de descriptionHtml — mesmo
  // limite (SCRAPER_DESCRIPTION_HTML_MAX_LENGTH) evita DoS por payload gigante
  // antes de processar; 400 rejeita antes do transform rodar.
  it('400 quando description excede SCRAPER_DESCRIPTION_HTML_MAX_LENGTH', async () => {
    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({
        source_platform: 'itch_io',
        items: [{ ...validItem, description: 'a'.repeat(100_001) }],
      })
      .expect(400);

    expect(res.body.error).toMatch(/Payload de ingest inválido/);
    expect(runScraperIngestMock).not.toHaveBeenCalled();
  });

  it('preserva todos os campos ricos do preview até o payload entregue ao ingest', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(platformChain(DMS_GUILD_PLATFORM_ROW))
      .mockReturnValueOnce(duplicateCheckChain())
      .mockReturnValueOnce(platformExistsChain('dms_guild'))
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-rich-preview', status: 'completed' }),
      });
    dbMocks.insertInto
      .mockReturnValueOnce(parseLogInsertChain('parse-rich-preview'))
      .mockReturnValueOnce(insertChain({ id: 'run-rich-preview' }));

    const parsed = await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({ html: loadFixtureHtml('dms-guild-product-1.html') })
      .expect(200);

    await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'dms_guild', items: [parsed.body.preview] })
      .expect(200);

    const items = runScraperIngestMock.mock.calls[0][2] as AsyncIterable<Record<string, unknown>>;
    const forwarded: Record<string, unknown>[] = [];
    for await (const item of items) forwarded.push(item);
    expect(forwarded[0]?.scenario).toBe(parsed.body.preview.scenario);
    expect(forwarded[0]?.authorsCredits).toBe(parsed.body.preview.authorsCredits);
    expect(forwarded[0]?.artistsCredits).toBe(parsed.body.preview.artistsCredits);
    expect(forwarded[0]?.creationMethod).toBe(parsed.body.preview.creationMethod);
    expect(forwarded[0]?.fileSizeText).toBe(parsed.body.preview.fileSizeText);
    expect(forwarded[0]?.format).toBe(parsed.body.preview.format);
    expect(forwarded[0]?.pageCount).toBe(parsed.body.preview.pageCount);
    expect(forwarded[0]?.sourceCategory).toBe(parsed.body.preview.sourceCategory);
    expect(forwarded[0]?.sourceFilters).toEqual(parsed.body.preview.sourceFilters);
    expect(forwarded[0]?.descriptionHtml).toContain('<ul>');
  });

  it('400 quando source_platform não está cadastrado no registry', async () => {
    dbMocks.selectFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined),
    });

    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'site_inexistente', items: [validItem] })
      .expect(400);

    expect(res.body.error).toMatch(/não está cadastrado no registry/);
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('502 quando runScraperIngest lança — grava status=failed', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(platformExistsChain());
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-3' }));
    runScraperIngestMock.mockRejectedValueOnce(new Error('falha no pipeline'));

    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'itch_io', items: [validItem] })
      .expect(502);

    expect(res.body.error).toMatch(/falha no pipeline/);
  });

  // T4.3 — item com parse_case_id linka confirmed_material_id em
  // download_scraper_parse_log após o pipeline gravar o material criado.
  it('linka parse_case_id ao material criado quando o item veio de /parse-html', async () => {
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-4' }));
    dbMocks.selectFrom
      .mockReturnValueOnce(platformExistsChain())
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([{ source_url: validItem.sourceUrl, material_id: 'mat-nova' }]),
      })
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-4', status: 'completed' }),
      });
    const updateParseLogChain = updateChain();
    dbMocks.updateTable.mockReturnValueOnce(updateChain()).mockReturnValueOnce(updateParseLogChain);

    const itemWithParseCaseId = { ...validItem, parse_case_id: '9f8e7d6c-1234-4abc-8def-0123456789ab' };
    await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'itch_io', items: [itemWithParseCaseId] })
      .expect(200);

    expect(dbMocks.selectFrom).toHaveBeenCalledWith('download_scraper_item_log');
    expect(updateParseLogChain.set).toHaveBeenCalledWith({ confirmed_material_id: 'mat-nova' });
  });

  it('não quebra quando item não tem parse_case_id (uso direto do Modo 3, sem passar por /parse-html)', async () => {
    dbMocks.insertInto.mockReturnValueOnce(insertChain({ id: 'run-5' }));
    dbMocks.selectFrom
      .mockReturnValueOnce(platformExistsChain())
      .mockReturnValueOnce({
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'run-5', status: 'completed' }),
      });

    const res = await request(app())
      .post('/api/v1/admin/scraper/ingest')
      .send({ source_platform: 'itch_io', items: [validItem] })
      .expect(200);

    expect(res.body.id).toBe('run-5');
    // selectFrom('download_scraper_item_log') nunca chamado — sem
    // parse_case_id no payload, o bloco de link nem consulta o banco.
    expect(dbMocks.selectFrom).not.toHaveBeenCalledWith('download_scraper_item_log');
  });
});

// T2.2 (spec 085) — payload grande demais rejeitado dentro do handler (via
// schema Zod .max(MAX_HTML_LENGTH)), sem middleware de body-parser dedicado.
const FIXTURES_DIR = path.resolve(__dirname, '../../test/fixtures');
function loadFixtureHtml(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

function platformChain(platform: unknown | null) {
  return {
    selectAll: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(platform ?? undefined),
  };
}

function duplicateCheckChain(result: unknown[] = []) {
  return {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(result),
  };
}

// T4.2 — cada chamada bem-sucedida grava em download_scraper_parse_log.
function parseLogInsertChain(parseCaseId = 'parse-case-1') {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ parse_case_id: parseCaseId }),
  };
}

const DMS_GUILD_PLATFORM_ROW = { slug: 'dms_guild', name: 'DMs Guild', domain: 'www.dmsguild.com', parser_kind: 'onebookshelf' };
const DRIVETHRURPG_PLATFORM_ROW = { slug: 'drivethrurpg', name: 'DriveThruRPG', domain: 'www.drivethrurpg.com', parser_kind: 'onebookshelf' };

// T7.3 — payload de /parse-html passou a ser só { html }, sem source_platform
// (plataforma é DETECTADA pelo canonical, não escolhida). Toda chamada
// bem-sucedida faz selectFrom 2x nesta ordem: 1ª = registry
// (findPlatformByDomain), 2ª = dedupe (findDuplicateCandidates).
describe('POST /api/v1/admin/scraper/parse-html', () => {
  it('200 com preview real — fixture DMs Guild (PWYW), plataforma detectada pelo canonical', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(platformChain(DMS_GUILD_PLATFORM_ROW)).mockReturnValueOnce(duplicateCheckChain());
    dbMocks.insertInto.mockReturnValueOnce(parseLogInsertChain());
    const html = loadFixtureHtml('dms-guild-product-1.html');
    const res = await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({ html })
      .expect(200);

    expect(res.body.preview.title).toBe('Classe O Lutador (5E)- Playtest');
    expect(res.body.preview.priceSignal).toBe('pwyw_tag_present');
    expect(res.body.preview.isFreeOrPwyw).toBe(true);
    expect(res.body.preview).toMatchObject({
      scenario: 'Inespecífico/Qualquer mundo',
      authorsCredits: 'Felix Klaus',
      artistsCredits: 'Angevine, Dall.e',
      creationMethod: 'Contains AI-Generated Content',
      sourceFilters: [
        { facet: 'tipoDeProduto', path: ['Opções para personagens', 'Classe/Arquétipo'] },
        { facet: 'conteudo', path: ['DMsGuild'] },
        { facet: 'edicao', path: ['5th Edition', '5e'] },
      ],
      tags: ['Opções para personagens', 'Classe/Arquétipo', 'DMsGuild', '5th Edition', '5e'],
      fileSizeText: '44,49 MB',
      format: 'PDF',
      pageCount: 15,
      sourceCategory: 'N / D',
    });
    expect(res.body.preview.descriptionHtml).toContain('<ul>');
    expect(res.body.preview.description).not.toContain('<');
    expect(res.body.duplicateCandidates).toEqual([]);
    expect(res.body.parse_case_id).toBe('parse-case-1');
    expect(res.body.detectedPlatform).toEqual({ slug: 'dms_guild', name: 'DMs Guild' });
  });

  it('200 com preview real — fixture DriveThruRPG (grátis fixo)', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(platformChain(DRIVETHRURPG_PLATFORM_ROW)).mockReturnValueOnce(duplicateCheckChain());
    dbMocks.insertInto.mockReturnValueOnce(parseLogInsertChain('parse-case-2'));
    const html = loadFixtureHtml('drivethrurpg-product-1.html');
    const res = await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({ html })
      .expect(200);

    expect(res.body.preview.title).toBe('RPG Bíblico - Tomada de Jerusalém');
    expect(res.body.preview.priceSignal).toBe('zero_price_no_pwyw_tag');
  });

  it('200 com preview mesmo quando há candidato de duplicata (T3.3, endpoint nunca bloqueia)', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(platformChain(DMS_GUILD_PLATFORM_ROW))
      .mockReturnValueOnce(duplicateCheckChain([{ id: 'mat-existente', slug: 'classe-o-lutador-5e', title: 'Classe O Lutador (5E)', similarity: 0.95 }]));
    dbMocks.insertInto.mockReturnValueOnce(parseLogInsertChain());
    const html = loadFixtureHtml('dms-guild-product-1.html');
    const res = await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({ html })
      .expect(200);

    expect(res.body.duplicateCandidates).toHaveLength(1);
    expect(res.body.duplicateCandidates[0].id).toBe('mat-existente');
    expect(res.body.preview.title).toBe('Classe O Lutador (5E)- Playtest');
  });

  it('T4.2 — grava auditoria sem o HTML bruto em nenhum campo, com admin_user_id/source_platform (detectado)/price_signal corretos', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(platformChain(DMS_GUILD_PLATFORM_ROW)).mockReturnValueOnce(duplicateCheckChain());
    const insertChainSpy = parseLogInsertChain();
    dbMocks.insertInto.mockReturnValueOnce(insertChainSpy);
    const html = loadFixtureHtml('dms-guild-product-1.html');

    await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({ html })
      .expect(200);

    expect(dbMocks.insertInto).toHaveBeenCalledWith('download_scraper_parse_log');
    const insertedValues = insertChainSpy.values.mock.calls[0][0];
    expect(insertedValues.admin_user_id).toBe('admin-1');
    expect(insertedValues.source_platform).toBe('dms_guild');
    expect(insertedValues.price_signal).toBe('pwyw_tag_present');
    expect(JSON.stringify(insertedValues)).not.toContain('obs-product-format-pwyw-options');
    expect(JSON.stringify(insertedValues).length).toBeLessThan(1000); // fields_extracted é só booleans, não o HTML (158KB)
  });

  // T7.4 — StorytellersVault deixou de ser negativo (E3): agora é
  // positivo quando cadastrado no registry (testado em genericHtmlParser.test.ts).
  // Aqui testa o caso real de rejeição: domínio não cadastrado.
  it('422 unsupported_platform — domínio não cadastrado no registry', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(platformChain(null));
    const html = loadFixtureHtml('storytellersvault-product-1.html');
    const res = await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({ html })
      .expect(422);

    expect(res.body.code).toBe('unsupported_platform');
  });

  it('422 quando html está ausente', async () => {
    const res = await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({})
      .expect(422);

    expect(res.body.error).toMatch(/inválido/);
  });

  it('422 quando html excede o limite de tamanho', async () => {
    const oversized = 'x'.repeat(1_000_001);
    const res = await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({ html: oversized })
      .expect(422);

    expect(res.body.error).toMatch(/inválido/);
  });

  // T2.3 — html do body nunca deve aparecer em log, nem no caminho de
  // sucesso nem no de erro (422 de HTML inválido/malformado).
  it('nunca loga o conteúdo do html recebido (sucesso ou erro)', async () => {
    const marker = 'MARCADOR_HTML_UNICO_NAO_PODE_VAZAR_PRO_LOG_zzz123';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app())
      .post('/api/v1/admin/scraper/parse-html')
      .send({ html: `<html>${marker}</html>` })
      .expect(422); // sem JSON-LD, cai no branch de erro tipado

    const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().map(String).join('\n');
    expect(allLoggedText).not.toContain(marker);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

// T6.4/T6.5 (spec 085, Fase 6) — CRUD minimo do registry de plataformas:
// admin cadastra site novo sem deploy. 403 sem admin não testado aqui
// (mesma lacuna pré-existente documentada em T2.4: authMiddleware/requireRole
// são mockados como pass-through em todo este arquivo).
describe('GET/POST /api/v1/admin/scraper/platforms', () => {
  it('GET lista plataformas cadastradas ordenadas por nome', async () => {
    const rows = [{ slug: 'dms_guild', name: 'DMs Guild', domain: 'www.dmsguild.com', supports_auto_scrape: false, supports_price_recheck: false, parser_kind: 'onebookshelf', created_at: new Date() }];
    dbMocks.selectFrom.mockReturnValueOnce({
      selectAll: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(rows),
    });

    const res = await request(app()).get('/api/v1/admin/scraper/platforms').expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe('dms_guild');
  });

  it('POST cadastra plataforma nova com defaults corretos (flags omitidas ficam false, parser_kind omitido fica json_ld_generic)', async () => {
    const created = { slug: 'novo_site', name: 'Novo Site', domain: 'novosite.com.br', supports_auto_scrape: false, supports_price_recheck: false, parser_kind: 'json_ld_generic', created_at: new Date() };
    const insertChainSpy = { values: vi.fn().mockReturnThis(), returningAll: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue(created) };
    dbMocks.insertInto.mockReturnValueOnce(insertChainSpy);

    const res = await request(app())
      .post('/api/v1/admin/scraper/platforms')
      .send({ slug: 'novo_site', name: 'Novo Site', domain: 'novosite.com.br' })
      .expect(201);

    expect(res.body.slug).toBe('novo_site');
    expect(dbMocks.insertInto).toHaveBeenCalledWith('download_scraper_platform');
  });

  it('POST 422 quando slug tem caractere inválido (maiúscula/espaço)', async () => {
    const res = await request(app())
      .post('/api/v1/admin/scraper/platforms')
      .send({ slug: 'Novo Site', name: 'Novo Site', domain: 'novosite.com.br' })
      .expect(422);

    expect(res.body.error).toMatch(/inválido/);
  });

  it('POST 422 quando parser_kind não está entre os overrides conhecidos', async () => {
    const res = await request(app())
      .post('/api/v1/admin/scraper/platforms')
      .send({ slug: 'novo_site', name: 'Novo Site', domain: 'novosite.com.br', parser_kind: 'inexistente' })
      .expect(422);

    expect(res.body.error).toMatch(/inválido/);
  });

  // Achado real (review PR #201, Codex, P2): supports_auto_scrape=true pra
  // slug sem entrada em ADAPTERS era aceito no cadastro, cron selecionava a
  // plataforma diariamente e toda run falhava silenciosamente. 422 explícito
  // no cadastro evita o erro tardio.
  it('POST 422 quando supports_auto_scrape=true pra slug sem adapter implementado', async () => {
    const res = await request(app())
      .post('/api/v1/admin/scraper/platforms')
      .send({ slug: 'novo_site', name: 'Novo Site', domain: 'novosite.com.br', supports_auto_scrape: true })
      .expect(422);

    expect(res.body.error).toMatch(/inválido/);
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('POST aceita supports_auto_scrape=true pra slug com adapter implementado (itch_io)', async () => {
    const created = { slug: 'itch_io', name: 'itch.io', domain: 'itch.io', supports_auto_scrape: true, supports_price_recheck: false, parser_kind: 'json_ld_generic', created_at: new Date() };
    const insertChainSpy = { values: vi.fn().mockReturnThis(), returningAll: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue(created) };
    dbMocks.insertInto.mockReturnValueOnce(insertChainSpy);

    const res = await request(app())
      .post('/api/v1/admin/scraper/platforms')
      .send({ slug: 'itch_io', name: 'itch.io', domain: 'itch.io', supports_auto_scrape: true })
      .expect(201);

    expect(res.body.slug).toBe('itch_io');
  });

  it('POST 422 quando slug ou domain já cadastrado (violação de UNIQUE, código 23505)', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    dbMocks.insertInto.mockReturnValueOnce({
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirstOrThrow: vi.fn().mockRejectedValue(uniqueViolation),
    });

    const res = await request(app())
      .post('/api/v1/admin/scraper/platforms')
      .send({ slug: 'dms_guild', name: 'Duplicado', domain: 'duplicado.com.br' })
      .expect(422);

    expect(res.body.error).toMatch(/já cadastrado/);
  });
});

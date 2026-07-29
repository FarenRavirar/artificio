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

// T4.5 (spec 086) — loadCatalogSystemsFlat faz chamada de rede real
// (catalogFetch); mockado pra runScraperIngest nunca depender de rede em
// teste unitário. Default: catálogo vazio (nenhum item existente casa por
// exato) — casos específicos de match sobrescrevem com mockResolvedValueOnce.
// resolveTaxonomyIds é lógica pura (sem I/O) — usa a implementação real via
// importOriginal em vez de mockar, evita duplicar a regra no teste.
const loadCatalogSystemsFlatMock = vi.hoisted(() => vi.fn());
const getCatalogMaterialTypeBySlugMock = vi.hoisted(() => vi.fn());
vi.mock('./catalogClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./catalogClient')>();
  return {
    resolveTaxonomyIds: actual.resolveTaxonomyIds,
    loadCatalogSystemsFlat: loadCatalogSystemsFlatMock,
    getCatalogMaterialTypeBySlug: getCatalogMaterialTypeBySlugMock,
  };
});

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
  updateTable: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../db', () => ({ db: dbMocks }));

import { runScraperIngest } from './scraperIngest';
import type { ScrapedItem } from './scrapers/types';
import { normalizeScrapedItemPlainText } from './scrapers/plainTextPolicy';

function makeItem(overrides: Partial<ScrapedItem> = {}): ScrapedItem {
  return {
    sourceUrl: 'https://example.itch.io/game-1',
    title: 'Aventura de Teste',
    description: 'Uma aventura de RPG em português para testes automatizados completos.',
    isFreeOrPwyw: true,
    coverImageUrl: null,
    publisherName: 'Autor Teste',
    sourceLanguageEvidence: null,
    systemHint: null,
    materialTypeHint: null,
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
  detectPortugueseMock.mockResolvedValue({
    isPortuguese: true,
    detectedLanguage: 'por',
    confident: true,
    method: 'franc',
    reason: 'franc_confident',
  });
  getOrCreateScraperCreatorIdMock.mockReset();
  loadCatalogSystemsFlatMock.mockReset();
  loadCatalogSystemsFlatMock.mockResolvedValue([]);
  getCatalogMaterialTypeBySlugMock.mockReset();
  // Spec 088 (T2.9d) — o mock responde CONFORME o slug pedido. Devolver
  // sempre o mesmo tipo mascararia a resolução por item: o teste passaria
  // mesmo se o ingest voltasse a resolver uma vez por execução e aplicar a
  // todos. Aqui, o tipo neutro e um tipo real são objetos distintos.
  getCatalogMaterialTypeBySlugMock.mockImplementation(async (slug: string) => {
    const catalog: Record<string, { id: string; slug: string; name: string; aliases: string[]; status: string }> = {
      'nao-classificado': {
        id: 'b071ab5e-2d16-4c58-8f0e-086000000007',
        slug: 'nao-classificado',
        name: 'Não classificado',
        aliases: ['outros'],
        status: 'active',
      },
      aventura: {
        id: 'b071ab5e-2d16-4c58-8f0e-086000000001',
        slug: 'aventura',
        name: 'Aventura',
        aliases: ['adventure'],
        status: 'active',
      },
      regras: {
        id: 'b071ab5e-2d16-4c58-8f0e-086000000006',
        slug: 'regras',
        name: 'Regras',
        aliases: ['core rulebooks'],
        status: 'active',
      },
    };
    return catalog[slug.toLocaleLowerCase('pt-BR')] ?? null;
  });

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
  it('sourceLanguageEvidence=not_pt: pula por idioma SEM chamar detectPortuguese nem checar preço/dedupe', async () => {
    const item = makeItem({ sourceLanguageEvidence: 'not_pt' });

    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsSkippedNotPortuguese).toBe(1);
    expect(result.itemsFound).toBe(1);
    expect(detectPortugueseMock).not.toHaveBeenCalled();
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('sourceLanguageEvidence=null e detecção confiante não-portuguesa: pula por idioma, nunca cria', async () => {
    detectPortugueseMock.mockResolvedValue({
      isPortuguese: false,
      detectedLanguage: 'eng',
      confident: true,
      method: 'franc',
      reason: 'franc_confident',
    });
    const item = makeItem({ sourceLanguageEvidence: null });

    const result = await runScraperIngest('run-1', 'opera_rpg', asyncIterableOf([item]));

    expect(result.itemsSkippedNotPortuguese).toBe(1);
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('detectPortuguese retorna isPortuguese=true mas confident=false: ainda pula (nunca assume na dúvida)', async () => {
    detectPortugueseMock.mockResolvedValue({
      isPortuguese: true,
      detectedLanguage: 'por',
      confident: false,
      method: 'indeterminate',
      reason: 'deepseek_missing_api_key_after:franc_low_margin',
    });
    const item = makeItem({ sourceLanguageEvidence: null });

    const result = await runScraperIngest('run-1', 'opera_rpg', asyncIterableOf([item]));

    expect(result.itemsSkippedNotPortuguese).toBe(1);
  });

  it('sourceLanguageEvidence=pt ainda executa detector e rejeita página inglesa', async () => {
    detectPortugueseMock.mockResolvedValue({
      isPortuguese: false,
      detectedLanguage: 'eng',
      confident: true,
      method: 'franc',
      reason: 'franc_confident',
    });
    const item = makeItem({ sourceLanguageEvidence: 'pt', isFreeOrPwyw: false });

    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(detectPortugueseMock).toHaveBeenCalledOnce();
    expect(result.itemsSkippedNotPortuguese).toBe(1);
    expect(result.itemsSkippedError).toBe(0);
  });

  it('log de idioma registra método, motivo e evidência da fonte', async () => {
    detectPortugueseMock.mockResolvedValue({
      isPortuguese: false,
      detectedLanguage: 'eng',
      confident: true,
      method: 'franc',
      reason: 'franc_confident',
    });
    const logValues = vi.fn().mockReturnThis();
    dbMocks.insertInto.mockReturnValue({
      values: logValues,
      execute: vi.fn().mockResolvedValue(undefined),
    });

    await runScraperIngest(
      'run-language-audit',
      'itch_io',
      asyncIterableOf([makeItem({ sourceLanguageEvidence: 'pt' })]),
    );

    expect(dbMocks.insertInto).toHaveBeenCalledWith('download_scraper_item_log');
    expect(logValues).toHaveBeenCalledWith(expect.objectContaining({
      detected_language: 'eng',
      outcome: 'skipped_not_portuguese',
      error_detail: expect.stringContaining('"language_method":"franc"'),
    }));
    expect(logValues).toHaveBeenCalledWith(expect.objectContaining({
      error_detail: expect.stringContaining('"language_reason":"franc_confident"'),
    }));
    expect(logValues).toHaveBeenCalledWith(expect.objectContaining({
      error_detail: expect.stringContaining('"source_evidence":"pt"'),
    }));
    expect(logValues).toHaveBeenCalledWith(expect.objectContaining({
      error_detail: expect.stringContaining('"language_confident":true'),
    }));
  });

  it('isFreeOrPwyw=false: pula por preço, nunca chega no dedupe/criação', async () => {
    const item = makeItem({ sourceLanguageEvidence: 'pt', isFreeOrPwyw: false });

    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsSkippedError).toBe(1);
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  it('item já existe (dedupe por source_platform+source_url): skipped_duplicate, nunca cria', async () => {
    dbMocks.selectFrom.mockReturnValueOnce(selectChain({ id: 'material-existente' }));
    const item = makeItem({ sourceLanguageEvidence: 'pt' });

    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsSkippedDuplicate).toBe(1);
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  // Spec 088 (T2.9d/T2.9e, requisitos 52-55) — a classificação de tipo nunca
  // existiu: `DEFAULT_MATERIAL_TYPE_SLUG` era 'aventura' e resolvia UMA vez
  // por execução, fora do laço, aplicado a todos os itens. Resultado real em
  // beta: 103 materiais, todos "Aventura", nenhum classificado de fato.
  describe('T2.9d/T2.9e — resolução de tipo por item', () => {
    // Mock keyed por TABELA, não posicional: o insert da fila de tipo entra
    // entre o material e o metadata quando o hint não casa, e um
    // mockReturnValueOnce em sequência entregaria o chain do metadata para a
    // sugestão (e nada para o metadata), mascarando qual insert recebeu o quê.
    function setupCreate() {
      dbMocks.selectFrom
        .mockReturnValueOnce(selectChain(undefined))
        .mockReturnValueOnce(selectChain([]));
      getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');
      const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-novo' }) };
      const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const typeSuggestionInsert = { values: vi.fn().mockReturnThis(), onConflict: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const systemSuggestionInsert = { values: vi.fn().mockReturnThis(), onConflict: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const trxInsertInto = vi.fn((table: string) => {
        if (table === 'download_material') return materialInsert;
        if (table === 'download_material_metadata') return metadataInsert;
        if (table === 'download_material_type_suggestion') return typeSuggestionInsert;
        return systemSuggestionInsert;
      });
      dbMocks.transaction.mockReturnValue({
        execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) => cb({ insertInto: trxInsertInto }),
      });
      return Object.assign(materialInsert, { typeSuggestionInsert });
    }

    it('resolve o hint da fonte contra a taxonomia, em vez do default', async () => {
      const materialInsert = setupCreate();

      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([
        makeItem({ sourceLanguageEvidence: 'pt', materialTypeHint: 'regras' }),
      ]));

      expect(materialInsert.values).toHaveBeenCalledWith(expect.objectContaining({
        material_type: 'Regras',
        material_type_id: 'b071ab5e-2d16-4c58-8f0e-086000000006',
        // Casou: nada de bruto preservado.
        raw_material_type_hint: null,
      }));
    });

    it('hint que não casa preserva o valor bruto e cai no tipo neutro', async () => {
      const materialInsert = setupCreate();

      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([
        makeItem({ sourceLanguageEvidence: 'pt', materialTypeHint: 'Grimório de Feitiços' }),
      ]));

      // Requisito 54 — o material nunca perde a informação que a fonte
      // publicou, e o scraper nunca escreve na taxonomia central: o valor
      // bruto fica guardado e vira fila de triagem.
      expect(materialInsert.values).toHaveBeenCalledWith(expect.objectContaining({
        material_type: 'Não classificado',
        raw_material_type_hint: 'Grimório de Feitiços',
      }));
    });

    // Achado de review PR #218 (Codex, P2): antes desta correção o valor bruto
    // era gravado e nenhum consumidor administrativo o lia — o dado ficava
    // invisível, sem caminho de resolução, ao contrário de raw_system_hint que
    // já abria fila desde a spec 086.
    it('hint que não casa ABRE a fila de triagem, não só grava o valor bruto', async () => {
      const materialInsert = setupCreate();

      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([
        makeItem({ sourceLanguageEvidence: 'pt', materialTypeHint: 'Grimório de Feitiços' }),
      ]));

      expect(materialInsert.typeSuggestionInsert.values).toHaveBeenCalledWith(expect.objectContaining({
        material_id: 'material-novo',
        raw_value: 'Grimório de Feitiços',
        // Requisito 8/56: o scraper abre a fila, nunca escreve na taxonomia
        // central — essa escrita é exclusiva da triagem admin.
        source: 'scraper',
        status: 'pending',
      }));
    });

    it('hint que casa não abre fila — não há nada a triar', async () => {
      const materialInsert = setupCreate();

      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([
        makeItem({ sourceLanguageEvidence: 'pt', materialTypeHint: 'regras' }),
      ]));

      expect(materialInsert.typeSuggestionInsert.values).not.toHaveBeenCalled();
    });

    it('item sem hint nenhum não abre fila — ausência não é sugestão', async () => {
      const materialInsert = setupCreate();

      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([
        makeItem({ sourceLanguageEvidence: 'pt' }),
      ]));

      expect(materialInsert.typeSuggestionInsert.values).not.toHaveBeenCalled();
    });

    it('item sem hint cai no tipo NEUTRO, nunca em "Aventura"', async () => {
      const materialInsert = setupCreate();

      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([
        makeItem({ sourceLanguageEvidence: 'pt' }),
      ]));

      // Requisito 55 — rotular como Aventura quem ninguém classificou é
      // afirmação falsa sobre o conteúdo. E "caiu no default" precisa ser
      // distinguível de classificação real.
      expect(materialInsert.values).toHaveBeenCalledWith(expect.objectContaining({
        material_type: 'Não classificado',
        raw_material_type_hint: null,
      }));
    });
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

    const item = makeItem({
      sourceLanguageEvidence: 'pt',
      scenario: 'Qualquer mundo',
      authorsCredits: 'Autora',
      artistsCredits: 'Artista',
      format: 'PDF',
      tags: ['Aventura', '5e'],
      fileSizeText: '44,49 MB',
      pageCount: 15,
      creationMethod: 'Human-Created Without AI',
      sourceCategory: 'Linha de produto',
      sourceFilters: [{ facet: 'tipoDeProduto', path: ['Aventura', 'Campanha'] }],
      descriptionHtml: '<p>Descrição <strong>rica</strong></p>',
    });
    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsCreated).toBe(1);
    expect(materialInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: 'scraper-creator-id',
        editorial_state: 'published',
        access_kind: 'external_link',
        source_platform: 'itch_io',
        detected_language: 'por',
        language_confident: true,
        language_checked_at: expect.any(Date),
      }),
    );
    const materialValues = materialInsert.values.mock.calls[0][0];
    expect(materialValues.summary).toBe(item.description);
    expect(materialValues.summary).not.toContain('<');
    expect(metadataInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        material_id: 'material-novo',
        language: 'pt',
        scenario: 'Qualquer mundo',
        credits: 'Autora\nArtista',
        authors: ['Autora'],
        author_keys: ['autora'],
        artists: ['Artista'],
        artist_keys: ['artista'],
        file_format: 'PDF',
        // Achado real (smoke visual pós-deploy, 2026-07-26): node-postgres
        // sem type hint serializa array JS como array literal do Postgres
        // ('[]' virava '{}' no banco) — fix é JSON.stringify explícito
        // antes de entregar ao Kysely, então o valor passado pro insert é
        // a STRING serializada, não o array em si.
        tags: JSON.stringify(['Aventura', '5e']),
        file_size_text: '44,49 MB',
        page_count: 15,
        creation_method: 'Human-Created Without AI',
        source_category: 'Linha de produto',
        source_filters: JSON.stringify([{ facet: 'tipoDeProduto', path: ['Aventura', 'Campanha'] }]),
        description_html: '<p>Descrição <strong>rica</strong></p>',
        description_markdown: 'Uma aventura de RPG em português para testes automatizados completos.',
      }),
    );
    const logInsert = dbMocks.insertInto.mock.results
      .map((result) => result.value)
      .find((chain) => chain?.values && chain !== materialInsert && chain !== metadataInsert);
    expect(logInsert?.values).toHaveBeenCalledWith(expect.objectContaining({
      source_category: 'Linha de produto',
      system_hint: null,
      material_type_hint: null,
    }));
  });

  it('persiste texto decodificado antes de idioma, slug e taxonomia', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectChain(undefined))
      .mockReturnValueOnce(selectChain([]));
    detectPortugueseMock.mockResolvedValue({ isPortuguese: true, detectedLanguage: 'por', confident: true });
    getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');
    loadCatalogSystemsFlatMock.mockResolvedValue([{
      id: 'dnd',
      name: 'Dungeons & Dragons',
      name_pt: null,
      slug: 'dnd',
      path_slug: 'dnd',
      node_type: 'system',
      parent_id: null,
      aliases: ['D&D'],
    }]);

    const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-entidades' }) };
    const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    const trxInsertInto = vi.fn()
      .mockReturnValueOnce(materialInsert)
      .mockReturnValueOnce(metadataInsert);
    dbMocks.transaction.mockReturnValue({
      execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) =>
        cb({ insertInto: trxInsertInto }),
    });

    const item = normalizeScrapedItemPlainText(makeItem({
      title: 'Guia de D&amp;D',
      description: 'Descrição de D&#38;D suficientemente longa para o detector.',
      publisherName: 'Editora &amp; Dados',
      authorsCredits: 'Autora &amp; Coautora',
      artistsCredits: 'Artista &#38; Ilustradora',
      systemHint: 'D&amp;D',
      materialTypeHint: 'Regr&#97;s',
      sourceLanguageEvidence: null,
    }));

    await runScraperIngest('run-entities', 'itch_io', asyncIterableOf([item]));

    expect(detectPortugueseMock).toHaveBeenCalledWith(expect.stringContaining('Guia de D&D'));
    const materialValues = materialInsert.values.mock.calls[0][0];
    expect(materialValues).toMatchObject({
      title: 'Guia de D&D',
      slug: 'guia-de-d-d',
      summary: 'Descrição de D&D suficientemente longa para o detector.',
      system_id: 'dnd',
      raw_system_hint: null,
      material_type: 'Regras',
      raw_material_type_hint: null,
    });
    expect(metadataInsert.values).toHaveBeenCalledWith(expect.objectContaining({
      publisher_name: 'Editora & Dados',
      credits: 'Autora & Coautora\nArtista & Ilustradora',
    }));
  });

  it('violação do índice UNIQUE (corrida entre runs concorrentes): outcome=skipped_duplicate, não skipped_error', async () => {
    dbMocks.selectFrom
      .mockReturnValueOnce(selectChain(undefined))
      .mockReturnValueOnce(selectChain([]));
    getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');
    dbMocks.transaction.mockReturnValue({
      execute: async () => { throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }); },
    });

    const item = makeItem({ sourceLanguageEvidence: 'pt' });
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

    const item = makeItem({ sourceLanguageEvidence: 'pt' });
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

    const item = makeItem({ sourceLanguageEvidence: 'pt' });
    const result = await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

    expect(result.itemsCreated).toBe(1);
    expect(result.itemsSkippedError).toBe(0);
  });

  it('falha no maior outcome preserva a rejeicao e deixa rastro persistente na run', async () => {
    detectPortugueseMock.mockResolvedValue({
      isPortuguese: false,
      detectedLanguage: 'eng',
      confident: true,
      method: 'franc',
      reason: 'franc_confident',
    });

    // Regressão de T5.5b/DEB-089-19: skipped_not_portuguese é o maior
    // outcome do contrato e estourava o VARCHAR(20). O catch continua
    // best-effort, mas precisa persistir uma falha auditável na própria run.
    dbMocks.insertInto.mockReturnValueOnce({
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockRejectedValue(new Error('value too long for type character varying(20)')),
    });
    const runUpdateSet = vi.fn().mockReturnThis();
    dbMocks.updateTable.mockReturnValue({
      set: runUpdateSet,
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    });

    const result = await runScraperIngest(
      'run-language-log-failure',
      'opera_rpg',
      asyncIterableOf([makeItem({ sourceLanguageEvidence: null })]),
    );

    expect(result.itemsSkippedNotPortuguese).toBe(1);
    expect(result.itemsSkippedError).toBe(0);
    expect(runUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
      item_log_failures: expect.anything(),
      item_log_error_detail: 'value too long for type character varying(20)',
    }));
  });

  it('atualiza contadores de download_scraper_run incrementalmente, um update por item', async () => {
    dbMocks.selectFrom.mockReturnValue(selectChain({ id: 'dup' }));
    const items = [makeItem({ sourceLanguageEvidence: 'pt' }), makeItem({ sourceLanguageEvidence: 'pt', sourceUrl: 'https://example.itch.io/game-2' })];

    await runScraperIngest('run-1', 'itch_io', asyncIterableOf(items));

    expect(dbMocks.updateTable).toHaveBeenCalledTimes(2);
    // Itens SEM hint de tipo não consultam o catálogo por item — usam o tipo
    // neutro já resolvido antes do laço. A única chamada é a do default.
    expect(getCatalogMaterialTypeBySlugMock).toHaveBeenCalledTimes(1);
  });

  it('falha uma vez antes do loop quando o tipo neutro de fallback não existe', async () => {
    getCatalogMaterialTypeBySlugMock.mockResolvedValue(null);

    await expect(runScraperIngest(
      'run-1',
      'itch_io',
      asyncIterableOf([makeItem({ sourceLanguageEvidence: 'pt' }), makeItem({ sourceLanguageEvidence: 'pt' })]),
    )).rejects.toThrow('catalog_material_type_not_found: nao-classificado');

    expect(getCatalogMaterialTypeBySlugMock).toHaveBeenCalledTimes(1);
    expect(getOrCreateScraperCreatorIdMock).not.toHaveBeenCalled();
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });

  // T4.5 (spec 086, Fase 4) — resolução de taxonomia: auto-match EXATO
  // (matchSystemNameExact) contra o catálogo carregado; não casando,
  // preserva o texto bruto e abre sugestão pending.
  describe('resolução de systemHint (Fase 4)', () => {
    // resolveTaxonomyIds sobe parent_id até a raiz (node_type='system') —
    // fixture precisa incluir a raiz pro lookup não cair no fallback
    // (matchedId usado como system_id quando a cadeia não fecha).
    const ROOT_NODE = { id: 'dnd', name: 'Dungeons & Dragons', name_pt: null, slug: 'dnd', path_slug: 'dnd', node_type: 'system' as const, parent_id: null, aliases: [] };

    function catalogNode(overrides: Partial<{ id: string; name: string; name_pt: string | null; aliases: string[] }> = {}) {
      return {
        id: 'dd5e', name: 'Dungeons & Dragons 5e', name_pt: null, slug: 'dnd-5e', path_slug: 'dnd/5e',
        node_type: 'edition' as const, parent_id: 'dnd', aliases: ['D&D 5e'],
        ...overrides,
      };
    }

    it('sem systemHint: system_id e raw_system_hint ficam null, nenhuma sugestão aberta', async () => {
      dbMocks.selectFrom
        .mockReturnValueOnce(selectChain(undefined))
        .mockReturnValueOnce(selectChain([]));
      getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');

      const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-novo' }) };
      const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const trxInsertInto = vi.fn().mockReturnValueOnce(materialInsert).mockReturnValueOnce(metadataInsert);
      dbMocks.transaction.mockReturnValue({
        execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) => cb({ insertInto: trxInsertInto }),
      });

      const item = makeItem({ sourceLanguageEvidence: 'pt' });
      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

      expect(loadCatalogSystemsFlatMock).not.toHaveBeenCalled();
      expect(trxInsertInto).toHaveBeenCalledTimes(2);
      const materialValues = materialInsert.values.mock.calls[0][0];
      expect(materialValues.system_id).toBeNull();
      expect(materialValues.raw_system_hint).toBeNull();
    });

    it('systemHint casa nó folha (edition): system_id vira a RAIZ, edition_id vira o nó casado (achado real PR #204)', async () => {
      loadCatalogSystemsFlatMock.mockResolvedValue([ROOT_NODE, catalogNode()]);
      dbMocks.selectFrom
        .mockReturnValueOnce(selectChain(undefined))
        .mockReturnValueOnce(selectChain([]));
      getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');

      const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-novo' }) };
      const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const trxInsertInto = vi.fn().mockReturnValueOnce(materialInsert).mockReturnValueOnce(metadataInsert);
      dbMocks.transaction.mockReturnValue({
        execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) => cb({ insertInto: trxInsertInto }),
      });

      const item = makeItem({ sourceLanguageEvidence: 'pt', systemHint: 'D&D 5e' });
      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

      expect(trxInsertInto).toHaveBeenCalledTimes(2);
      const materialValues = materialInsert.values.mock.calls[0][0];
      expect(materialValues.system_id).toBe('dnd');
      expect(materialValues.edition_id).toBe('dd5e');
      expect(materialValues.raw_system_hint).toBeNull();
    });

    it('systemHint casa nó raiz (system): system_id vira o próprio nó, edition_id fica null', async () => {
      loadCatalogSystemsFlatMock.mockResolvedValue([ROOT_NODE]);
      dbMocks.selectFrom
        .mockReturnValueOnce(selectChain(undefined))
        .mockReturnValueOnce(selectChain([]));
      getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');

      const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-novo' }) };
      const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const trxInsertInto = vi.fn().mockReturnValueOnce(materialInsert).mockReturnValueOnce(metadataInsert);
      dbMocks.transaction.mockReturnValue({
        execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) => cb({ insertInto: trxInsertInto }),
      });

      const item = makeItem({ sourceLanguageEvidence: 'pt', systemHint: 'Dungeons & Dragons' });
      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

      const materialValues = materialInsert.values.mock.calls[0][0];
      expect(materialValues.system_id).toBe('dnd');
      expect(materialValues.edition_id).toBeNull();
    });

    it('systemHint NÃO casa (nem aproximado): preserva texto bruto e abre download_system_suggestion pending', async () => {
      loadCatalogSystemsFlatMock.mockResolvedValue([catalogNode()]);
      dbMocks.selectFrom
        .mockReturnValueOnce(selectChain(undefined))
        .mockReturnValueOnce(selectChain([]));
      getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');

      const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-novo' }) };
      const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const suggestionInsert = { values: vi.fn().mockReturnThis(), onConflict: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const trxInsertInto = vi.fn()
        .mockReturnValueOnce(materialInsert)
        .mockReturnValueOnce(suggestionInsert)
        .mockReturnValueOnce(metadataInsert);
      dbMocks.transaction.mockReturnValue({
        execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) => cb({ insertInto: trxInsertInto }),
      });

      const item = makeItem({ sourceLanguageEvidence: 'pt', systemHint: 'Sistema Totalmente Desconhecido XYZ' });
      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

      expect(trxInsertInto).toHaveBeenCalledTimes(3);
      const materialValues = materialInsert.values.mock.calls[0][0];
      expect(materialValues.system_id).toBeNull();
      expect(materialValues.raw_system_hint).toBe('Sistema Totalmente Desconhecido XYZ');
      expect(suggestionInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          material_id: 'material-novo',
          raw_value: 'Sistema Totalmente Desconhecido XYZ',
          source: 'scraper',
          status: 'pending',
        }),
      );
    });

    it('systemHint casa por alias (não só nome canônico)', async () => {
      // Achado real (review PR #204, Codex): aliases:[] com systemHint igual
      // ao name torna o teste indistinguível de "casa por nome canônico" —
      // alias real e diferente do nome prova que o match usa mesmo o alias.
      loadCatalogSystemsFlatMock.mockResolvedValue([{ ...catalogNode({ id: 'cain', name: 'CAIN Roleplaying Game', aliases: ['CAIN'] }), node_type: 'system' as const, parent_id: null }]);
      dbMocks.selectFrom
        .mockReturnValueOnce(selectChain(undefined))
        .mockReturnValueOnce(selectChain([]));
      getOrCreateScraperCreatorIdMock.mockResolvedValue('scraper-creator-id');

      const materialInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockReturnThis(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: 'material-novo' }) };
      const metadataInsert = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
      const trxInsertInto = vi.fn().mockReturnValueOnce(materialInsert).mockReturnValueOnce(metadataInsert);
      dbMocks.transaction.mockReturnValue({
        execute: async (cb: (trx: { insertInto: typeof trxInsertInto }) => Promise<string>) => cb({ insertInto: trxInsertInto }),
      });

      const item = makeItem({ sourceLanguageEvidence: 'pt', systemHint: 'CAIN' });
      await runScraperIngest('run-1', 'itch_io', asyncIterableOf([item]));

      const materialValues = materialInsert.values.mock.calls[0][0];
      expect(materialValues.system_id).toBe('cain');
    });
  });
});

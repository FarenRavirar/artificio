// T1.6 (spec 085, migrado T7.4/T7.5) — testes contra os 3 fixtures reais
// colados pelo mantenedor (T0.1/T0.2/T0.2b), sem HTML sintético/mockado
// pros casos positivos. sourcePlatform deixou de ser parâmetro — parseHtml
// resolve a plataforma via callback findPlatformByDomain (simula o
// registry, sem precisar mockar `db` nem kysely neste teste unitário).
// storytellersvault-product-1.html deixa de ser teste NEGATIVO (E3): mesma
// família OneBookShelf, mesmo override, agora positivo. Rejeição de
// domínio passa a ser testada via fixture sintético de domínio não
// cadastrado (T7.4).

import fs from 'node:fs';
import path from 'node:path';
import { parseHtml, GenericParseError, MAX_HTML_LENGTH, genericParsePreviewSchema, type FindPlatformByDomain } from './genericHtmlParser';
import type { DownloadScraperPlatform } from '../../db/types';

const FIXTURES_DIR = path.resolve(__dirname, '../../../test/fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

function makePlatform(overrides: Partial<DownloadScraperPlatform> = {}): DownloadScraperPlatform {
  return {
    slug: 'dms_guild',
    name: 'DMs Guild',
    domain: 'www.dmsguild.com',
    supports_auto_scrape: false,
    supports_price_recheck: false,
    parser_kind: 'onebookshelf',
    created_at: new Date(),
    ...overrides,
  };
}

// Registry falso: mapa domain -> plataforma, mesma trava do real (T6.1) —
// nunca casa domain=NULL, só match exato de hostname.
function registryOf(platforms: DownloadScraperPlatform[]): FindPlatformByDomain {
  return async (domain: string) => platforms.find((p) => p.domain === domain) ?? null;
}

const DMS_GUILD_PLATFORM = makePlatform({ slug: 'dms_guild', name: 'DMs Guild', domain: 'www.dmsguild.com', parser_kind: 'onebookshelf' });
const DRIVETHRURPG_PLATFORM = makePlatform({ slug: 'drivethrurpg', name: 'DriveThruRPG', domain: 'www.drivethrurpg.com', parser_kind: 'onebookshelf' });
const STORYTELLERSVAULT_PLATFORM = makePlatform({ slug: 'storytellersvault', name: 'Storytellers Vault', domain: 'www.storytellersvault.com', parser_kind: 'onebookshelf' });

describe('parseHtml', () => {
  it('extrai campos do fixture DMs Guild real (produto PWYW), plataforma detectada via canonical', async () => {
    const html = loadFixture('dms-guild-product-1.html');
    const result = await parseHtml(html, registryOf([DMS_GUILD_PLATFORM]));

    expect(result.title).toBe('Classe O Lutador (5E)- Playtest');
    expect(result.sourceUrl).toBe('https://www.dmsguild.com/pt/product/472734/classe-o-lutador-5e-playtest');
    expect(result.publisherName).toBe('Dungeon Masters Guild');
    expect(result.coverImageUrl).toBe('https://d1vzi28wh99zvq.cloudfront.net/images/8957/472734.png');
    expect(result.sourceLanguageHint).toBe('pt');
    expect(result.extractedPriceValue).toBe(4);
    expect(result.priceSignal).toBe('pwyw_tag_present');
    expect(result.isFreeOrPwyw).toBe(true);
    expect(result.description).toContain('O Lutador');
    expect(result.scenario).toBe('Inespecífico/Qualquer mundo');
    expect(result.authorsCredits).toBe('Felix Klaus');
    expect(result.pageCount).toBe(15);
    expect(result.sourceFilters).toEqual(
      expect.arrayContaining([
        { facet: 'tipoDeProduto', path: ['Opções para personagens', 'Classe/Arquétipo'] },
        { facet: 'edicao', path: ['5th Edition', '5e'] },
      ]),
    );
    expect(result.tags).toEqual(expect.arrayContaining(['Opções para personagens', 'Classe/Arquétipo', '5th Edition', '5e']));
    expect(result.descriptionHtml).toContain('<img');
  });

  it('extrai campos do fixture DriveThruRPG real (produto grátis fixo)', async () => {
    const html = loadFixture('drivethrurpg-product-1.html');
    const result = await parseHtml(html, registryOf([DRIVETHRURPG_PLATFORM]));

    expect(result.title).toBe('RPG Bíblico - Tomada de Jerusalém');
    expect(result.sourceUrl).toBe('https://www.drivethrurpg.com/pt/product/484755/rpg-biblico-tomada-de-jerusalem');
    expect(result.publisherName).toBe('thiagogomes');
    expect(result.extractedPriceValue).toBe(0);
    expect(result.priceSignal).toBe('zero_price_no_pwyw_tag');
    expect(result.isFreeOrPwyw).toBe(true);
  });

  // T7.4 (E3) — storytellersvault-product-1.html vira POSITIVO: plataforma
  // cadastrada no seed real (migration_025), mesmo override onebookshelf,
  // mesma família. Antes era teste negativo (domain_mismatch); agora prova
  // que o parser genérico extrai corretamente.
  it('extrai campos do fixture StorytellersVault real (E3 — vira positivo, mesma família OneBookShelf)', async () => {
    const html = loadFixture('storytellersvault-product-1.html');
    const result = await parseHtml(html, registryOf([STORYTELLERSVAULT_PLATFORM]));

    expect(result.title).toBe('Crônicas de SP - Crias da Anarquia');
    expect(result.publisherName).toBe('White Wolf');
    expect(result.sourceUrl).toBe('https://www.storytellersvault.com/pt/product/394516/cronicas-de-sp-crias-da-anarquia');
  });

  // T7.4 — rejeição de domínio não cadastrado (substitui o teste antigo de
  // "domínio incompatível com source_platform declarado", que não existe
  // mais — não há mais source_platform declarado pelo admin).
  it('rejeita domínio não cadastrado no registry (unsupported_platform)', async () => {
    const html = loadFixture('drivethrurpg-product-1.html');
    await expect(parseHtml(html, registryOf([]))).rejects.toThrow(GenericParseError);
    try {
      await parseHtml(html, registryOf([]));
    } catch (error) {
      expect(error).toBeInstanceOf(GenericParseError);
      expect((error as GenericParseError).code).toBe('unsupported_platform');
    }
  });

  // T7.5 — caminho genérico puro: plataforma com parser_kind='json_ld_generic'
  // (sem override), extrai JSON-LD Schema.org padrão sem código novo —
  // prova o critério de aceite central da emenda (maioria dos 100+ sites
  // funciona só com cadastro no registry).
  it('extrai via caminho genérico puro (sem override), plataforma parser_kind=json_ld_generic', async () => {
    const syntheticHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<link rel="canonical" href="https://loja.exemplo.com.br/produto/aventura-generica">
<meta property="og:image" content="https://loja.exemplo.com.br/img/capa.jpg">
<script type="application/ld+json">{"@type":"Product","name":"Aventura Genérica","description":"Uma aventura de teste.","brand":{"name":"Editora Exemplo"},"offers":{"price":0}}</script>
</head>
<body></body>
</html>`;
    const genericPlatform = makePlatform({
      slug: 'loja_exemplo',
      name: 'Loja Exemplo',
      domain: 'loja.exemplo.com.br',
      parser_kind: 'json_ld_generic',
    });

    const result = await parseHtml(syntheticHtml, registryOf([genericPlatform]));

    expect(result.title).toBe('Aventura Genérica');
    expect(result.publisherName).toBe('Editora Exemplo');
    expect(result.coverImageUrl).toBe('https://loja.exemplo.com.br/img/capa.jpg');
    expect(result.sourceLanguageHint).toBe('pt');
    expect(result.extractedPriceValue).toBe(0);
    // Sem override onebookshelf: sinal padrão (resolveDefaultPriceSignal),
    // não a lógica de tag PWYW — preço 0 já basta pra sinalizar gratuito.
    expect(result.priceSignal).toBe('zero_price_no_pwyw_tag');
    expect(result.isFreeOrPwyw).toBe(true);
  });

  // Achado real (review PR #201, Codex, P2): regex original exigia
  // <script type="..."> e <link rel="..." href="..."> nessa ordem exata de
  // atributos — HTML real de terceiros pode ter nonce/id/outros atributos
  // antes, ou usar aspas simples. Objetivo da spec é cadastrar site novo
  // SEM código (parser_kind='json_ld_generic'); extração não pode depender
  // de ordem/estilo de aspas dos atributos HTML.
  it('extrai mesmo com atributos fora de ordem e aspas simples (JSON-LD com nonce antes de type, canonical com href antes de rel, aspas simples)', async () => {
    const syntheticHtml = `<!DOCTYPE html>
<html lang='pt-BR'>
<head>
<link href='https://loja2.exemplo.com.br/produto/outra-aventura' rel='canonical'>
<meta content='https://loja2.exemplo.com.br/img/capa2.jpg' property='og:image'>
<script nonce="abc123" type='application/ld+json'>{"@type":"Product","name":"Outra Aventura","description":"Descrição.","brand":{"name":"Editora Dois"},"offers":{"price":0}}</script>
</head>
<body></body>
</html>`;
    const genericPlatform = makePlatform({
      slug: 'loja2_exemplo',
      name: 'Loja Dois',
      domain: 'loja2.exemplo.com.br',
      parser_kind: 'json_ld_generic',
    });

    const result = await parseHtml(syntheticHtml, registryOf([genericPlatform]));

    expect(result.title).toBe('Outra Aventura');
    expect(result.sourceUrl).toBe('https://loja2.exemplo.com.br/produto/outra-aventura');
    expect(result.coverImageUrl).toBe('https://loja2.exemplo.com.br/img/capa2.jpg');
    expect(result.sourceLanguageHint).toBe('pt');
  });

  // Achado real (review PR #201, Codex, P1): JSON-LD raiz nem sempre é um
  // objeto Product isolado — @graph, array no topo, @type como array e
  // offers como array são formatos Schema.org comuns em CMS/e-commerce.
  it('extrai Product de dentro de @graph, com @type array e offers array', async () => {
    const syntheticHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<link rel="canonical" href="https://loja3.exemplo.com.br/produto/aventura-grafo">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"Página"},{"@type":["Product","Thing"],"name":"Aventura Via Graph","description":"Via @graph.","brand":{"name":"Editora Graph"},"offers":[{"price":0},{"price":10}]}]}</script>
</head>
<body></body>
</html>`;
    const genericPlatform = makePlatform({
      slug: 'loja3_exemplo',
      name: 'Loja Três',
      domain: 'loja3.exemplo.com.br',
      parser_kind: 'json_ld_generic',
    });

    const result = await parseHtml(syntheticHtml, registryOf([genericPlatform]));

    expect(result.title).toBe('Aventura Via Graph');
    expect(result.publisherName).toBe('Editora Graph');
    expect(result.extractedPriceValue).toBe(0);
  });

  // Achado real (review PR #201, Codex, follow-up): extractedPriceValue
  // deve usar a primeira oferta com PREÇO VÁLIDO, não literalmente
  // offers[0] — primeira oferta sem price definido não pode "vencer" e
  // devolver null quando existe oferta posterior com preço válido.
  it('extrai preço da primeira oferta VÁLIDA quando offers[0] não tem price', async () => {
    const syntheticHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<link rel="canonical" href="https://loja5.exemplo.com.br/produto/aventura-oferta-sem-preco">
<script type="application/ld+json">{"@type":"Product","name":"Aventura Multi-Oferta","description":"Teste.","brand":{"name":"Editora Cinco"},"offers":[{"availability":"InStock"},{"price":10}]}</script>
</head>
<body></body>
</html>`;
    const genericPlatform = makePlatform({
      slug: 'loja5_exemplo',
      name: 'Loja Cinco',
      domain: 'loja5.exemplo.com.br',
      parser_kind: 'json_ld_generic',
    });

    const result = await parseHtml(syntheticHtml, registryOf([genericPlatform]));

    expect(result.extractedPriceValue).toBe(10);
  });

  it('extrai Product de array no topo do bloco JSON-LD', async () => {
    const syntheticHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<link rel="canonical" href="https://loja4.exemplo.com.br/produto/aventura-array">
<script type="application/ld+json">[{"@type":"BreadcrumbList"},{"@type":"Product","name":"Aventura Via Array","description":"Via array raiz.","brand":{"name":"Editora Array"},"offers":{"price":5}}]</script>
</head>
<body></body>
</html>`;
    const genericPlatform = makePlatform({
      slug: 'loja4_exemplo',
      name: 'Loja Quatro',
      domain: 'loja4.exemplo.com.br',
      parser_kind: 'json_ld_generic',
    });

    const result = await parseHtml(syntheticHtml, registryOf([genericPlatform]));

    expect(result.title).toBe('Aventura Via Array');
    expect(result.extractedPriceValue).toBe(5);
  });

  it('sinaliza produto pago sem tag PWYW como priceSignal nonzero_price_no_pwyw_tag, sem sugerir isFreeOrPwyw (override onebookshelf)', async () => {
    const dmsGuildHtml = loadFixture('dms-guild-product-1.html');
    const paidHtml = dmsGuildHtml
      .replaceAll('obs-product-format-pwyw-options', 'removed-pwyw-marker')
      .replace('"price": 4', '"price": 15');

    const result = await parseHtml(paidHtml, registryOf([DMS_GUILD_PLATFORM]));
    expect(result.extractedPriceValue).toBe(15);
    expect(result.priceSignal).toBe('nonzero_price_no_pwyw_tag');
    expect(result.isFreeOrPwyw).toBeNull();
  });

  it('rejeita HTML sem bloco JSON-LD', async () => {
    const html = loadFixture('dms-guild-product-1.html').replace(
      /<script type="application\/ld\+json">.*?<\/script>/s,
      '',
    );
    try {
      await parseHtml(html, registryOf([DMS_GUILD_PLATFORM]));
      expect.unreachable();
    } catch (error) {
      expect((error as GenericParseError).code).toBe('missing_json_ld');
    }
  });

  it('rejeita HTML sem <link rel="canonical">', async () => {
    const html = loadFixture('dms-guild-product-1.html').replace(/<link rel="canonical" href="[^"]+"[^>]*>/, '');
    try {
      await parseHtml(html, registryOf([DMS_GUILD_PLATFORM]));
      expect.unreachable();
    } catch (error) {
      expect((error as GenericParseError).code).toBe('missing_canonical');
    }
  });

  it('rejeita JSON-LD malformado', async () => {
    const html = loadFixture('dms-guild-product-1.html').replace(
      /(<script type="application\/ld\+json">)(.*?)(<\/script>)/s,
      '$1{ invalid json $3',
    );
    try {
      await parseHtml(html, registryOf([DMS_GUILD_PLATFORM]));
      expect.unreachable();
    } catch (error) {
      expect((error as GenericParseError).code).toBe('invalid_json_ld');
    }
  });

  it('schema de saída rejeita campo extra fora do shape esperado (T1.5)', async () => {
    const html = loadFixture('dms-guild-product-1.html');
    const result = await parseHtml(html, registryOf([DMS_GUILD_PLATFORM]));

    expect(() =>
      genericParsePreviewSchema.parse({ ...result, unexpectedField: 'nao deveria existir' }),
    ).toThrow();
  });

  it('rejeita HTML maior que o limite de tamanho', async () => {
    const html = loadFixture('dms-guild-product-1.html') + 'x'.repeat(MAX_HTML_LENGTH);
    try {
      await parseHtml(html, registryOf([DMS_GUILD_PLATFORM]));
      expect.unreachable();
    } catch (error) {
      expect((error as GenericParseError).code).toBe('html_too_large');
    }
  });
});

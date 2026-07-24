// T1.6 (spec 085) — testes contra os 3 fixtures reais colados pelo
// mantenedor (T0.1/T0.2/T0.2b), sem HTML sintético/mockado.

import fs from 'node:fs';
import path from 'node:path';
import {
  parseOneBookShelfHtml,
  OneBookShelfParseError,
  MAX_HTML_LENGTH,
  oneBookShelfParsePreviewSchema,
} from './onebookshelfHtmlParser';

const FIXTURES_DIR = path.resolve(__dirname, '../../../test/fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

describe('parseOneBookShelfHtml', () => {
  it('extrai campos do fixture DMs Guild real (produto PWYW)', () => {
    const html = loadFixture('dms-guild-product-1.html');
    const result = parseOneBookShelfHtml(html, 'dms_guild');

    expect(result.title).toBe('Classe O Lutador (5E)- Playtest');
    expect(result.sourceUrl).toBe('https://www.dmsguild.com/pt/product/472734/classe-o-lutador-5e-playtest');
    expect(result.publisherName).toBe('Dungeon Masters Guild');
    expect(result.coverImageUrl).toBe('https://d1vzi28wh99zvq.cloudfront.net/images/8957/472734.png');
    expect(result.sourceLanguageHint).toBe('pt');
    expect(result.extractedPriceValue).toBe(4);
    expect(result.priceSignal).toBe('pwyw_tag_present');
    expect(result.isFreeOrPwyw).toBe(true);
    expect(result.description).toContain('O Lutador');
  });

  it('extrai campos do fixture DriveThruRPG real (produto grátis fixo)', () => {
    const html = loadFixture('drivethrurpg-product-1.html');
    const result = parseOneBookShelfHtml(html, 'drivethrurpg');

    expect(result.title).toBe('RPG Bíblico - Tomada de Jerusalém');
    expect(result.sourceUrl).toBe('https://www.drivethrurpg.com/pt/product/484755/rpg-biblico-tomada-de-jerusalem');
    expect(result.publisherName).toBe('thiagogomes');
    expect(result.extractedPriceValue).toBe(0);
    expect(result.priceSignal).toBe('zero_price_no_pwyw_tag');
    expect(result.isFreeOrPwyw).toBe(true);
  });

  it('rejeita fixture StorytellersVault quando declarado como drivethrurpg (domínio incompatível, requisito 8a)', () => {
    const html = loadFixture('storytellersvault-product-1.html');
    expect(() => parseOneBookShelfHtml(html, 'drivethrurpg')).toThrow(OneBookShelfParseError);
    try {
      parseOneBookShelfHtml(html, 'drivethrurpg');
    } catch (error) {
      expect(error).toBeInstanceOf(OneBookShelfParseError);
      expect((error as OneBookShelfParseError).code).toBe('domain_mismatch');
    }
  });

  it('rejeita fixture StorytellersVault quando declarado como dms_guild (domínio incompatível)', () => {
    const html = loadFixture('storytellersvault-product-1.html');
    expect(() => parseOneBookShelfHtml(html, 'dms_guild')).toThrow(OneBookShelfParseError);
  });

  it('sinaliza produto pago sem tag PWYW como priceSignal nonzero_price_no_pwyw_tag, sem sugerir isFreeOrPwyw', () => {
    const dmsGuildHtml = loadFixture('dms-guild-product-1.html');
    const paidHtml = dmsGuildHtml
      .replaceAll('obs-product-format-pwyw-options', 'removed-pwyw-marker')
      .replace('"price": 4', '"price": 15');

    const result = parseOneBookShelfHtml(paidHtml, 'dms_guild');
    expect(result.extractedPriceValue).toBe(15);
    expect(result.priceSignal).toBe('nonzero_price_no_pwyw_tag');
    expect(result.isFreeOrPwyw).toBeNull();
  });

  it('rejeita HTML sem bloco JSON-LD', () => {
    const html = loadFixture('dms-guild-product-1.html').replace(
      /<script type="application\/ld\+json">.*?<\/script>/s,
      '',
    );
    expect(() => parseOneBookShelfHtml(html, 'dms_guild')).toThrow(OneBookShelfParseError);
    try {
      parseOneBookShelfHtml(html, 'dms_guild');
    } catch (error) {
      expect((error as OneBookShelfParseError).code).toBe('missing_json_ld');
    }
  });

  it('rejeita HTML sem <link rel="canonical">', () => {
    const html = loadFixture('dms-guild-product-1.html').replace(/<link rel="canonical" href="[^"]+"[^>]*>/, '');
    expect(() => parseOneBookShelfHtml(html, 'dms_guild')).toThrow(OneBookShelfParseError);
    try {
      parseOneBookShelfHtml(html, 'dms_guild');
    } catch (error) {
      expect((error as OneBookShelfParseError).code).toBe('missing_canonical');
    }
  });

  it('rejeita JSON-LD malformado', () => {
    const html = loadFixture('dms-guild-product-1.html').replace(
      /(<script type="application\/ld\+json">)(.*?)(<\/script>)/s,
      '$1{ invalid json $3',
    );
    expect(() => parseOneBookShelfHtml(html, 'dms_guild')).toThrow(OneBookShelfParseError);
    try {
      parseOneBookShelfHtml(html, 'dms_guild');
    } catch (error) {
      expect((error as OneBookShelfParseError).code).toBe('invalid_json_ld');
    }
  });

  it('schema de saída rejeita campo extra fora do shape esperado (T1.5)', () => {
    const html = loadFixture('dms-guild-product-1.html');
    const result = parseOneBookShelfHtml(html, 'dms_guild');

    expect(() =>
      oneBookShelfParsePreviewSchema.parse({ ...result, unexpectedField: 'nao deveria existir' }),
    ).toThrow();
  });

  it('rejeita HTML maior que o limite de tamanho', () => {
    const html = loadFixture('dms-guild-product-1.html') + 'x'.repeat(MAX_HTML_LENGTH);
    expect(() => parseOneBookShelfHtml(html, 'dms_guild')).toThrow(OneBookShelfParseError);
    try {
      parseOneBookShelfHtml(html, 'dms_guild');
    } catch (error) {
      expect((error as OneBookShelfParseError).code).toBe('html_too_large');
    }
  });
});

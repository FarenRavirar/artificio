import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyOneBookShelfOverride } from './platformOverrides/onebookshelf';
import type { PlatformOverrideInput } from './platformOverrides';

const FIXTURES_DIR = path.resolve(__dirname, '../../../test/fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

function preview(): PlatformOverrideInput {
  return {
    sourceUrl: 'https://www.dmsguild.com/pt/product/example',
    title: 'Teste',
    description: 'Descrição JSON-LD truncada',
    isFreeOrPwyw: null,
    coverImageUrl: null,
    publisherName: null,
    sourceLanguageHint: 'pt',
    extractedPriceValue: 0,
    priceSignal: 'zero_price_no_pwyw_tag',
  };
}

describe('applyOneBookShelfOverride', () => {
  it.each([
    ['dms-guild-product-1.html', 'Inespecífico/Qualquer mundo', 15],
    ['drivethrurpg-product-1.html', 'Outros sistemas exclusivos', 18],
    ['storytellersvault-product-1.html', 'Vampire the Masquerade', 58],
  ])('extrai metadata rica do fixture real %s', (fixture, scenario, pageCount) => {
    const result = applyOneBookShelfOverride(preview(), loadFixture(fixture));

    expect(result.scenario).toBe(scenario);
    expect(result.pageCount).toBe(pageCount);
    expect(result.authorsCredits).not.toBeNull();
    expect(result.fileSizeText).not.toBeNull();
    expect(result.format).toBe('PDF');
    expect(result.descriptionHtml).not.toBeNull();
    expect(result.tags).toEqual(expect.any(Array));
  });

  it('não captura data-codeid do bloco de avaliações fora da table-list', () => {
    const result = applyOneBookShelfOverride(preview(), loadFixture('storytellersvault-product-1.html'));

    expect(result.scenario).toBe('Vampire the Masquerade');
    expect(result.authorsCredits).toMatch(/^Lobo Loss/);
    expect(result.sourceFilters?.flatMap(({ path }) => path).join(' ')).not.toMatch(/comment|customer|badge|discussion/i);
    expect(result).not.toHaveProperty('commentText');
    expect(result).not.toHaveProperty('customerName');
    expect(result).not.toHaveProperty('badgeType');
    expect(result).not.toHaveProperty('discussionDate');
  });

  it('usa obs-product-description completa em vez do texto JSON-LD truncado', () => {
    const result = applyOneBookShelfOverride(preview(), loadFixture('dms-guild-product-1.html'));

    expect(result.descriptionHtml).toContain('<ul>');
    expect(result.descriptionHtml).toContain('<img');
    expect(result.description).not.toContain('<');
  });

  it('deriva tags achatadas dos caminhos tipados de filters', () => {
    const result = applyOneBookShelfOverride(preview(), loadFixture('dms-guild-product-1.html'));

    expect(result.sourceFilters).toEqual([
      { facet: 'tipoDeProduto', path: ['Opções para personagens', 'Classe/Arquétipo'] },
      { facet: 'conteudo', path: ['DMsGuild'] },
      { facet: 'edicao', path: ['5th Edition', '5e'] },
    ]);
    expect(result.tags).toEqual(expect.arrayContaining(['Opções para personagens', 'Classe/Arquétipo', 'DMsGuild', '5th Edition', '5e']));
  });
});

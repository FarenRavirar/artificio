import { expectTypeOf } from 'vitest';
import {
  SCRAPED_ITEM_FIELD_POLICY,
  normalizeScrapedItemPlainText,
} from './plainTextPolicy';
import type { ScrapedItem } from './types';

describe('política semântica de ScrapedItem', () => {
  it('é exaustiva no tipo e decodifica recursivamente só plainText', () => {
    expectTypeOf(SCRAPED_ITEM_FIELD_POLICY).toMatchTypeOf<
      Record<keyof ScrapedItem, 'plainText' | 'url' | 'richHtml' | 'opaque'>
    >();

    const raw: ScrapedItem = {
      sourceUrl: 'https://example.com/?a=1&amp;b=2',
      title: 'D&amp;D &#38; OPERA &#x26; HTML5 &copy;',
      description: 'Descrição &quot;rica&quot;',
      isFreeOrPwyw: true,
      coverImageUrl: 'https://example.com/capa?a=1&amp;b=2',
      publisherName: 'Grimórios &amp; Dados',
      sourceLanguageHint: 'pt',
      scenario: 'Cenário &amp; mundo',
      systemHint: 'D&amp;D',
      materialTypeHint: 'Regras &amp; fichas',
      authorsCredits: 'Autora &amp; Coautora',
      artistsCredits: 'Artista &#38; Ilustradora',
      creationMethod: 'Humano &amp; IA',
      sourceFilters: [{ facet: 'Edição &amp; sistema', path: ['D&amp;D', '5e &#x26; 2024'] }],
      tags: ['RPG &amp; fantasia'],
      fileSizeText: '10 &amp; 20 MB',
      format: 'PDF &amp; ZIP',
      pageCount: 42,
      sourceCategory: 'Livro &amp; suplemento',
      descriptionHtml: '<p>D&amp;D <strong>rico</strong></p>',
    };

    const normalized = normalizeScrapedItemPlainText(raw);

    expect(normalized).toMatchObject({
      title: 'D&D & OPERA & HTML5 ©',
      description: 'Descrição "rica"',
      publisherName: 'Grimórios & Dados',
      scenario: 'Cenário & mundo',
      systemHint: 'D&D',
      materialTypeHint: 'Regras & fichas',
      authorsCredits: 'Autora & Coautora',
      artistsCredits: 'Artista & Ilustradora',
      creationMethod: 'Humano & IA',
      sourceFilters: [{ facet: 'Edição & sistema', path: ['D&D', '5e & 2024'] }],
      tags: ['RPG & fantasia'],
      fileSizeText: '10 & 20 MB',
      format: 'PDF & ZIP',
      sourceCategory: 'Livro & suplemento',
    });
    expect(normalized.sourceUrl).toBe(raw.sourceUrl);
    expect(normalized.coverImageUrl).toBe(raw.coverImageUrl);
    expect(normalized.descriptionHtml).toBe(raw.descriptionHtml);
    expect(normalized.isFreeOrPwyw).toBe(true);
    expect(normalized.pageCount).toBe(42);
  });

  it('faz exatamente uma passagem de decode', () => {
    const normalized = normalizeScrapedItemPlainText({
      sourceUrl: 'https://example.com/item',
      title: 'D&amp;lt;D',
      description: null,
      isFreeOrPwyw: true,
      coverImageUrl: null,
      publisherName: null,
      sourceLanguageHint: null,
      systemHint: null,
      materialTypeHint: null,
    });

    expect(normalized.title).toBe('D&lt;D');
  });
});

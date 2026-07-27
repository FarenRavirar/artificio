import { decode } from 'html-entities';
import type { ScrapedItem } from './types';

export type ScrapedFieldPolicy = 'plainText' | 'url' | 'richHtml' | 'opaque';

// Spec 089 T1.1: mapa exaustivo. Campo novo em ScrapedItem quebra o tsc
// até receber semântica explícita; não existe default silencioso.
export const SCRAPED_ITEM_FIELD_POLICY = {
  sourceUrl: 'url',
  title: 'plainText',
  description: 'plainText',
  isFreeOrPwyw: 'opaque',
  coverImageUrl: 'url',
  publisherName: 'plainText',
  sourceLanguageEvidence: 'opaque',
  scenario: 'plainText',
  systemHint: 'plainText',
  materialTypeHint: 'plainText',
  authorsCredits: 'plainText',
  artistsCredits: 'plainText',
  creationMethod: 'plainText',
  sourceFilters: 'plainText',
  tags: 'plainText',
  fileSizeText: 'plainText',
  format: 'plainText',
  pageCount: 'opaque',
  sourceCategory: 'plainText',
  descriptionHtml: 'richHtml',
} as const satisfies Record<keyof ScrapedItem, ScrapedFieldPolicy>;

export function decodeHtml5PlainText(value: string): string {
  // Uma passagem, HTML5 completo. `&amp;lt;` vira `&lt;`, nunca `<`.
  return decode(value, { level: 'html5', scope: 'body' });
}

function decodePlainTextValue(value: unknown): unknown {
  if (typeof value === 'string') return decodeHtml5PlainText(value);
  if (Array.isArray(value)) return value.map(decodePlainTextValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodePlainTextValue(child)]));
  }
  return value;
}

export function normalizeFieldsByPolicy<T extends object>(
  value: T,
  policy: Record<keyof T, ScrapedFieldPolicy>,
): T {
  const normalized = { ...value } as Record<keyof T, unknown>;
  for (const key of Object.keys(policy) as Array<keyof T>) {
    if (policy[key] === 'plainText' && key in value) {
      normalized[key] = decodePlainTextValue(value[key]);
    }
  }
  return normalized as T;
}

export function normalizeScrapedItemPlainText(item: ScrapedItem): ScrapedItem {
  return normalizeFieldsByPolicy(item, SCRAPED_ITEM_FIELD_POLICY);
}

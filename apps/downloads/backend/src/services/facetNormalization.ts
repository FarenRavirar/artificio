const PUBLISHER_EDGE_WORDS = new Set([
  'editora',
  'editorial',
  'ltda',
  'limitada',
  'eireli',
  'me',
]);

function baseFacetKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeAuthorKey(value: string): string {
  return baseFacetKey(value);
}

export function normalizePublisherKey(value: string): string {
  const words = baseFacetKey(value).split(' ').filter(Boolean);
  while (words.length > 0 && PUBLISHER_EDGE_WORDS.has(words[0])) words.shift();
  while (words.length > 0 && PUBLISHER_EDGE_WORDS.has(words.at(-1)!)) words.pop();
  return words.join(' ');
}

export function normalizeCreditNames(values: readonly string[]): { labels: string[]; keys: string[] } {
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const label = raw.trim().replace(/\s+/g, ' ');
    const key = normalizeAuthorKey(label);
    if (label && key && !byKey.has(key)) byKey.set(key, label);
  }
  return { labels: [...byKey.values()], keys: [...byKey.keys()] };
}

export function splitCreditNames(value: string | null | undefined): string[] {
  if (!value) return [];
  // Vírgula não é separador seguro: fontes reais trazem nomes como
  // "Angevine, Dall.e". Só delimitadores inequívocos viram múltiplos valores.
  return value.split(/\s*(?:\r?\n|;)\s*/).filter(Boolean);
}

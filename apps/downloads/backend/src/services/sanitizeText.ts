// T6.1 (spec 075) — sanitizacao de texto livre antes de renderizar no admin.
// Nenhum campo do painel admin permite HTML rico; strip total de tags e
// entidades e suficiente (equivalente a DOMPurify com ALLOWED_TAGS: []),
// sem exigir jsdom/isomorphic-dompurify so pro backend.

export function sanitizeText(input: string): string {
  let previous: string;
  let current = input;
  do {
    previous = current;
    current = current.replace(/<[^<>]*>/g, '');
  } while (current !== previous);

  do {
    previous = current;
    current = current.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, '');
  } while (current !== previous);

  return current.trim();
}

import sanitizeHtml from 'sanitize-html';

const MARKDOWN_ONLY_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

/**
 * Campos editados como Markdown não aceitam HTML cru. A sanitização ocorre na
 * escrita e também na leitura para proteger dados antigos ou importados por
 * caminhos que não passaram pela API (spec 089, T6B.2/T6B.4).
 */
export function sanitizeUserMarkdown(value: string): string {
  return sanitizeHtml(value, MARKDOWN_ONLY_OPTIONS);
}

export function sanitizeNullableUserMarkdown(value: string | null): string | null {
  return value === null ? null : sanitizeUserMarkdown(value);
}

export function sanitizeOptionalUserMarkdown(
  value: string | null | undefined,
): string | null | undefined {
  return value === null || value === undefined ? value : sanitizeUserMarkdown(value);
}

type TableMarkdownFields = {
  description?: string | null;
  rules_notes?: string | null;
  synopsis?: string | null;
  style_text?: string | null;
  technical_requirements?: string | null;
};

export function sanitizeTableMarkdownFields<T extends TableMarkdownFields>(table: T): T {
  return {
    ...table,
    description: sanitizeOptionalUserMarkdown(table.description),
    rules_notes: sanitizeOptionalUserMarkdown(table.rules_notes),
    synopsis: sanitizeOptionalUserMarkdown(table.synopsis),
    style_text: sanitizeOptionalUserMarkdown(table.style_text),
    technical_requirements: sanitizeOptionalUserMarkdown(table.technical_requirements),
  };
}

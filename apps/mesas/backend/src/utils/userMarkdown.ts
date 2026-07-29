import sanitizeHtml from 'sanitize-html';

const MARKDOWN_ONLY_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Trechos que o Markdown trata como literais e que, por isso, NÃO podem passar
// pelo removedor de HTML: código cercado (```…``` e ~~~…~~~), código inline
// (`…`, ``…``) e autolink (<https://…>, <a@b.c>). Ordem importa — cercado antes
// de inline, senão uma crase de dentro do bloco fecharia um span cedo demais.
const MARKDOWN_LITERAL_RE = new RegExp(
  [
    '```[\\s\\S]*?```',
    '~~~[\\s\\S]*?~~~',
    '(?<!`)(`+)(?!`)[\\s\\S]*?(?<!`)\\1(?!`)',
    '<(?:https?|ftp|mailto):[^\\s<>]*>',
    '<[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+>',
  ].join('|'),
  'g',
);

/**
 * Campos editados como Markdown não aceitam HTML cru. A sanitização ocorre na
 * escrita e também na leitura para proteger dados antigos ou importados por
 * caminhos que não passaram pela API (spec 089, T6B.2/T6B.4).
 *
 * Achado de review (Codex, P2): aplicar `sanitize-html` sobre a FONTE Markdown
 * destrói conteúdo legítimo, e como a sanitização roda na escrita, a perda é
 * permanente. Medido com a versão anterior desta função:
 *
 *   'Use `<button>` aqui'        ->  'Use `` aqui'      (código inline vazio)
 *   '```html\n<div>x</div>\n```' ->  '```html\nx\n```'  (bloco esvaziado)
 *   'Veja <https://example.com>' ->  'Veja '            (autolink apagado)
 *
 * `sanitize-html` analisa a string antes de qualquer parser Markdown, então
 * `<button>` entre crases é tag para ele e literal para o Markdown. A correção
 * preserva os trechos literais e sanitiza só o resto: o HTML executável continua
 * removido, porque fora desses trechos nada mudou, e dentro deles o renderizador
 * escapa o conteúdo em vez de interpretá-lo — é o que "literal" significa no
 * CommonMark. Não basta confiar nisso para a saída: quem renderizar continua
 * responsável por não ligar `html: true` no parser (T6B.2).
 */
export function sanitizeUserMarkdown(value: string): string {
  let result = '';
  let lastIndex = 0;

  // Cada match é um trecho literal a preservar; o texto ENTRE eles é o que pode
  // conter HTML hostil e é o único que atravessa o sanitizador.
  for (const match of value.matchAll(MARKDOWN_LITERAL_RE)) {
    result += sanitizeHtml(value.slice(lastIndex, match.index), MARKDOWN_ONLY_OPTIONS);
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  return result + sanitizeHtml(value.slice(lastIndex), MARKDOWN_ONLY_OPTIONS);
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

import sanitizeHtml from 'sanitize-html';

const MARKDOWN_ONLY_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Literais inline ficam separados dos blocos: cercas CommonMark têm tamanho
// variável e não podem ser modeladas corretamente por uma regex fixa.
const MARKDOWN_INLINE_LITERAL_RE = new RegExp(
  [
    '(?<!`)(`+)(?!`)[\\s\\S]*?(?<!`)\\1(?!`)',
    '<(?:https?|ftp|mailto):[^\\s<>]*>',
    '<[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+>',
  ].join('|'),
  'g',
);

type LiteralRange = { start: number; end: number };

function findMarkdownBlockLiteralRanges(value: string): LiteralRange[] {
  const ranges: LiteralRange[] = [];
  let openFence: { marker: '`' | '~'; length: number; start: number } | null = null;

  for (const match of value.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)) {
    const line = match[0];
    if (!line) continue;

    const start = match.index;
    const end = start + line.length;
    const content = line.replace(/(?:\r\n|\n|\r)$/, '');

    if (openFence) {
      const closing = content.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (
        closing &&
        closing[1][0] === openFence.marker &&
        closing[1].length >= openFence.length
      ) {
        ranges.push({ start: openFence.start, end });
        openFence = null;
      }
      continue;
    }

    const opening = content.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening) {
      const marker = opening[1][0] as '`' | '~';
      const info = opening[2];
      // CommonMark não aceita crase na info string de cerca por crases.
      if (marker === '~' || !info.includes('`')) {
        openFence = { marker, length: opening[1].length, start };
        continue;
      }
    }

    // Bloco de código indentado: o HTML da linha é texto literal no CommonMark.
    if (/^(?: {4}|\t)/.test(content)) ranges.push({ start, end });
  }

  // Cerca sem fechamento não é preservada deliberadamente: mantém a fronteira
  // defensiva existente para payload truncado, coberta por teste de evasão.
  return ranges;
}

function sanitizePreservingInlineLiterals(value: string): string {
  let result = '';
  let lastIndex = 0;

  for (const match of value.matchAll(MARKDOWN_INLINE_LITERAL_RE)) {
    result += sanitizeHtml(value.slice(lastIndex, match.index), MARKDOWN_ONLY_OPTIONS);
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  return result + sanitizeHtml(value.slice(lastIndex), MARKDOWN_ONLY_OPTIONS);
}

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
 *
 * Achado real (review do commit 27fe800323, Codex, P2): cercas fixas de três
 * caracteres fechavam cedo numa cerca interna menor e ignoravam blocos
 * indentados. O scanner acima rastreia marcador e comprimento da abertura.
 */
export function sanitizeUserMarkdown(value: string): string {
  let result = '';
  let lastIndex = 0;

  // Blocos cercados/indentados são preservados inteiros; o texto entre eles
  // ainda reconhece apenas os literais inline antes de passar pelo sanitizador.
  for (const range of findMarkdownBlockLiteralRanges(value)) {
    result += sanitizePreservingInlineLiterals(value.slice(lastIndex, range.start));
    result += value.slice(range.start, range.end);
    lastIndex = range.end;
  }

  return result + sanitizePreservingInlineLiterals(value.slice(lastIndex));
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

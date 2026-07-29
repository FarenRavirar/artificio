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
    String.raw`(?<!\`)(\`+)(?!\`)[\s\S]*?(?<!\`)\1(?!\`)`,
    String.raw`<(?:https?|ftp|mailto):[^\s<>]*>`,
    String.raw`<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>`,
  ].join('|'),
  'g',
);

type LiteralRange = { start: number; end: number };
type MarkdownLine = LiteralRange & { content: string };
type Fence = { marker: '`' | '~'; length: number; trailing: string };

function* scanMarkdownLines(value: string): Generator<MarkdownLine> {
  let start = 0;

  while (start < value.length) {
    let contentEnd = start;
    while (contentEnd < value.length && !'\r\n'.includes(value[contentEnd])) contentEnd += 1;

    let end = contentEnd;
    if (value.startsWith('\r\n', end)) end += 2;
    else if (end < value.length) end += 1;

    yield { start, end, content: value.slice(start, contentEnd) };
    start = end;
  }
}

function readFence(content: string): Fence | null {
  let markerStart = 0;
  while (markerStart < 3 && content.startsWith(' ', markerStart)) markerStart += 1;

  let marker: '`' | '~';
  if (content.startsWith('`', markerStart)) marker = '`';
  else if (content.startsWith('~', markerStart)) marker = '~';
  else return null;

  let markerEnd = markerStart;
  while (content.startsWith(marker, markerEnd)) markerEnd += 1;

  return {
    marker,
    length: markerEnd - markerStart,
    trailing: content.slice(markerEnd),
  };
}

function readOpeningFence(content: string): Pick<Fence, 'marker' | 'length'> | null {
  const fence = readFence(content);
  if (!fence || fence.length < 3) return null;
  if (fence.marker === '`' && fence.trailing.includes('`')) return null;
  return { marker: fence.marker, length: fence.length };
}

function containsOnlySpacesOrTabs(value: string): boolean {
  for (const character of value) {
    if (character !== ' ' && character !== '\t') return false;
  }
  return true;
}

function closesFence(content: string, openFence: Pick<Fence, 'marker' | 'length'>): boolean {
  const fence = readFence(content);
  return Boolean(
    fence &&
    fence.marker === openFence.marker &&
    fence.length >= openFence.length &&
    containsOnlySpacesOrTabs(fence.trailing),
  );
}

function extendLastRange(ranges: LiteralRange[], start: number, end: number): void {
  const previousRange = ranges.at(-1);
  if (previousRange?.end === start) previousRange.end = end;
}

function findMarkdownBlockLiteralRanges(value: string): LiteralRange[] {
  const ranges: LiteralRange[] = [];
  let openFence: { marker: '`' | '~'; length: number; start: number } | null = null;
  let inIndentedBlock = false;
  let previousLineIsBlank = true;

  for (const { start, end, content } of scanMarkdownLines(value)) {
    if (openFence) {
      if (closesFence(content, openFence)) {
        ranges.push({ start: openFence.start, end });
        openFence = null;
      }
      previousLineIsBlank = false;
      continue;
    }

    const opening = readOpeningFence(content);
    if (opening) {
      openFence = { ...opening, start };
      inIndentedBlock = false;
      previousLineIsBlank = false;
      continue;
    }

    const isBlank = containsOnlySpacesOrTabs(content);
    const isIndented = content.startsWith('    ') || content.startsWith('\t');

    // Achado real (review do commit 684fbfd, Codex, P2): bloco indentado não
    // interrompe parágrafo CommonMark. Só começa no documento/após linha vazia;
    // depois disso, linhas indentadas e vazias contíguas pertencem ao bloco.
    if (isIndented && (previousLineIsBlank || inIndentedBlock)) {
      if (inIndentedBlock) extendLastRange(ranges, start, end);
      else ranges.push({ start, end });
      inIndentedBlock = true;
    } else if (isBlank && inIndentedBlock) {
      extendLastRange(ranges, start, end);
    } else if (!isBlank) {
      inIndentedBlock = false;
    }

    previousLineIsBlank = isBlank;
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
  listing_excerpt?: string | null;
  technical_requirements?: string | null;
  synopsis_narrative?: string | null;
  benefits_text?: string | null;
  table_gm_bio?: string | null;
};

export function sanitizeTableMarkdownFields<T extends TableMarkdownFields>(table: T): T {
  return {
    ...table,
    description: sanitizeOptionalUserMarkdown(table.description),
    rules_notes: sanitizeOptionalUserMarkdown(table.rules_notes),
    synopsis: sanitizeOptionalUserMarkdown(table.synopsis),
    style_text: sanitizeOptionalUserMarkdown(table.style_text),
    listing_excerpt: sanitizeOptionalUserMarkdown(table.listing_excerpt),
    technical_requirements: sanitizeOptionalUserMarkdown(table.technical_requirements),
    synopsis_narrative: sanitizeOptionalUserMarkdown(table.synopsis_narrative),
    benefits_text: sanitizeOptionalUserMarkdown(table.benefits_text),
    table_gm_bio: sanitizeOptionalUserMarkdown(table.table_gm_bio),
  };
}

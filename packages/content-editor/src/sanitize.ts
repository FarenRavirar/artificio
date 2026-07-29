import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';

const MARKDOWN_ONLY_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

const markdownRenderer = new MarkdownIt({ html: false, linkify: false, typographer: false });

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

  return { marker, length: markerEnd - markerStart, trailing: content.slice(markerEnd) };
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

export function sanitizeUserMarkdown(value: string): string {
  let result = '';
  let lastIndex = 0;

  for (const range of findMarkdownBlockLiteralRanges(value)) {
    result += sanitizePreservingInlineLiterals(value.slice(lastIndex, range.start));
    result += value.slice(range.start, range.end);
    lastIndex = range.end;
  }

  return result + sanitizePreservingInlineLiterals(value.slice(lastIndex));
}

export function sanitizeNullableUserMarkdown(value: string | null | undefined): string | null {
  return value == null ? null : sanitizeUserMarkdown(value);
}

export function sanitizeOptionalUserMarkdown(
  value: string | null | undefined,
): string | null | undefined {
  return value === null || value === undefined ? value : sanitizeUserMarkdown(value);
}

export function markdownToPlainText(value: string, maxLength?: number): string {
  const rendered = markdownRenderer.render(sanitizeUserMarkdown(value));
  const plain = sanitizeHtml(rendered, MARKDOWN_ONLY_OPTIONS)
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength === undefined || plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trimEnd();
}

import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';

/**
 * Remoção de HTML **sem escapar `<` e `>` que sobrevivem como texto**.
 *
 * Sem as duas opções abaixo, `sanitize-html` devolvia `&gt; texto` para
 * `> texto` — e o `markdown-it` deixava de reconhecer a citação, porque
 * `&gt;` não é o caractere que abre blockquote. O mesmo valia para `a > b`
 * e `1 < 2`, gravados no banco com entidade no lugar do caractere digitado.
 *
 * - `parser.decodeEntities: false` impede o parser de decodificar a entidade
 *   **da entrada**. Sem isso, `&lt;script&gt;` digitado pelo usuário vira
 *   `<script>` antes do escape, e o `textFilter` abaixo não teria como
 *   distinguir "entidade que o usuário escreveu" de "escape que nós
 *   introduzimos" — devolveria um `<script>` literal ao chamador.
 * - `textFilter` recebe o texto já escapado (`sanitize-html/index.js:615`) e
 *   desfaz **apenas** o escape de `<`/`>` que este passo acabou de aplicar.
 *   `&` continua escapado: desfazê-lo reabriria a ambiguidade que a opção
 *   anterior fecha.
 *
 * Tag real continua removida (`allowedTags: []` roda antes): `<script>alert(1)</script>`
 * sai como string vazia, `<b>x</b>` sai como `x`. O que muda é só o destino do
 * `<`/`>` que **não** fazia parte de uma tag.
 *
 * A defesa de render não depende disto: `renderMarkdown` roda `markdown-it` com
 * `html: false` — que escapa todo `<` remanescente — e passa por DOMPurify
 * depois. Medido: `<script>alert(1)</script>` sobrevivente renderiza como
 * `&lt;script&gt;alert(1)&lt;/script&gt;`, texto inerte.
 *
 * ## Dois efeitos medidos que o leitor futuro precisa conhecer
 *
 * 1. **`&` continua saindo como `&amp;`.** `a & b` grava `a &amp; b`. Desfazer
 *    também o `&` reabriria exatamente a ambiguidade que `decodeEntities: false`
 *    fecha — `&amp;lt;` e `&lt;` deixariam de ser distinguíveis. O `&` escapado
 *    é inerte e o render o exibe como `&`; o `>` escapado, não: ele quebrava a
 *    citação. Por isso um foi corrigido e o outro não.
 * 2. **`&lt;script&gt;` digitado pelo usuário passa a ser armazenado como
 *    `<script>` literal.** O parser não decodifica a entrada, então esse texto
 *    nunca foi visto como tag e não é removido. **O dado gravado deixou de ser
 *    inerte por si só** — a garantia passou a vir do render (`html: false` +
 *    DOMPurify), medido acima. Consequência operacional: quem consumir estes
 *    campos **precisa** renderizar por `renderMarkdown`/`MarkdownContent`;
 *    injetar o valor cru em `innerHTML`/`set:html` seria XSS. Busca negativa em
 *    2026-08-07: nenhum consumidor de `sanitizeUserMarkdown` faz isso — `site`
 *    usa pipeline próprio, os demais passam pelo render compartilhado.
 */
const MARKDOWN_ONLY_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  parser: { decodeEntities: false },
  textFilter: (escaped) => escaped.replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
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
  return (
    fence?.marker === openFence.marker &&
    fence.length >= openFence.length &&
    containsOnlySpacesOrTabs(fence.trailing)
  );
}

function extendLastRange(ranges: LiteralRange[], start: number, end: number): void {
  const previousRange = ranges.at(-1);
  if (previousRange?.end === start) previousRange.end = end;
}

// Uma linha abre container de bloco quando é item de lista (`- `, `* `, `+ `,
// `1. `) ou citação (`> `). Enquanto um container está aberto, 4 espaços NÃO
// iniciam bloco de código indentado: para o markdown-it aquilo é continuação do
// item (vira parágrafo, não <pre><code>). Tratar como literal deixava
// `- item\n\n    <img src=x onerror=...>` sair sem sanitizar (review PR #227).
const BLOCK_CONTAINER_RE = /^ {0,3}(?:[-*+]\s|\d{1,9}[.)]\s|>)/;

function opensBlockContainer(content: string): boolean {
  return BLOCK_CONTAINER_RE.test(content);
}

// Container de lista/citação aberto: só é fechado por uma linha não-indentada
// que não continua o container (o próprio markdown-it segue essa regra).
function nextBlockContainerState(
  current: boolean,
  content: string,
  isBlank: boolean,
  isIndented: boolean,
): boolean {
  if (opensBlockContainer(content)) return true;
  // Linha de texto na coluna 0 encerra a lista/citação anterior.
  if (!isBlank && !isIndented) return false;
  return current;
}

type IndentedBlockState = { inIndentedBlock: boolean };

// Dentro de lista/citação, linha indentada é continuação do item — o markdown-it
// a renderiza como parágrafo, não como bloco de código —, então não pode ser
// marcada como literal ou o HTML embutido escaparia da limpeza.
function trackIndentedBlock(
  ranges: LiteralRange[],
  state: IndentedBlockState,
  line: MarkdownLine,
  flags: { isBlank: boolean; isIndented: boolean; insideContainer: boolean; previousLineIsBlank: boolean },
): void {
  const { start, end } = line;
  const { isBlank, isIndented, insideContainer, previousLineIsBlank } = flags;

  if (isIndented && !insideContainer && (previousLineIsBlank || state.inIndentedBlock)) {
    if (state.inIndentedBlock) extendLastRange(ranges, start, end);
    else ranges.push({ start, end });
    state.inIndentedBlock = true;
    return;
  }

  if (isBlank && state.inIndentedBlock) {
    extendLastRange(ranges, start, end);
    return;
  }

  if (!isBlank) state.inIndentedBlock = false;
}

function findMarkdownBlockLiteralRanges(value: string): LiteralRange[] {
  const ranges: LiteralRange[] = [];
  let openFence: { marker: '`' | '~'; length: number; start: number } | null = null;
  const indentedState: IndentedBlockState = { inIndentedBlock: false };
  let previousLineIsBlank = true;
  let insideBlockContainer = false;

  for (const line of scanMarkdownLines(value)) {
    const { start, end, content } = line;

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
      indentedState.inIndentedBlock = false;
      previousLineIsBlank = false;
      continue;
    }

    const isBlank = containsOnlySpacesOrTabs(content);
    const isIndented = content.startsWith('    ') || content.startsWith('\t');

    insideBlockContainer = nextBlockContainerState(insideBlockContainer, content, isBlank, isIndented);
    trackIndentedBlock(ranges, indentedState, line, {
      isBlank,
      isIndented,
      insideContainer: insideBlockContainer,
      previousLineIsBlank,
    });

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

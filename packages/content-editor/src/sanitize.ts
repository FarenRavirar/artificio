import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';

/**
 * Remoção de HTML **sem escapar `<` e `>` que sobrevivem como texto**.
 *
 * Sem o pré-passo de `protectLooseAngleBrackets`, `sanitize-html` devolvia
 * `&gt; texto` para `> texto` — e o `markdown-it` deixava de reconhecer a
 * citação, porque `&gt;` não é o caractere que abre blockquote. O mesmo valia
 * para `a > b` e `1 < 2`, gravados no banco com entidade no lugar do caractere
 * digitado.
 *
 * `parser.decodeEntities: false` impede o parser de decodificar a entidade
 * **da entrada**: `&lt;` digitado pelo usuário permanece `&lt;` na saída, em vez
 * de virar `<`. É o que mantém a função idempotente — ver a nota de idempotência
 * em `sanitizeUserMarkdown`.
 *
 * Tag real continua removida (`allowedTags: []`): `<script>alert(1)</script>`
 * sai como string vazia, `<b>x</b>` sai como `x`.
 *
 * **`&` continua saindo como `&amp;`** — `a & b` grava `a &amp; b`. Diferente do
 * `>`, o `&` escapado não quebra marcação nenhuma: o render o exibe como `&`.
 * Desfazê-lo só reintroduziria ambiguidade sem resolver problema real.
 */
const MARKDOWN_ONLY_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  parser: { decodeEntities: false },
};

/**
 * Sentinelas para o `<`/`>` que **não** fazem parte de uma tag.
 *
 * Área de uso privado do Unicode (U+E000-U+F8FF): não têm significado em
 * Markdown, não são produzidos por teclado e não colidem com texto real. Um
 * marcador textual (`__LT__`) colidiria com conteúdo legítimo do usuário.
 *
 * **"Não é produzido por teclado" não significa "não chega na entrada".** Um
 * atacante cola o caractere direto no corpo, e a restauração o converteria em
 * `<` — devolvendo `<script>` literal a partir de um texto que o sanitizador
 * nunca viu como tag. Bypass completo, medido em 2026-08-07 (achado do review da
 * PR #246). Por isso `stripSentinels` roda **antes** de qualquer coisa: a
 * sentinela só existe entre o pré-passo e a restauração, nunca vinda de fora.
 */
const LOOSE_LT = '';
const LOOSE_GT = '';

/** Remove sentinela vinda da entrada — ver a nota acima. */
const SENTINEL_RE = /[]/g;

/**
 * Descarta a sentinela que o usuário tenha enviado.
 *
 * Descarta, e não escapa: são caracteres de uso privado, sem significado
 * acordado — nenhum texto legítimo depende deles, e preservá-los custaria
 * carregar um caso de borda para sempre. Some silenciosamente porque não há
 * nada que o autor tenha querido dizer com eles.
 */
function stripSentinels(value: string): string {
  return value.replace(SENTINEL_RE, '');
}

/** `<` seguido disto pode abrir tag; qualquer outro `<` é texto. */
const TAG_NAME_START = /[a-zA-Z/!?]/;

/**
 * Troca por sentinela o `<`/`>` que está **fora** de uma tag.
 *
 * ## Por que um pré-passo, e não `textFilter`
 *
 * A tentativa anterior desfazia o escape dentro de `textFilter`. Medido em
 * 2026-08-07: **não funciona, e quebra a idempotência**. O filtro recebe o texto
 * já escapado (`sanitize-html/index.js:615`), e nesse ponto `<` digitado pelo
 * usuário e `&lt;` digitado pelo usuário chegam **idênticos** (`&lt;`) — são
 * indistinguíveis por construção. Desfazer o escape convertia a entidade do
 * usuário em markup: `&lt;b&gt;ok&lt;/b&gt;` virava `<b>ok</b>` na primeira
 * passagem e `ok` na segunda, então o conteúdo **mudava a cada sanitização**.
 * Achado do review da PR #246 (Codex, P1), confirmado por medição.
 *
 * O pré-passo não tem esse problema porque roda **antes** do escape, sobre o
 * texto original, onde `<` e `&lt;` ainda são coisas diferentes.
 *
 * A varredura acompanha se está dentro de tag: `<` seguido de letra, `/`, `!` ou
 * `?` abre o modo tag, e o `>` que o fecha fica **intacto** — é o que o
 * `sanitize-html` precisa ver para reconhecer e remover a tag. Proteger todo `>`
 * indistintamente fazia o sanitizador perder o fechamento e engolir o texto
 * seguinte (medido: `<b>x</b> a > b` saía vazio).
 */
function protectLooseAngleBrackets(value: string): string {
  let result = '';
  let insideTag = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (insideTag) {
      result += character;
      if (character === '>') insideTag = false;
      continue;
    }

    if (character === '<' && TAG_NAME_START.test(value[index + 1] ?? '')) {
      insideTag = true;
      result += character;
      continue;
    }

    if (character === '<') result += LOOSE_LT;
    else if (character === '>') result += LOOSE_GT;
    else result += character;
  }

  return result;
}

function restoreLooseAngleBrackets(value: string): string {
  return value.split(LOOSE_LT).join('<').split(LOOSE_GT).join('>');
}

/** Remove HTML preservando `<`/`>` soltos como texto. */
function sanitizeMarkdownText(value: string): string {
  return restoreLooseAngleBrackets(
    sanitizeHtml(protectLooseAngleBrackets(value), MARKDOWN_ONLY_OPTIONS),
  );
}

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
    result += sanitizeMarkdownText(value.slice(lastIndex, match.index));
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  return result + sanitizeMarkdownText(value.slice(lastIndex));
}

/**
 * Remove HTML do Markdown do usuário, preservando literais e `<`/`>` soltos.
 *
 * ## Idempotência é requisito, não detalhe
 *
 * `sanitizeUserMarkdown(sanitizeUserMarkdown(x)) === sanitizeUserMarkdown(x)`
 * para todo `x`. Não é elegância: consumidores sanitizam na escrita **e** de
 * novo na leitura — `apps/downloads/backend/src/routes/comments.ts` persiste a
 * saída na linha 47 e re-sanitiza na linha 65. Uma função não idempotente faz o
 * conteúdo armazenado **mudar ou desaparecer** a cada leitura, sem erro nenhum.
 *
 * Foi exatamente o que uma tentativa anterior de corrigir o escape de `<`/`>`
 * causou (review da PR #246, Codex P1): `&lt;b&gt;ok&lt;/b&gt;` virava
 * `<b>ok</b>` na primeira passagem e `ok` na segunda. O motivo e a correção
 * estão em `protectLooseAngleBrackets`.
 */
export function sanitizeUserMarkdown(input: string): string {
  // Antes de tudo: a sentinela do pré-passo não pode vir de fora, senão a
  // restauração a converteria em `<`/`>` reais sem o sanitizador ter visto tag
  // nenhuma. Roda aqui, no ponto de entrada único, para que nenhum caminho
  // interno receba entrada não filtrada.
  const value = stripSentinels(input);

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
  // `sanitizeHtml` direto, **sem** o pré-passo de sentinela: aqui a entrada é
  // HTML produzido pelo `markdown-it`, onde toda tag é estrutura real e todo
  // `&gt;` remanescente foi escapado pelo renderizador — não é texto do usuário
  // que precise sobreviver. Proteger `<`/`>` neste ponto impediria a remoção das
  // próprias tags que se quer descartar para chegar ao texto puro.
  const plain = sanitizeHtml(rendered, MARKDOWN_ONLY_OPTIONS)
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength === undefined || plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trimEnd();
}

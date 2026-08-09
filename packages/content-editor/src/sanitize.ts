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

/**
 * Identificador da política de sanitização do HTML legado, gravado junto do
 * conteúdo em `community_comment.legacy_sanitizer_policy`/`_version`
 * (`migration_006:147-148`).
 *
 * Registrar os dois é o que permite **não ressanitizar continuamente**
 * (requisito 10): o conteúdo é limpo uma vez, na importação, e a linha carrega
 * sob qual regra isso aconteceu. Quando a política mudar, sobe a versão e o
 * histórico continua legível — sem isso, um conteúdo antigo seria indistinguível
 * de um limpo pela regra nova, e a única saída seria reprocessar tudo.
 */
export const LEGACY_COMMENT_SANITIZER_POLICY = 'site-comment-html';
export const LEGACY_COMMENT_SANITIZER_VERSION = 1;

/**
 * Política do HTML legado — **defaults da `sanitize-html`, mais duas regras que
 * ela não tem como presumir**.
 *
 * ## Por que os defaults, e não uma allowlist estreita
 *
 * Medido em 2026-08-09 contra `sanitize-html@2.17.6`: os defaults (70 tags)
 * neutralizam **10 de 10** vetores testados — `<script>`, `<svg><script>`,
 * MathML, `onclick`, `<img onerror>`, `<iframe>`, `style=`, `<form>`,
 * `javascript:` e `data:` — sem configuração nenhuma, e são idempotentes sobre
 * entidade digitada e `&` solto. A parte perigosa é da biblioteca, que a faz
 * bem; recortar para `p`/`br`/`a` reduziria superfície **teórica** (nada
 * executável sobra no default) ao custo de fazer sumir em silêncio qualquer
 * `<strong>` ou `<blockquote>` que apareça no dump.
 *
 * O conteúdo real usa `a`, `br` e `p` — os dois bancos do `site` (prod e beta,
 * 25 linhas cada, idênticos) não têm mais nada, e os contadores de vetor
 * hostil deram zero. A lista estreita **caberia**; escolhemos robustez a
 * conteúdo inesperado, porque o custo dela é perda silenciosa e o ganho é
 * marginal.
 *
 * ## As duas regras que os defaults não cobrem
 *
 * 1. **`target="_blank"` sem `rel`.** Medido: o default permite `target` em
 *    `<a>` e **não** permite `rel` — a pior combinação para UGC, porque a página
 *    de destino ganha `window.opener` (reverse tabnabbing). Não é bug da lib: o
 *    default não presume link de terceiro. Aqui todo link é de terceiro.
 * 2. **`http:` passa no default** (`allowedSchemes` traz `http`, `ftp`, `tel`).
 *    10a é HTTPS-only, e o legado não pode ser a porta por onde `http:` volta.
 *    Medido: nenhum link legado usa `http:`, então nada real se perde.
 *
 * O `rel` do WordPress (`nofollow ugc`) também **seria descartado** pelo default
 * — `rel` não está na allowlist de atributos —, o que transformaria 25 links
 * legados em links seguidos por buscador. Por isso ele é reescrito, não
 * herdado: valor de origem não decide segurança de saída.
 */
const LEGACY_COMMENT_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags,
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'rel', 'target'],
  },
  allowedSchemes: ['https'],
  allowedSchemesAppliedToAttributes: ['href'],
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      // Sem `href` **aceitável** não é link: devolver `rel`/`target` numa casca
      // deixaria `<a rel=... target=...>` decorando algo que não navega. O texto
      // do link é preservado pela própria lib.
      //
      // O esquema é checado **aqui**, e não só por `allowedSchemes`, por causa
      // da ordem de execução — medida em 2026-08-09, não presumida:
      // `transformTags` roda **antes** da filtragem de esquema. Confiando só em
      // `allowedSchemes`, `<a href="javascript:...">` chegava aqui com `href`
      // presente, ganhava `rel`/`target`, e só então perdia o `href` — a segunda
      // passagem via uma âncora sem `href` e removia os atributos, quebrando a
      // idempotência que 10c exige (`f(f(x)) !== f(x)`). Pego pelo próprio teste
      // de idempotência.
      attribs: (isHttpsUrl(attribs.href)
        ? {
            href: attribs.href,
            rel: 'ugc nofollow noopener noreferrer',
            target: '_blank',
          }
        : {}) as sanitizeHtml.Attributes,
    }),
  },
};

/**
 * `href` que a política aceita: HTTPS absoluto e nada mais.
 *
 * `URL` em vez de `startsWith('https:')` — comparação estrutural, a mesma regra
 * de 10a. `https:evil` e `HtTpS://` são casos que o prefixo textual erraria em
 * direções opostas: o primeiro passaria sem ser URL navegável, o segundo
 * falharia sendo válido.
 */
function isHttpsUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitiza o `content_html` do comentário legado do `site` — **uma vez, na
 * importação** (requisito 10, T2.5/T2.8).
 *
 * ## Por que uma função separada de `sanitizeUserMarkdown`
 *
 * São problemas opostos. `sanitizeUserMarkdown` **remove todo HTML**
 * (`allowedTags: []`) porque o corpo novo é Markdown e qualquer tag ali é
 * ataque. O legado **é** HTML: descartar tudo transformaria 25 comentários com
 * parágrafo e link em blocos de texto corrido, perdendo a estrutura que o autor
 * escreveu. A política precisa preservar o pouco que existe e recusar o resto.
 *
 * ## Idempotente, pelo mesmo motivo de 10c
 *
 * `f(f(x)) === f(x)`. O conteúdo é gravado sanitizado e a saída ganha defesa
 * adicional na renderização, sem regravar o banco — logo a função roda mais de
 * uma vez sobre o mesmo texto ao longo da vida do dado. Não idempotente, o
 * conteúdo mudaria entre uma passagem e outra, sem erro nenhum. `entities` da
 * entrada não são decodificadas (`decodeEntities: false`), que é o que impede
 * `&lt;b&gt;` digitado em 2018 de virar markup hoje.
 */
export function sanitizeLegacyCommentHtml(input: string): string {
  return sanitizeHtml(input, {
    ...LEGACY_COMMENT_HTML_OPTIONS,
    parser: { decodeEntities: false },
  });
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

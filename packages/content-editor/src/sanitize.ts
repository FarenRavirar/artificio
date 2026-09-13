import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

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
 * O `&` solto recebe o mesmo tratamento, por `protectLooseAmpersands` — ver a
 * nota lá. A versão anterior deste comentário afirmava que escapá-lo era
 * inofensivo "porque o render o exibe como `&`"; medido em 2026-09-04, isso é
 * falso para todo consumidor que não passa por HTML.
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
const LOOSE_AMP = '';

/** Remove sentinela vinda da entrada — ver a nota acima. */
const SENTINEL_RE = /[]/g;

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

/**
 * `&` que **não** abre uma referência de entidade — o que o encoder do
 * `sanitize-html` escaparia para `&amp;`.
 *
 * O casamento cobre as três formas que o encoder reconhece, medidas em
 * 2026-09-04 contra `sanitize-html@2.17.7`: nomeada (`&copy;`, e também
 * `&naoexiste;` — ele não valida contra a tabela), decimal (`&#38;`) e
 * hexadecimal (`&#x26;`). Tudo isso passa intacto e **precisa** continuar
 * passando: é texto que o usuário digitou.
 */
const ENTITY_REFERENCE_RE = /&(?:[a-zA-Z][a-zA-Z\d]*|#\d+|#[xX][\da-fA-F]+);/g;

/**
 * Troca por sentinela o `&` que está **fora** de uma entidade.
 *
 * ## O bug que isto corrige
 *
 * `a & b` era gravado no banco como `a &amp; b`. O comentário que justificava
 * isso dizia que o render exibia `&` de volta — e o render de fato exibe, porque
 * o `markdown-it` repassa a entidade e o browser a pinta. **Mas o dado
 * armazenado está corrompido**, e todo consumidor que não termina em HTML mostra
 * a entidade crua: texto plano (`markdownToPlainText`), `meta description`,
 * e-mail, exportação. O campo de escrita também: o mestre reabria a própria mesa
 * e lia `Dungeons &amp; Dragons` no lugar do que digitou (medido em produção,
 * 2026-09-04). De quebra, cada `&` consumia 5 dos caracteres do limite.
 *
 * ## Por que sentinela, e não desescapar depois
 *
 * Mesma razão de `protectLooseAngleBrackets`: depois do encoder, o `&amp;` que
 * veio de um `&` digitado e o `&amp;` que o usuário escreveu literalmente são
 * **indistinguíveis**. Desfazer o escape na saída converteria o segundo caso a
 * cada passagem, e a função deixaria de ser idempotente — exatamente a regressão
 * da PR #246 descrita em `sanitizeUserMarkdown`. Rodando antes, sobre o texto
 * original, os dois ainda são coisas diferentes.
 */
function protectLooseAmpersands(value: string): string {
  let result = '';
  let lastIndex = 0;

  for (const match of value.matchAll(ENTITY_REFERENCE_RE)) {
    result += value.slice(lastIndex, match.index).split('&').join(LOOSE_AMP);
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  return result + value.slice(lastIndex).split('&').join(LOOSE_AMP);
}

function restoreLooseAmpersands(value: string): string {
  return value.split(LOOSE_AMP).join('&');
}

/** Remove HTML preservando `<`/`>`/`&` soltos como texto. */
function sanitizeMarkdownText(value: string): string {
  return restoreLooseAmpersands(
    restoreLooseAngleBrackets(
      sanitizeHtml(
        protectLooseAmpersands(protectLooseAngleBrackets(value)),
        MARKDOWN_ONLY_OPTIONS,
      ),
    ),
  );
}

// `breaks: true` acompanha o renderizador de `ContentEditor.tsx` — ver a nota
// lá. Aqui a saída vira texto plano, onde `<br>` e `\n` colapsam no mesmo
// espaço; manter a opção alinhada evita que o resumo e a página divirjam no dia
// em que alguém trocar o pipeline de um dos dois.
const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: true,
});

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

/**
 * Política do HTML que o `markdown-it` acabou de produzir (spec 102 T4.2).
 *
 * Parte dos defaults da `sanitize-html` pelo mesmo motivo medido em
 * `LEGACY_COMMENT_HTML_OPTIONS`: eles neutralizam os 10 vetores testados sem
 * configuração, e recortar a lista faria sumir em silêncio marcação legítima.
 * As duas regras próprias são as mesmas, e pela mesma razão — todo link aqui é
 * de terceiro (`rel` contra reverse tabnabbing) e a plataforma é HTTPS-only.
 *
 * O acréscimo é o `<input type="checkbox" disabled>` das task lists, que
 * `renderMarkdown` injeta ao traduzir `- [x]`. Sem ele na allowlist o item de
 * tarefa perderia a caixa e viraria texto solto. `disabled` é obrigatório na
 * saída: a caixa é indicador de estado, não controle — e `type` é limitado a
 * `checkbox` para que nenhum outro tipo de campo entre por aqui.
 */
/**
 * `href` que o markdown renderizado aceita, e se é de terceiro.
 *
 * `null` = não navega, o `href` sai. Três formas passam, e só elas:
 *
 * - **HTTPS absoluto** — link externo, ganha `rel`/`target`.
 * - **`mailto:`** — está em `allowedSchemes` e é uso legítimo em bio/descrição.
 *   Tratado como externo: abrir cliente de e-mail tira o leitor da página.
 * - **root-relative (`/rota`)** — link interno da plataforma, sem `target`.
 *
 * Fica de fora, de propósito: `http:` (a plataforma é HTTPS-only), relativo sem
 * barra inicial (`../admin` depende da rota do leitor, não do autor) e
 * protocol-relative (`//evil.example`, que o navegador resolve como externo).
 *
 * `//` é testado ANTES do `URL`: `new URL('//x', base)` resolveria para host
 * externo em vez de caminho — a armadilha que `commentLinks.test.ts:86-89` já
 * registra como `protocol_relative`.
 */
function classificarHrefRenderizado(
  value: string | undefined,
): { href: string; externo: boolean } | null {
  if (!value) return null;
  const v = value.trim();
  if (v === '') return null;

  // Barra invertida conta como barra no parser WHATWG: `/\evil.example` e
  // `/%2fevil.example` são protocol-relative disfarçado (mesmos casos do teste).
  if (/^[/\\]{2}/.test(v) || /^\/%2f/i.test(v)) return null;
  if (v.startsWith('/')) return { href: v, externo: false };

  try {
    const url = new URL(v);
    if (url.protocol === 'https:') return { href: v, externo: true };
    if (url.protocol === 'mailto:') return { href: v, externo: true };
    return null;
  } catch {
    return null; // relativo sem barra, âncora vazia, lixo
  }
}

const RENDERED_MARKDOWN_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'input'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'rel', 'target'],
    li: ['class'],
    input: ['type', 'disabled', 'checked'],
  },
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  disallowedTagsMode: 'discard',
  // Mantém o `selfClosing` default da lib (`index.js:1030`): esvaziá-lo faz a
  // `sanitize-html` FECHAR os void elements (`<input ...></input>`), que é HTML
  // inválido — medido. A forma `<br />` que ela emite é XHTML, mas o parser HTML
  // do navegador a trata como `<br>`, então a árvore reidratada é a mesma.
  transformTags: {
    // `a` PRÓPRIO, e não o de `LEGACY_COMMENT_HTML_OPTIONS`: aquele usa
    // `isHttpsUrl`, que exige HTTPS **absoluto**, e apaga o `href` de tudo mais.
    // Reusá-lo aqui destruía `[b](/rota)` — âncora sem navegação — e `mailto:`,
    // apesar de os dois estarem em `allowedSchemes` logo acima. O legado sanitiza
    // comentário importado do WordPress, onde só existe link externo absoluto;
    // este caminho é o markdown de TODOS os apps, onde link interno é a norma
    // (`commentLinks.test.ts:108-113` define `/material/123` como válido e
    // `:169` afirma o mesmo de `[b](/rota)`). Achado do Codex (P2) na PR #317.
    //
    // O esquema é checado aqui, e não só por `allowedSchemes`, pela ordem de
    // execução medida em 2026-08-09: `transformTags` roda ANTES da filtragem de
    // esquema, então `javascript:` chegaria com `href` presente, ganharia
    // `rel`/`target`, e só depois perderia o `href` — quebrando a idempotência.
    a: (tagName, attribs) => {
      const destino = classificarHrefRenderizado(attribs.href);
      if (destino === null) return { tagName, attribs: {} };
      // Link interno não é de terceiro: `target="_blank"` arrancaria o leitor da
      // SPA e `rel="ugc nofollow"` pediria ao buscador para não seguir a própria
      // plataforma. Externo mantém as duas proteções (reverse tabnabbing + UGC).
      return destino.externo
        ? {
            tagName,
            attribs: {
              href: destino.href,
              rel: 'ugc nofollow noopener noreferrer',
              target: '_blank',
            } as sanitizeHtml.Attributes,
          }
        : { tagName, attribs: { href: destino.href } as sanitizeHtml.Attributes };
    },
    // Só a caixa de tarefa passa; qualquer outro `<input>` é descartado — é a
    // diferença entre indicador de estado e campo de formulário em UGC.
    //
    // `disabled`/`checked` saem com valor vazio para casar com o que o DOM
    // produz para atributo booleano; `disabled="disabled"` seria outra diferença
    // de hidratação pelo mesmo motivo do `selfClosing`.
    input: (tagName, attribs) =>
      attribs.type === 'checkbox'
        ? { tagName, attribs: { type: 'checkbox', disabled: '', ...(attribs.checked === undefined ? {} : { checked: '' }) } }
        : { tagName: '', attribs: {} },
  },
};

/**
 * `DOMPurify` ligado a um DOM que existe nos dois ambientes.
 *
 * No browser é o `window` real. No servidor o import devolve uma fábrica não
 * ligada — `TypeError: DOMPurify.sanitize is not a function`, que respondeu
 * `500` em `/mesas/<slug>` no SSR —, então a fábrica recebe uma janela do
 * `jsdom`. É por isso que `jsdom` é `dependencies` e não `devDependencies`
 * neste pacote: sai no bundle de produção de quem renderiza no servidor.
 *
 * Criada UMA vez, no módulo: `new JSDOM()` por chamada custa caro num caminho
 * que roda a cada render de comentário.
 *
 * `globalThis.window` e não `typeof window`: sob SSR o segundo dá `undefined`
 * e cairia no ramo certo, mas o primeiro também cobre ambiente de teste que
 * injeta `window` parcial.
 */
const purify = (() => {
  const janela = (globalThis as { window?: unknown }).window;
  if (janela && typeof (janela as { document?: unknown }).document === 'object') {
    return createDOMPurify(janela as unknown as Parameters<typeof createDOMPurify>[0]);
  }
  return createDOMPurify(new JSDOM('').window as unknown as Parameters<typeof createDOMPurify>[0]);
})();

/**
 * Sanitiza o HTML já renderizado pelo `markdown-it` — o caminho do SSR.
 *
 * DUAS camadas, e a ordem importa:
 *
 * 1. `sanitize-html` aplica a POLÍTICA — quais tags passam, o `<input>` de task
 *    list, e o `transformTags.a` que decide destino de link (HTTPS e `mailto:`
 *    como externos com `rel`/`target`; root-relative como interno sem `target`).
 *    Essa parte o DOMPurify não faz: ele não reescreve atributo por regra de
 *    negócio.
 * 2. `DOMPurify` fecha como camada final, que é o que o `AGENTS.md` exige para
 *    HTML de usuário/rich-text. Não é redundância: ele sanitiza pelo DOM real,
 *    então pega o que um sanitizador de string erra — mutation XSS, namespace
 *    de SVG/MathML, e entidade que só vira tag depois do parse do navegador.
 *
 * `ALLOWED_*` repete a allowlist da camada 1 de propósito: se o DOMPurify usasse
 * o default dele, seria mais permissivo que a política e a segunda passagem
 * devolveria tag que a primeira tinha removido.
 *
 * Sem o pré-passo de sentinela de `sanitizeUserMarkdown`, pelo mesmo motivo já
 * documentado em `markdownToPlainText`: aqui a entrada é HTML gerado pelo
 * renderizador, onde toda tag é estrutura real e o `<` do usuário já foi
 * escapado antes.
 */
export function sanitizeRenderedMarkdown(html: string): string {
  const opcoes = { ...RENDERED_MARKDOWN_OPTIONS, parser: { decodeEntities: false } };
  const pelaPolitica = sanitizeHtml(html, opcoes);
  const peloDom = purify.sanitize(pelaPolitica, {
    ALLOWED_TAGS: RENDERED_MARKDOWN_OPTIONS.allowedTags as string[],
    ALLOWED_ATTR: ['href', 'rel', 'target', 'class', 'type', 'disabled', 'checked'],
    // SEM `ALLOWED_URI_REGEXP`. Medido em 2026-09-13: o DOMPurify aplica esse
    // regex a TODO atributo que considera URI-like, não só ao `href` — com ele,
    // `target="_blank"` e `type="checkbox"` reprovam e são REMOVIDOS. O default
    // já aceita `https:` e `mailto:`, e quem decide destino de link é o
    // `transformTags.a` da camada 1.
  });
  // Terceira passagem, e não é redundância: o DOMPurify normaliza a
  // serialização (`<br />` vira `<br>`, `disabled` vira `disabled=""`), e essa
  // forma foi escolhida de propósito para a hidratação — HTML do servidor
  // diferente do HTML do cliente faz o React DESCARTAR o do servidor, que é
  // justamente o conteúdo que o crawler precisa ler (o objetivo da spec 102).
  // Devolver o passo final à `sanitize-html` restaura a forma sem reabrir nada:
  // ela só re-serializa uma árvore que o DOMPurify já limpou.
  return sanitizeHtml(peloDom, opcoes);
}

/**
 * Desfaz **só o escape do `&`** no texto plano — não o de `<`/`>`.
 *
 * O `&` é o único cujo escape é visível como defeito: `a & b` chegava ao leitor
 * como `a &amp; b` no resumo e na `meta description`.
 *
 * `&lt;`/`&gt;` ficam de fora **de propósito**, e a tentação de incluí-los foi
 * medida em 2026-09-04: decodificá-los quebra a idempotência que
 * `sanitizeUserMarkdown` exige. `&lt;script&gt;alert(1)&lt;/script&gt;` — texto
 * legítimo, alguém explicando uma tag — virava `<script>alert(1)</script>` na
 * primeira passagem e **string vazia** na segunda, porque aí o sanitizador o lê
 * como tag de verdade. O conteúdo do usuário desapareceria sem erro nenhum.
 *
 * Entidade tipográfica (`&copy;`, `&nbsp;`) não precisa de tratamento: o
 * `markdown-it` já a converte no caractere real antes deste ponto — medido,
 * `&copy; z` chega como `© z`.
 */
const PLAIN_TEXT_AMPERSAND_RE = /&(?:amp|#38);/g;

function decodeHtmlEntities(value: string): string {
  return value.replace(PLAIN_TEXT_AMPERSAND_RE, '&');
}

export function markdownToPlainText(value: string, maxLength?: number): string {
  const rendered = markdownRenderer.render(sanitizeUserMarkdown(value));
  // `sanitizeHtml` direto, **sem** o pré-passo de sentinela: aqui a entrada é
  // HTML produzido pelo `markdown-it`, onde toda tag é estrutura real e todo
  // `&gt;` remanescente foi escapado pelo renderizador — não é texto do usuário
  // que precise sobreviver. Proteger `<`/`>` neste ponto impediria a remoção das
  // próprias tags que se quer descartar para chegar ao texto puro.
  //
  // `decodeHtmlEntities` fecha o caminho: a saída daqui é TEXTO PLANO (resumo,
  // `meta description`, prévia de listagem), e nada mais vai interpretar
  // entidade depois deste ponto. Sem ele, `a & b` chegava ao usuário como
  // `a &amp; b` — o `markdown-it` escapa o `&` ao produzir HTML, e nenhuma opção
  // do `sanitize-html` desfaz isso (medido em 2026-09-04: `decodeEntities`
  // true/false e `textFilter` dão o mesmo resultado, porque a opção governa o
  // parser da ENTRADA, não a saída já escapada).
  const plain = decodeHtmlEntities(sanitizeHtml(rendered, MARKDOWN_ONLY_OPTIONS))
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength === undefined || plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trimEnd();
}

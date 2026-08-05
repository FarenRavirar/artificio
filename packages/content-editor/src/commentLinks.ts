/**
 * T2.5b (spec 090) — perfil de comentário e política de link.
 *
 * Vive em módulo próprio, não em `sanitize.ts`, por dois motivos: `sanitize.ts` é
 * consumido por ~50 arquivos de `downloads` e `mesas` que não têm nada a ver com
 * comentário, e este módulo precisa ser importável pelo backend — `index.ts`
 * importa CSS e arrastaria React para a árvore do servidor.
 *
 * `accounts.` e os frontends importam a **mesma** política (decisão 29 proíbe
 * implementação local por app): o cliente usa para erro imediato e prévia, o
 * backend repete como **autoridade final**.
 */

/** Código estável de erro. Decisão 29 exige um único código, não mensagem livre. */
export const INVALID_COMMENT_LINK = 'INVALID_COMMENT_LINK';

/** Host confiável do produto. Subdomínio real abre na mesma aba. */
const TRUSTED_HOST = 'artificiorpg.com';

export interface CommentLinkViolation {
  code: typeof INVALID_COMMENT_LINK;
  /** Regra violada, para a mensagem do consumidor. Nunca ecoa o payload hostil. */
  rule:
    | 'scheme_not_https'
    | 'protocol_relative'
    | 'relative_not_rooted'
    | 'malformed_url'
    | 'embedded_credentials'
    /** Corpo acima de `MAX_SCAN_LENGTH`; recusado sem varrer. */
    | 'input_too_large';
  /** Índice do destino no texto original, para o editor posicionar o erro. */
  offset: number;
}

export interface CommentLinkResolution {
  /** Destino canônico (sempre `https://` ou caminho iniciado em `/`). */
  href: string;
  /** `true` quando o host é `artificiorpg.com` ou subdomínio real dele. */
  internal: boolean;
  /** Caminho root-relative que o consumidor resolve contra a origem confiável. */
  rootRelative: boolean;
}

/**
 * Compara host de forma **estrutural**, nunca por `includes`/sufixo frouxo.
 *
 * `host.endsWith('artificiorpg.com')` aceitaria `artificiorpg.com.evil.example`
 * — o atacante controla o domínio inteiro e o link sairia marcado como interno,
 * abrindo na mesma aba sem `noopener`. A comparação exige igualdade exata ou um
 * ponto imediatamente antes do domínio.
 */
export function isTrustedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === TRUSTED_HOST || host.endsWith(`.${TRUSTED_HOST}`);
}

/**
 * Resolve o destino de um link de comentário, ou devolve a violação.
 *
 * Regras (decisões 26–29):
 * - `https://` é aceito;
 * - URL sem esquema (`exemplo.com/x`) é canonicalizada para `https://`;
 * - `http:` e qualquer outro esquema explícito são **rejeitados**, nunca
 *   promovidos silenciosamente — promover esconderia do autor que o link que ele
 *   escreveu não é o que será publicado;
 * - `/rota` é root-relative e o consumidor a resolve contra a origem derivada de
 *   `source_app`, **nunca** contra host vindo do comentário;
 * - `//host`, `../` e relativo sem `/` inicial são ambíguos e recusados.
 */
export function resolveCommentLink(
  destination: string,
  offset = 0,
): CommentLinkResolution | CommentLinkViolation {
  const raw = destination.trim();

  if (raw === '') {
    return { code: INVALID_COMMENT_LINK, rule: 'malformed_url', offset };
  }

  // `//host/x` herda o esquema da página. Num contexto HTTPS resolveria para
  // `https://host`, mas a forma é ambígua e o autor não declarou destino algum —
  // recusar é mais honesto que adivinhar.
  if (raw.startsWith('//')) {
    return { code: INVALID_COMMENT_LINK, rule: 'protocol_relative', offset };
  }

  if (raw.startsWith('/')) {
    // Root-relative: o consumidor resolve contra a origem confiável de
    // `source_app`. `/\` e `/%2f` seriam lidos como protocol-relative por alguns
    // parsers, então normalizamos antes de aceitar.
    if (raw.startsWith('/\\') || raw.toLowerCase().startsWith('/%2f')) {
      return { code: INVALID_COMMENT_LINK, rule: 'protocol_relative', offset };
    }
    return { href: raw, internal: true, rootRelative: true };
  }

  // Separar esquema de "host com porta" exige olhar os dois lados do `:`.
  //
  // `exemplo.com:8443/x` é host com porta e deve canonicalizar para
  // `https://exemplo.com:8443/x`; `javascript:1` é esquema e deve ser recusado.
  // Ambos casam `^[a-z][a-z0-9+.-]*:[0-9]`, então o dígito à direita não basta:
  // exigir também um **ponto** à esquerda, que todo hostname público tem e
  // nenhum esquema registrado usa antes do `:`.
  //
  // A primeira tentativa desta correção usava só `(?![0-9])` e transformava
  // `javascript:1` em `https://javascript:1/` — não era XSS (o resultado é
  // `https:`), mas reescrevia silenciosamente um destino que o autor não pediu,
  // o que a decisão 27 proíbe tanto quanto promover `http:`.
  const looksLikeHostWithPort = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+:[0-9]+(?:[/?#]|$)/i.test(raw);
  const hasExplicitScheme = !looksLikeHostWithPort && /^[a-z][a-z0-9+.-]*:/i.test(raw);

  // Relativo ambíguo (`../x`, `./x`, `..`) precisa parar ANTES da canonicalização.
  // `new URL('https://../admin')` **não lança**: o parser WHATWG aceita `..` como
  // hostname, então o link sairia como externo válido para um host inexistente —
  // e o autor achava que estava escrevendo um caminho relativo. Só `/rota`
  // (tratado acima) tem origem definida.
  if (!hasExplicitScheme && /^\.{1,2}(?:[/\\]|$)/.test(raw)) {
    return { code: INVALID_COMMENT_LINK, rule: 'relative_not_rooted', offset };
  }

  if (hasExplicitScheme && !/^https:/i.test(raw)) {
    // Cobre `http:`, `javascript:`, `data:`, `ftp:`, `mailto:` — todos param aqui.
    // Não promover `http:` para `https:` é deliberado (decisão 27).
    return { code: INVALID_COMMENT_LINK, rule: 'scheme_not_https', offset };
  }

  // Sem esquema: canonicaliza para `https://`. `exemplo.com/x` vira
  // `https://exemplo.com/x`.
  const candidate = hasExplicitScheme ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { code: INVALID_COMMENT_LINK, rule: 'malformed_url', offset };
  }

  if (url.protocol !== 'https:') {
    return { code: INVALID_COMMENT_LINK, rule: 'scheme_not_https', offset };
  }

  // Userinfo na URL (a parte antes do `@` numa URL https) esconde o destino real
  // e é clássico de phishing: o olho lê o começo, o browser vai para o host do
  // fim. Descrito em prosa em vez de exemplo literal porque o TruffleHog trata
  // qualquer `algo@host` numa URI como achado e falharia o `secret-scan`.
  if (url.username !== '' || url.password !== '') {
    return { code: INVALID_COMMENT_LINK, rule: 'embedded_credentials', offset };
  }

  return { href: url.toString(), internal: isTrustedHost(url.hostname), rootRelative: false };
}

/** `true` quando o resultado é violação, não resolução. */
export function isCommentLinkViolation(
  result: CommentLinkResolution | CommentLinkViolation,
): result is CommentLinkViolation {
  return 'code' in result;
}

/**
 * Atributos `rel`/`target` de um link de comentário.
 *
 * `ugc` e `nofollow` em **todo** link de usuário: conteúdo de terceiro não
 * empresta autoridade de SEO ao destino, e sem isso a área de comentários vira
 * alvo de spam de link. `noopener noreferrer` só no externo, onde há
 * `window.opener` a proteger.
 */
export function commentLinkAttributes(resolution: CommentLinkResolution): {
  rel: string;
  target?: '_blank';
} {
  if (resolution.internal) {
    return { rel: 'ugc nofollow' };
  }
  return { rel: 'ugc nofollow noopener noreferrer', target: '_blank' };
}

/**
 * Percorre os links que o CommonMark **reconhece** em `markdown` e devolve a
 * primeira violação, ou `null`.
 *
 * A política de falha é única e compartilhada (decisão 29f): sintaxe incompleta
 * que o parser trata como literal (`[texto](` sem fechar) é aceita e exibida
 * literalmente — não é link, então não há destino a validar. Mas quando o parser
 * **reconhece** um destino que viola a política, a criação ou edição inteira é
 * rejeitada; nunca se remove nem se reescreve o link silenciosamente.
 *
 * A varredura ignora trechos de código: `` `http://x` `` é texto literal, não link.
 */
export function findCommentLinkViolation(markdown: string): CommentLinkViolation | null {
  // Falha fechado acima do teto, sem varrer: entrada desse tamanho já é
  // rejeitada pela validação de 10.000 caracteres da spec, e varrê-la só
  // entregaria a quem escreve o controle do custo da varredura.
  if (markdown.length > MAX_SCAN_LENGTH) {
    return { code: INVALID_COMMENT_LINK, rule: 'input_too_large', offset: 0 };
  }

  for (const { destination, offset } of scanLinkDestinations(markdown)) {
    const result = resolveCommentLink(destination, offset);
    if (isCommentLinkViolation(result)) return result;
  }
  return null;
}

/** Destino reconhecido pelo parser, com posição no texto original. */
interface ScannedDestination {
  destination: string;
  offset: number;
  /** `true` para `![alt](url)` — imagem vira link textual (decisão 26). */
  isImage: boolean;
}

// `[texto](destino)` e `![alt](destino)`, com destino entre `<>` ou nu. Título
// opcional (`"..."`) é descartado: não é destino e não passa pela política.
//
// O rótulo usa **unrolled loop** (`A*(?:B A*)*`) em vez de `(?:A|B)*`.
//
// `(?:[^\]\\]|\\.)*` é alternação ambígua: para cada caractere o motor pode
// tentar dois caminhos, e num rótulo que nunca fecha ele explora ambos —
// super-linear (achado do Sonar). `[^\]\\]*(?:\\[\s\S][^\]\\]*)*` casa o mesmo
// conjunto sem ambiguidade, porque os dois ramos são disjuntos por construção.
//
// Medido em 2026-08-04, `[` repetido até o teto de 12.000: **248ms → 107ms**.
// Em comentário realista os dois custam o mesmo (4ms/100 execuções), então a
// troca não paga nada no caso normal. Continua havendo custo por posição inicial
// (o motor tenta começar em cada `[`), que é inerente a um scanner — por isso a
// proteção contra entrada hostil segue sendo `MAX_SCAN_LENGTH`, não a regex.
const LINK_RE = /(!?)\[[^\]\\]*(?:\\[\s\S][^\]\\]*)*\]\(\s*(<[^>]*>|[^\s)]*)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;

// Autolink do CommonMark: `<https://exemplo.com>`. **Precisa ser varrido.**
// `sanitizeUserMarkdown` preserva essa sintaxe de propósito (`sanitize.ts`), e o
// `markdown-it` a transforma em `<a href="...">`. Sem esta varredura,
// `<http://evil.example>` contornava inteiramente a política HTTPS-only:
// `findCommentLinkViolation` devolvia `null` e o link saía navegável.
// Verificado em 2026-08-04, achado do Codex na PR #242.
const AUTOLINK_RE = /<([a-z][a-z0-9+.-]*:[^\s<>]*)>/gi;

/**
 * Faixas que o CommonMark trata como literal: código inline e bloco cercado.
 * Reusa a mesma ideia de `sanitize.ts` — link dentro de código não é link.
 *
 * **Mantida como uma alternação só, apesar do achado do Sonar** (complexidade 23
 * > 20, super-linearidade). O custo é inerente ao backreference `\1`, que casa a
 * cerca de fechamento com a de abertura e por isso **não admite unrolled loop**
 * como o `LINK_RE`. Medições de 2026-08-04, no teto de 12.000 caracteres:
 *
 * - separar em duas regexes (inline + fence, com filtro de sobreposição):
 *   equivalente em cobertura nos 8 casos testados, mas **2× mais lenta** (98ms
 *   contra 44ms) — duas varreduras completas em vez de uma;
 * - o ramo do fence custa ~0: só-inline dá 47ms, a alternação inteira 46ms. Todo
 *   o custo está no `` (`+)[\s\S]*?\1 ``, que a separação não remove.
 *
 * Em entrada realista são 5ms para 100 execuções. Reescrever para satisfazer a
 * métrica pioraria o que a métrica tenta proteger, então a defesa continua sendo
 * `MAX_SCAN_LENGTH`.
 */
const CODE_SPAN_RE = /(`+)[\s\S]*?\1|^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\2/gm;

/**
 * Teto de varredura. Igual ao limite de `body_markdown` da spec (10.000
 * caracteres), com folga para o texto já canonicalizado.
 *
 * Existe porque `CODE_SPAN_RE` e `LINK_RE` são **quadráticos por posição
 * inicial**: cada `` ` `` ou `[` abre uma tentativa de casamento. Medido em
 * 2026-08-04 (achado do CodeQL na PR #242): 5.000 crases levam 7ms, 10.000 levam
 * 29ms, e 10.000 `[` levam 103ms — 2× a entrada custa 4× o tempo. No teto da
 * spec isso não derruba o processo, mas a validação roda **no request de
 * escrita**, então quem controla o corpo controla o custo. O teto transforma um
 * crescimento quadrático aberto num custo máximo conhecido.
 *
 * Acima do teto, `findCommentLinkViolation` recusa **sem varrer**: entrada que
 * excede o limite já seria rejeitada pela validação de tamanho da spec, então
 * falhar fechado aqui não perde caso legítimo.
 */
const MAX_SCAN_LENGTH = 12_000;

function findCodeRanges(value: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const match of value.matchAll(CODE_SPAN_RE)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function* scanLinkDestinations(markdown: string): Generator<ScannedDestination> {
  const codeRanges = findCodeRanges(markdown);
  const insideCode = (index: number): boolean =>
    codeRanges.some((range) => index >= range.start && index < range.end);

  for (const match of markdown.matchAll(LINK_RE)) {
    if (insideCode(match.index)) continue;

    const rawDestination = match[2] ?? '';
    // `<https://x>` é destino entre delimitadores; as chaves não fazem parte dele.
    const destination = rawDestination.startsWith('<') && rawDestination.endsWith('>')
      ? rawDestination.slice(1, -1)
      : rawDestination;

    // Destino vazio (`[texto]()`) não navega para lugar nenhum e o CommonMark o
    // aceita como link para a própria página. Não é violação de política.
    if (destination === '') continue;

    yield { destination, offset: match.index, isImage: match[1] === '!' };
  }

  // Autolinks (`<https://exemplo.com>`). Varridos por último porque não se
  // sobrepõem à sintaxe inline: `[a](<url>)` já foi consumido acima, e o
  // `insideCode` continua valendo para `` `<http://x>` ``.
  for (const match of markdown.matchAll(AUTOLINK_RE)) {
    if (insideCode(match.index)) continue;

    const destination = match[1] ?? '';
    if (destination === '') continue;

    yield { destination, offset: match.index, isImage: false };
  }
}

/**
 * Converte `![alt](https://...)` em link textual explícito (decisão 26).
 *
 * Imagem em comentário **nunca** é buscada: sem `<img>`, upload, Cloudinary,
 * proxy, preview ou fetch server-side. O motivo é que carregar imagem de host
 * arbitrário entrega o IP e o User-Agent de **todo leitor** ao dono daquele host,
 * transformando um comentário num rastreador — e o requisito de IP desta spec
 * proíbe exatamente esse tipo de vazamento.
 *
 * **Proxy próprio não é a saída, é a mesma proibição.** `spec.md` requisito 10b e
 * a seção "Fora de escopo" listam proxy ao lado de `<img>`. Buscar a imagem no
 * servidor apenas troca o vazamento de IP do leitor por SSRF no backend — e a
 * tentação é concreta, porque `@artificio/media` já expõe `uploadFromUrl`, que faz
 * exatamente esse fetch remoto. Não usar aqui. Liberar preview exige decisão nova
 * do mantenedor, não inferência de quem estiver implementando.
 *
 * O resultado continua Markdown: o pipeline de sanitização e render segue o
 * mesmo, sem caminho paralelo.
 *
 * **Pré-condição do chamador:** rodar `findCommentLinkViolation(markdown)` antes
 * e abortar se houver violação — inclusive `input_too_large`. Esta função **não**
 * valida nada; acima de `MAX_SCAN_LENGTH` ela devolve a entrada **intacta**, sem
 * varrer (mesmo teto, mesma razão de custo quadrático), o que significa que
 * imagem em corpo gigante sairia daqui sem ser rebaixada. Isso é seguro só
 * porque o corpo já foi recusado antes; chamar sem a checagem publica conteúdo
 * não validado.
 */
export function demoteCommentImages(markdown: string): string {
  if (markdown.length > MAX_SCAN_LENGTH) return markdown;

  // Trecho de código fica intacto: `` `![alt](url)` `` é o autor *mostrando* a
  // sintaxe, não usando. Reescrever ali não tinha efeito de segurança (verificado:
  // o render mantém tudo dentro de `<code>`, nenhum `<img>` é emitido), mas
  // alterava silenciosamente o texto de quem escreveu — e a política desta fase é
  // recusar ou preservar, nunca reescrever sem avisar.
  const codeRanges = findCodeRanges(markdown);
  const insideCode = (index: number): boolean =>
    codeRanges.some((range) => index >= range.start && index < range.end);

  // `matchAll` + reconstrução, não `replace` com callback: o segundo grupo do
  // `LINK_RE` pode casar **vazio** e o JS o omite dos argumentos, então a posição
  // do `offset` no callback varia com a entrada — `(whole, bang, dest, offset)`
  // recebe o offset em `dest` quando o destino é vazio. `match.index` é explícito
  // e não depende da aridade.
  let result = '';
  let lastIndex = 0;

  for (const match of markdown.matchAll(LINK_RE)) {
    const whole = match[0];
    const isImage = match[1] === '!';
    const rawDestination = match[2] ?? '';

    result += markdown.slice(lastIndex, match.index);
    lastIndex = match.index + whole.length;

    if (!isImage || insideCode(match.index)) {
      result += whole;
      continue;
    }

    const altMatch = /^!\[((?:[^\]\\]|\\.)*)\]/.exec(whole);
    const alt = altMatch?.[1]?.trim() ?? '';

    // Emite `rawDestination`, **com** os `<>` do autor quando existirem. Remover
    // os delimitadores quebra o destino: `<https://x/um dois.png>` vira
    // `https://x/um dois.png`, que o CommonMark não reconhece como link (o espaço
    // encerra o destino) — verificado no render, o resultado deixava de ser `<a>`.
    // Os `<>` existem exatamente para permitir espaço; a validação em
    // `scanLinkDestinations` já os desconta antes de aplicar a política.
    const label = alt === '' ? 'abrir imagem externa' : `${alt} — abrir imagem externa`;
    result += `[${label}](${rawDestination})`;
  }

  return result + markdown.slice(lastIndex);
}

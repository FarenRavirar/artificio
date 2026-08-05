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
    | 'embedded_credentials';
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

  const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);

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

  // `https://user:senha@host` esconde o destino real atrás do userinfo e é
  // clássico de phishing: o olho lê o começo, o browser vai para o host do fim.
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
const LINK_RE = /(!?)\[(?:[^\]\\]|\\.)*\]\(\s*(<[^>]*>|[^\s)]*)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;

/**
 * Faixas que o CommonMark trata como literal: código inline e bloco cercado.
 * Reusa a mesma ideia de `sanitize.ts` — link dentro de código não é link.
 */
const CODE_SPAN_RE = /(`+)[\s\S]*?\1|^ {0,3}(`{3,}|~{3,})[\s\S]*?^ {0,3}\2/gm;

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
 */
export function demoteCommentImages(markdown: string): string {
  return markdown.replace(LINK_RE, (whole, bang: string, rawDestination: string) => {
    if (bang !== '!') return whole;

    const altMatch = /^!\[((?:[^\]\\]|\\.)*)\]/.exec(whole);
    const alt = altMatch?.[1]?.trim() ?? '';
    const destination = rawDestination.startsWith('<') && rawDestination.endsWith('>')
      ? rawDestination.slice(1, -1)
      : rawDestination;

    const label = alt === '' ? 'abrir imagem externa' : `${alt} — abrir imagem externa`;
    return `[${label}](${destination})`;
  });
}

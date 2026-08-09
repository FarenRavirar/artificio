import {
  LEGACY_COMMENT_SANITIZER_POLICY,
  LEGACY_COMMENT_SANITIZER_VERSION,
  markdownToPlainText,
  sanitizeLegacyCommentHtml,
  sanitizeNullableUserMarkdown,
  sanitizeOptionalUserMarkdown,
  sanitizeUserMarkdown,
} from './sanitize.js';
// A asserção de neutralização no render precisa do renderizador real, não de uma
// reimplementação: é ele que os consumidores usam.
import { renderMarkdown } from './ContentEditor.js';

describe('sanitizeUserMarkdown', () => {
  it.each([
    ['código inline', 'Use `<button>` aqui'],
    ['bloco cercado', '````md\n```html\n<div>x</div>\n```\n````'],
    ['bloco indentado', 'Parágrafo\n\n    <div>linha 1</div>\n    <span>linha 2</span>'],
    ['autolink', 'Veja <https://example.com>'],
  ])('preserva %s', (_case, input) => {
    expect(sanitizeUserMarkdown(input)).toBe(input);
  });

  it('remove HTML executável fora de literais', () => {
    const output = sanitizeUserMarkdown('**Mestre** <script>alert(1)</script><img src=x onerror=alert(2)>');

    expect(output).toContain('**Mestre**');
    expect(output).not.toMatch(/script|onerror|<img|alert\(/i);
  });

  it('não deixa indentação interromper parágrafo CommonMark', () => {
    expect(sanitizeUserMarkdown('Parágrafo\n    <script>alert(1)</script>')).toBe('Parágrafo\n    ');
  });

  it('sanitiza HTML em linha indentada que continua lista ou citação', () => {
    // markdown-it renderiza essas linhas como parágrafo do item, não como
    // <pre><code>, então tratá-las como literal deixava o HTML passar.
    for (const input of [
      '- item\n\n    <img src=x onerror=alert(1)>\n',
      '1. um\n\n    <script>alert(1)</script>\n',
      '> cita\n\n    <script>alert(1)</script>\n',
    ]) {
      expect(sanitizeUserMarkdown(input)).not.toMatch(/<img|<script|onerror=/i);
    }
  });

  it('mantém bloco de código indentado fora de lista como literal', () => {
    expect(sanitizeUserMarkdown('texto\n\n    <div>codigo literal</div>\n'))
      .toBe('texto\n\n    <div>codigo literal</div>\n');
  });

  it('preserva null e undefined', () => {
    expect(sanitizeNullableUserMarkdown(null)).toBeNull();
    expect(sanitizeOptionalUserMarkdown(null)).toBeNull();
    expect(sanitizeOptionalUserMarkdown(undefined)).toBeUndefined();
  });

  it('deriva projeção plana com limite', () => {
    expect(markdownToPlainText('## Título\n\nTexto **forte** e [link](https://example.com).', 25))
      .toBe('Título Texto forte e link');
  });
});

// Achado de 2026-08-07 (spec 090, T2.5): `sanitize-html` escapava `<` e `>` que
// sobreviviam como texto, e `> citação` chegava ao banco como `&gt; citação` —
// que o markdown-it não reconhece como blockquote. Corrigido com
// `parser.decodeEntities: false` + `textFilter`. Estes testes travam as duas
// pontas: a marcação volta a funcionar E a tag real continua removida.
describe('caracteres literais `<` e `>` (correção 2026-08-07)', () => {
  it.each([
    ['citação simples', '> texto citado'],
    ['citação aninhada', '>> aninhado'],
    ['comparação', 'a > b'],
    ['desigualdade nos dois sentidos', '1 < 2 e 3 > 2'],
    ['seta', 'entrada -> saída'],
  ])('preserva %s sem escapar', (_caso, input) => {
    expect(sanitizeUserMarkdown(input)).toBe(input);
  });

  it('citação preservada é reconhecida como blockquote na projeção plana', () => {
    // É o defeito original: com `&gt;` o markdown-it tratava a linha como
    // parágrafo e o marcador vazava para o texto puro.
    expect(markdownToPlainText('> texto citado')).toBe('texto citado');
  });

  it('continua removendo tag executável', () => {
    expect(sanitizeUserMarkdown('<script>alert(1)</script>')).toBe('');
    expect(sanitizeUserMarkdown('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('remove a tag e preserva o `>` literal na mesma entrada', () => {
    expect(sanitizeUserMarkdown('<script>a</script> > citação')).toBe(' > citação');
  });

  it('mantém `&` escapado — desfazê-lo reabriria a ambiguidade de entidade', () => {
    // Trade-off documentado em `MARKDOWN_ONLY_OPTIONS`: `&` escapado é inerte e
    // o render o exibe como `&`; `>` escapado quebrava a citação. Só o segundo
    // foi corrigido.
    expect(sanitizeUserMarkdown('a & b')).toBe('a &amp; b');
  });

  it('entidade da entrada não é decodificada antes do escape', () => {
    // `decodeEntities: false` é o que permite distinguir "entidade que o usuário
    // escreveu" de "escape que nós introduzimos". Sem isso o `textFilter` não
    // teria como fazer a distinção.
    expect(sanitizeUserMarkdown('&amp;lt;x&amp;gt;')).toBe('&amp;lt;x&amp;gt;');
    expect(sanitizeUserMarkdown('entidade &nbsp; e &copy;')).toBe('entidade &nbsp; e &copy;');
  });

  it('entidade digitada pelo usuário NUNCA vira markup', () => {
    // Achado P1 do review da PR #246. Uma tentativa anterior de corrigir o
    // escape convertia `&lt;b&gt;` em `<b>` — transformando texto que o usuário
    // digitou em HTML persistido. O dado precisa continuar inerte por si só.
    expect(sanitizeUserMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(sanitizeUserMarkdown('&lt;b&gt;ok&lt;/b&gt;')).toBe('&lt;b&gt;ok&lt;/b&gt;');
    expect(sanitizeUserMarkdown('&lt;img src=x onerror=alert(1)&gt;'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it.each([
    ['entidade de tag', '&lt;script&gt;alert(1)&lt;/script&gt;'],
    ['entidade de formatação', '&lt;b&gt;ok&lt;/b&gt;'],
    ['tag real removida', '<script>alert(1)</script>'],
    ['tag real com texto ao redor', '<b>x</b> a > b'],
    ['citação', '> citado'],
    ['comparação', 'a > b'],
    ['ampersand', 'a & b'],
    ['código inline', '`<b>ok</b>`'],
    ['entidade dupla', '&amp;lt;x&amp;gt;'],
  ])('é idempotente: %s', (_caso, input) => {
    // Requisito, não elegância: `downloads/routes/comments.ts` persiste a saída
    // (L47) e re-sanitiza na leitura (L65). Não idempotente = conteúdo muda ou
    // some a cada leitura, sem erro nenhum. Foi o defeito P1 da PR #246.
    const uma = sanitizeUserMarkdown(input);
    const duas = sanitizeUserMarkdown(uma);
    const tres = sanitizeUserMarkdown(duas);

    expect(duas).toBe(uma);
    expect(tres).toBe(uma);
  });

  it('projeção plana não produz markup a partir de entidade', () => {
    // `markdownToPlainText` não usa o pré-passo de sentinela — a entrada dele é
    // HTML do markdown-it, não texto do usuário. Este teste trava que a
    // diferença não reabre o P1 por outro caminho.
    // Saída exata, medida: a entidade atravessa intacta. `not.toContain` sozinho
    // passaria também se a função devolvesse string vazia — o que seria perda
    // silenciosa de conteúdo, não proteção.
    expect(markdownToPlainText('&lt;script&gt;x&lt;/script&gt;'))
      .toBe('&lt;script&gt;x&lt;/script&gt;');
  });

  it('sentinela enviada pelo usuário não vira markup (achado PR #246)', () => {
    // As sentinelas do pré-passo são caracteres de uso privado do Unicode.
    // "Não é produzido por teclado" não é "não chega na entrada": colado no
    // corpo, o caractere seria restaurado como `<` e devolveria `<script>`
    // literal a partir de texto que o sanitizador nunca viu como tag.
    const LT = '';
    const GT = '';

    expect(sanitizeUserMarkdown(`${LT}script${GT}alert(1)${LT}/script${GT}`))
      .not.toMatch(/<script/i);
    expect(sanitizeUserMarkdown(`${LT}img src=x onerror=alert(1)${GT}`))
      .not.toMatch(/<img/i);

    // Descartada, não escapada: caractere de uso privado não carrega intenção.
    expect(sanitizeUserMarkdown(`texto ${LT} normal ${GT} fim`)).toBe('texto  normal  fim');
  });

  it('render neutraliza o que sobreviver', () => {
    const armazenado = sanitizeUserMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(renderMarkdown(armazenado)).not.toMatch(/<script/i);
    expect(renderMarkdown(armazenado)).toContain('&lt;script&gt;');
  });
});

/**
 * T2.5 — HTML legado do `site`, sanitizado uma vez na importação.
 *
 * A allowlist são os **defaults da `sanitize-html`** (70 tags, medidas), mais as
 * duas regras que a biblioteca não pode presumir: HTTPS-only e reescrita de
 * `rel`/`target`. O conteúdo real usa apenas `p`, `br` e `a` (25 linhas em prod
 * e em beta, medidas em 2026-08-09), mas a política não se limita a ele — daí
 * os casos de `<strong>`/`<em>`/`<blockquote>`/`<li>` abaixo.
 *
 * (O cabeçalho dizia "a allowlist é `p`/`br`/`a`", descrevendo a configuração
 * anterior à troca pelos defaults — achado de review do CodeRabbit, PR #250.)
 *
 * Estes testes protegem os dois lados: o que o legado **tem** precisa
 * sobreviver, e o que não é seguro precisa morrer mesmo que apareça.
 */
describe('sanitizeLegacyCommentHtml (T2.5)', () => {
  it('preserva a estrutura que o legado realmente usa', () => {
    // Forma exata do dump: parágrafo com link `rel="nofollow ugc"`.
    const legado =
      '<p>Veja <a href="https://exemplo.com/x?a=1&amp;b=2" rel="nofollow ugc">o post</a></p>';
    const saida = sanitizeLegacyCommentHtml(legado);

    expect(saida).toContain('<p>');
    expect(saida).toContain('href="https://exemplo.com/x?a=1&amp;b=2"');
    expect(saida).toContain('o post');
  });

  it('mantém quebra de linha, que o legado usa entre parágrafos', () => {
    expect(sanitizeLegacyCommentHtml('<p>uma<br />duas</p>')).toContain('<br />');
  });

  it.each([
    ['script', '<p>ok</p><script>alert(1)</script>'],
    ['handler inline', '<p onclick="alert(1)">ok</p>'],
    ['img com onerror', '<p>ok</p><img src=x onerror=alert(1)>'],
    ['svg', '<p>ok</p><svg><script>alert(1)</script></svg>'],
    ['mathml', '<p>ok</p><math><mtext><script>alert(1)</script></mtext></math>'],
    ['iframe', '<p>ok</p><iframe src="https://evil.example"></iframe>'],
    ['style', '<p style="position:fixed;top:0">ok</p>'],
    ['form', '<form action="https://evil.example"><input name="x"></form><p>ok</p>'],
  ])('remove %s sem perder o texto legítimo', (_caso, hostil) => {
    const saida = sanitizeLegacyCommentHtml(hostil);

    expect(saida).toContain('ok');
    expect(saida).not.toMatch(/<script|<svg|<math|<iframe|<img|<form|<input|onerror|onclick|style=/i);
  });

  it.each([
    ['javascript:', '<a href="javascript:alert(1)">x</a>'],
    ['data:', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
    ['http:', '<a href="http://exemplo.com">x</a>'],
    ['vbscript:', '<a href="vbscript:msgbox(1)">x</a>'],
  ])('recusa link %s, preservando o texto do link', (_caso, hostil) => {
    // `https` é o único esquema aceito — a mesma regra do comentário novo (10a).
    // Medido em 2026-08-09: o default da `sanitize-html` aceita `http`, `ftp` e
    // `tel`, então esta é uma das duas regras que a lib não cobre sozinha. Nenhum
    // link legado usa `http:`, então nada de real se perde.
    const saida = sanitizeLegacyCommentHtml(hostil);

    expect(saida).not.toMatch(/javascript:|data:|vbscript:|http:\/\//i);
    expect(saida).toContain('x');
    // Sem `href` não sobra atributo de segurança decorando casca: `<a>` sem
    // destino não navega, e `rel`/`target` ali seriam ruído no HTML.
    expect(saida).not.toMatch(/<a[^>]*(rel|target)=/i);
  });

  it('preserva formatação comum que o dump não tem hoje, mas pode ter amanhã', () => {
    // A allowlist são os defaults da lib, não `p`/`br`/`a` recortados. Medido:
    // os defaults barram 10 de 10 vetores testados, então recortar reduziria
    // superfície teórica ao custo de fazer `<strong>` sumir em silêncio no dia
    // em que um comentário legado o tiver.
    const saida = sanitizeLegacyCommentHtml(
      '<blockquote><p><strong>forte</strong> e <em>ênfase</em></p></blockquote><ul><li>item</li></ul>',
    );

    expect(saida).toContain('<strong>forte</strong>');
    expect(saida).toContain('<em>ênfase</em>');
    expect(saida).toContain('<blockquote>');
    expect(saida).toContain('<li>item</li>');
  });

  it('reescreve rel e target em vez de herdar do dump', () => {
    // O WordPress gravou `rel="nofollow ugc"` sem `noopener`/`noreferrer`.
    // Confiar no valor de origem seria deixar dado antigo decidir segurança de
    // saída; 10a exige as quatro palavras no link externo, e todo link legado é
    // externo por definição.
    const saida = sanitizeLegacyCommentHtml(
      '<a href="https://exemplo.com" rel="nofollow ugc" target="_self">x</a>',
    );

    expect(saida).toContain('rel="ugc nofollow noopener noreferrer"');
    expect(saida).toContain('target="_blank"');
    expect(saida).not.toContain('target="_self"');
  });

  it('é idempotente sobre entrada hostil (requisito 10c)', () => {
    // Consumidores sanitizam na escrita **e** de novo na leitura, e o requisito
    // 10 manda proteger a saída "sem regravar o banco" — logo esta função roda
    // várias vezes sobre o mesmo texto. Não idempotente, o conteúdo muda entre
    // passagens sem erro nenhum, que é o defeito da PR #246.
    const casos = [
      '<p>ok</p><script>alert(1)</script>',
      '<a href="https://exemplo.com" rel="nofollow ugc">x</a>',
      '<p>&lt;b&gt;entidade digitada&lt;/b&gt;</p>',
      '<p>a &amp; b &lt; c</p>',
      // Estes três quebraram a idempotência antes da correção de 2026-08-09:
      // `transformTags` roda ANTES da filtragem de esquema, então o `href`
      // hostil ainda estava presente quando os atributos eram injetados. A
      // primeira passagem devolvia `<a rel=... target=...>` sem `href`; a
      // segunda removia os atributos. Por isso a checagem de esquema vive
      // dentro do transform.
      '<a href="javascript:alert(1)">x</a>',
      '<a href="http://exemplo.com">x</a>',
      '<a href="data:text/html,x">x</a>',
    ];

    for (const caso of casos) {
      const uma = sanitizeLegacyCommentHtml(caso);
      expect(sanitizeLegacyCommentHtml(uma)).toBe(uma);
      expect(sanitizeLegacyCommentHtml(sanitizeLegacyCommentHtml(uma))).toBe(uma);
    }
  });

  it('entidade digitada pelo usuário nunca vira markup (requisito 10c)', () => {
    // `&lt;b&gt;` escrito em 2018 é texto, não tag. Decodificar aqui faria a
    // segunda passagem removê-lo como se fosse markup.
    const saida = sanitizeLegacyCommentHtml('<p>&lt;b&gt;negrito literal&lt;/b&gt;</p>');

    expect(saida).toContain('&lt;b&gt;');
    expect(saida).not.toContain('<b>');
  });

  it('política e versão existem para gravar por linha', () => {
    // `migration_006:147-148` guarda os dois. Sem eles não há como saber sob que
    // regra um conteúdo antigo foi limpo, e mudar a política obrigaria a
    // reprocessar tudo.
    expect(LEGACY_COMMENT_SANITIZER_POLICY).toBe('site-comment-html');
    expect(LEGACY_COMMENT_SANITIZER_VERSION).toBe(1);
  });
});

import { markdownToPlainText, sanitizeNullableUserMarkdown, sanitizeOptionalUserMarkdown, sanitizeUserMarkdown } from './sanitize.js';
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

  it('`&lt;script&gt;` digitado sobrevive como texto e o render o neutraliza', () => {
    // Efeito 2 documentado em `MARKDOWN_ONLY_OPTIONS`: o parser não vê tag aqui,
    // então o valor ARMAZENADO passa a conter `<script>` literal. A garantia
    // deixou de ser "o dado é inerte por si só" e passou a ser o render —
    // `markdown-it` com `html: false` escapa, DOMPurify limpa depois.
    const armazenado = sanitizeUserMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(armazenado).toBe('<script>alert(1)</script>');

    // A prova de que é inerte na saída: a projeção plana não executa nada, e o
    // render escapa. Quem consumir estes campos precisa passar por
    // `renderMarkdown`/`MarkdownContent` — injetar cru em `innerHTML` seria XSS.
    expect(renderMarkdown(armazenado)).not.toMatch(/<script/i);
    expect(renderMarkdown(armazenado)).toContain('&lt;script&gt;');
  });
});

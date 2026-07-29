import { markdownToPlainText, sanitizeNullableUserMarkdown, sanitizeOptionalUserMarkdown, sanitizeUserMarkdown } from './sanitize.js';

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

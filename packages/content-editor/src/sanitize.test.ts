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

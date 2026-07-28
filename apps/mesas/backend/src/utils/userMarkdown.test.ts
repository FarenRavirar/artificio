import {
  sanitizeNullableUserMarkdown,
  sanitizeOptionalUserMarkdown,
  sanitizeTableMarkdownFields,
  sanitizeUserMarkdown,
} from './userMarkdown.js';

describe('sanitizeUserMarkdown', () => {
  it('preserva Markdown e remove HTML executável antes da persistência', () => {
    const input = '**Mestre** <script>alert(1)</script><img src=x onerror=alert(2)> [site](https://example.com)';

    const output = sanitizeUserMarkdown(input);

    expect(output).toContain('**Mestre**');
    expect(output).toContain('[site](https://example.com)');
    expect(output).not.toMatch(/script|onerror|<img|alert\(/i);
  });

  it('preserva null e undefined nas fronteiras opcionais', () => {
    expect(sanitizeNullableUserMarkdown(null)).toBeNull();
    expect(sanitizeOptionalUserMarkdown(null)).toBeNull();
    expect(sanitizeOptionalUserMarkdown(undefined)).toBeUndefined();
  });

  it('sanitiza todos os campos Markdown de mesa na leitura defensiva', () => {
    const table = sanitizeTableMarkdownFields({
      id: 'mesa-1',
      description: '<img src=x onerror=alert(1)> **segura**',
      rules_notes: '<script>alert(2)</script>',
      synopsis: null,
    });

    expect(table).toMatchObject({
      id: 'mesa-1',
      description: ' **segura**',
      rules_notes: '',
      synopsis: null,
    });
  });
});

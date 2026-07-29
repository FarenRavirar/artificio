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

  // Achado de review (Codex, P2): sanitizar a FONTE Markdown apagava conteúdo
  // legítimo, e como isso roda na escrita, a perda era permanente. Estes casos
  // falham contra a implementação anterior.
  describe('preserva trechos que o Markdown trata como literais', () => {
    it('mantém HTML dentro de código inline', () => {
      expect(sanitizeUserMarkdown('Use `<button>` aqui')).toBe('Use `<button>` aqui');
    });

    it('mantém HTML dentro de bloco cercado', () => {
      const input = '```html\n<div>x</div>\n```';
      expect(sanitizeUserMarkdown(input)).toBe(input);
    });

    it('mantém bloco cercado com til', () => {
      const input = '~~~\n<span>y</span>\n~~~';
      expect(sanitizeUserMarkdown(input)).toBe(input);
    });

    it('rastreia o comprimento da cerca e não fecha no trio interno', () => {
      const input = '````md\n```html\n<div>x</div>\n```\n````';
      expect(sanitizeUserMarkdown(input)).toBe(input);
    });

    it('aceita fechamento maior que a abertura e indentado até três espaços', () => {
      const input = '  ~~~\n<span>y</span>\n ~~~~';
      expect(sanitizeUserMarkdown(input)).toBe(input);
    });

    it('mantém HTML literal em blocos indentados por espaços ou tab', () => {
      const input = '    <div>espaços</div>\n\t<span>tab</span>\n<script>alert(1)</script>';
      const output = sanitizeUserMarkdown(input);

      expect(output).toContain('    <div>espaços</div>');
      expect(output).toContain('\t<span>tab</span>');
      expect(output).not.toMatch(/script|alert\(/i);
    });

    it('mantém autolink de URL e de e-mail', () => {
      expect(sanitizeUserMarkdown('Veja <https://example.com>')).toBe('Veja <https://example.com>');
      expect(sanitizeUserMarkdown('Contato <mestre@example.com>')).toBe('Contato <mestre@example.com>');
    });

    it('preserva o literal e sanitiza o resto na mesma string', () => {
      const output = sanitizeUserMarkdown('`<b>ok</b>` e <script>alert(1)</script> fim');

      expect(output).toContain('`<b>ok</b>`');
      expect(output).not.toMatch(/script|alert\(/i);
    });
  });

  // A preservação não pode virar rota de fuga: marcador não fechado ou autolink
  // malformado continua sendo texto comum, logo passa pelo sanitizador.
  describe('não abre evasão pelo marcador de literal', () => {
    it('remove script após crase sem fechamento', () => {
      expect(sanitizeUserMarkdown('`<script>alert(1)</script>')).not.toMatch(/script|alert\(/i);
    });

    it('remove script após cerca sem fechamento', () => {
      expect(sanitizeUserMarkdown('```<script>alert(1)</script>')).not.toMatch(/script|alert\(/i);
    });

    it('não trata tag com atributo como autolink', () => {
      expect(sanitizeUserMarkdown('<https://x.com onerror=alert(1)>')).not.toMatch(/onerror/i);
    });

    it('remove img com onerror fora de literal', () => {
      expect(sanitizeUserMarkdown('<img src=x onerror=alert(1)>')).toBe('');
    });
  });

  // Achado de review (nitpick): destino de link perigoso. Esta função sanitiza
  // HTML, não reescreve Markdown — o destino é neutralizado pelo RENDERIZADOR,
  // e é lá que a garantia vive. Medido com markdown-it 14.2 / linkify-it 5.0.2
  // e `html: false` (MarkdownEditor.tsx:15): `javascript:`, `data:` e
  // `vbscript:` NÃO viram `<a href>`, saem como texto literal; `https:` vira
  // link. O teste fixa a fronteira: aqui o texto atravessa intacto, e quebrar a
  // config do renderizador é o que precisa falhar em outro lugar.
  describe('destino de link perigoso é problema do renderizador, não desta função', () => {
    it('não altera o texto de links com esquema perigoso', () => {
      const input = '[x](javascript:alert(1)) [y](vbscript:msgbox(1)) [ok](https://example.com)';

      expect(sanitizeUserMarkdown(input)).toBe(input);
    });

    it('remove HTML executável ainda que disfarçado de link Markdown', () => {
      const output = sanitizeUserMarkdown('[a](https://x.com)<script>alert(1)</script>');

      expect(output).toBe('[a](https://x.com)');
    });
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

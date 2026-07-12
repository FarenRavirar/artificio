import { sanitizeText } from './sanitizeText';

// T7.3 (spec 075) — sanitizeText remove tags/entidades HTML, mantem texto.

describe('sanitizeText', () => {
  it('remove tag script mas preserva o conteudo textual interno (mesmo padrao KEEP_CONTENT do DOMPurify)', () => {
    expect(sanitizeText('<script>alert(1)</script>Olá')).toBe('alert(1)Olá');
  });

  it('remove tag de imagem com onerror', () => {
    expect(sanitizeText('<img src=x onerror="alert(1)">texto')).toBe('texto');
  });

  it('remove entidade HTML', () => {
    expect(sanitizeText('a &lt;b&gt; c &#60;d&#62;')).toBe('a b c d');
  });

  it('preserva texto simples sem alteracao', () => {
    expect(sanitizeText('Texto normal sem tags.')).toBe('Texto normal sem tags.');
  });
});

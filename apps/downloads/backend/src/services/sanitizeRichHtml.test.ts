import { describe, expect, it } from 'vitest';
import { richHtmlToPlainText, sanitizeRichHtml } from './sanitizeRichHtml';

describe('sanitizeRichHtml', () => {
  // Achado CodeQL (github-advanced-security, PR #203): strip de tag em passagem
  // única deixa "<iframe>" sobrar quando a tag é reconstruída por sobreposição.
  it('remove iframe reconstruído por sobreposição de tags', () => {
    const result = sanitizeRichHtml('<ifr<iframe>ame src="https://evil.example">frame</iframe>');

    expect(result).not.toMatch(/<iframe/i);
  });

  it('neutraliza HTML hostil e preserva formatação permitida', () => {
    const result = sanitizeRichHtml(
      '<p onclick="alert(1)" style="color:red"><strong>Seguro</strong></p><script>alert(1)</script><style>body{display:none}</style><iframe src="https://evil.example">frame</iframe><a href="javascript:alert(1)" onclick="alert(1)">hostil</a><a href="https://example.com" style="color:red">externo</a><img src="https://example.com/capa.png" onerror="alert(1)" style="width:999px" alt="Capa"><div>texto preservado</div>',
    );

    expect(result).toContain('<p><strong>Seguro</strong></p>');
    expect(result).toContain('texto preservado');
    expect(result).toContain('frame');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="nofollow noopener noreferrer"');
    expect(result).toContain('<img src="https://example.com/capa.png" alt="Capa">');
    expect(result).not.toMatch(/script|style|iframe|onclick|onerror|javascript:/i);
  });

  it('aceita somente http(s) em links e imagens', () => {
    const result = sanitizeRichHtml('<a href="data:text/html,evil">link</a><img src="vbscript:evil"><a href="http://example.com">http</a>');

    expect(result).not.toContain('data:text');
    expect(result).not.toContain('vbscript:');
    expect(result).toContain('href="http://example.com"');
  });

  // Achado real (review PR #203): DOMPurify.ALLOWED_URI_REGEXP não cobre
  // img[src] neste build — data URI sobrevivia à sanitização sem o hook.
  it('remove src de imagem com data URI', () => {
    const result = sanitizeRichHtml('<img src="data:image/png;base64,AAAA" alt="Capa">');

    expect(result).not.toContain('data:image');
    expect(result).not.toContain('src=');
    expect(result).toContain('alt="Capa"');
  });
});

describe('richHtmlToPlainText', () => {
  // Achado CodeQL (github-advanced-security, PR #203): mesma classe do fix de
  // sanitizeRichHtml — strip de tag em cadeia única deixa resíduo de script.
  it('remove script reconstruído por sobreposição de tags', () => {
    const result = richHtmlToPlainText('<scr<script>ipt>alert(1)</script>texto seguro');

    expect(result).not.toMatch(/<script/i);
    expect(result).toContain('texto seguro');
  });
});

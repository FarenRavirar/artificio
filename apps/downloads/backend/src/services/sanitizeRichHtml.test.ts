import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml } from './sanitizeRichHtml';

describe('sanitizeRichHtml', () => {
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
    expect(result).toContain('<img src="https://example.com/capa.png" alt="Capa" />');
    expect(result).not.toMatch(/script|style|iframe|onclick|onerror|javascript:/i);
  });

  it('aceita somente http(s) em links e imagens', () => {
    const result = sanitizeRichHtml('<a href="data:text/html,evil">link</a><img src="vbscript:evil"><a href="http://example.com">http</a>');

    expect(result).not.toContain('data:text');
    expect(result).not.toContain('vbscript:');
    expect(result).toContain('href="http://example.com"');
  });
});

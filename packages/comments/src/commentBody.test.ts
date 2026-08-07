import { describe, expect, it } from 'vitest';
import {
  COMMENT_BODY_MAX_LENGTH,
  validateCommentBody,
} from './commentBody.js';

/**
 * T2.5 — aceite do corpo do comentário (`contrato-http-v1.md` §3 invariantes 3–5).
 *
 * Cobre a política e a **ordem** em que ela roda. A ordem é o que o contrato
 * fixa explicitamente, e é o que um refactor futuro quebra sem perceber.
 */

describe('limite de 10.000 caracteres (decisão 25)', () => {
  it('aceita corpo exatamente no limite', () => {
    const result = validateCommentBody('a'.repeat(COMMENT_BODY_MAX_LENGTH));
    expect(result.ok).toBe(true);
  });

  it('recusa 10.001 na entrada original, antes do parsing', () => {
    const result = validateCommentBody('a'.repeat(COMMENT_BODY_MAX_LENGTH + 1));
    expect(result).toEqual({ ok: false, code: 'body_too_long' });
  });

  it('nunca trunca — a operação inteira é recusada', () => {
    const result = validateCommentBody('a'.repeat(COMMENT_BODY_MAX_LENGTH + 500));
    expect(result.ok).toBe(false);
    // Sem `bodyMarkdown` no retorno de erro: truncar publicaria, sob o nome do
    // autor, um texto que ele não escreveu.
    expect(result).not.toHaveProperty('bodyMarkdown');
  });
});

describe('conteúdo visível (decisão 30)', () => {
  it('recusa só espaços', () => {
    expect(validateCommentBody('   \n\t  ')).toEqual({ ok: false, code: 'body_empty' });
  });

  it('recusa HTML que sanitiza para vazio', () => {
    expect(validateCommentBody('<script>alert(1)</script>')).toEqual({
      ok: false,
      code: 'body_empty',
    });
  });

  it('recusa separador temático isolado', () => {
    expect(validateCommentBody('---')).toEqual({ ok: false, code: 'body_empty' });
  });

  it('aceita emoji sozinho', () => {
    expect(validateCommentBody('🎲').ok).toBe(true);
  });

  it('aceita bloco de código', () => {
    expect(validateCommentBody('```\nconst x = 1;\n```').ok).toBe(true);
  });

  it('aceita citação', () => {
    expect(validateCommentBody('> texto citado').ok).toBe(true);
  });
});

// A versão anterior destes casos só afirmava `ok: true` — passava mesmo quando a
// marcação era destruída pela sanitização, porque texto escapado também é
// "não vazio". Foi assim que o escape de `>` (corrigido em `content-editor`
// no mesmo dia) passou despercebido: `> citação` virava `&gt; citação`, deixava
// de ser blockquote, e o teste continuava verde.
describe('marcação sobrevive à canonicalização, não só o texto', () => {
  it.each([
    ['citação', '> texto citado'],
    ['citação aninhada', '>> aninhado'],
    ['comparação literal', 'a > b'],
    ['desigualdade', '1 < 2 e 3 > 2'],
    ['bloco de código', '```\nconst x = 1;\n```'],
    ['lista', '- um\n- dois'],
    ['título', '# titulo'],
  ])('preserva %s sem escapar', (_caso, input) => {
    const result = validateCommentBody(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Igualdade, não `toContain`: entidade em qualquer posição é regressão.
    expect(result.bodyMarkdown).toBe(input);
  });

  it('citação continua sendo citação, não parágrafo com marcador literal', () => {
    const result = validateCommentBody('> texto citado');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.bodyMarkdown).not.toContain('&gt;');
    expect(result.bodyMarkdown.startsWith('> ')).toBe(true);
  });
});

describe('links pela política única (decisão 29)', () => {
  it('aceita https', () => {
    const result = validateCommentBody('[guia](https://artificiorpg.com/guia)');
    expect(result.ok).toBe(true);
  });

  it('recusa http explícito', () => {
    const result = validateCommentBody('[x](http://exemplo.com)');
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: 'INVALID_COMMENT_LINK' });
  });

  it('recusa protocol-relative', () => {
    const result = validateCommentBody('[x](//evil.example)');
    expect(result).toMatchObject({ code: 'INVALID_COMMENT_LINK' });
  });

  it('devolve regra e posição, nunca o destino hostil', () => {
    const result = validateCommentBody('[x](http://evil.example/roubar)');
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.violation?.rule).toBe('scheme_not_https');
    expect(typeof result.violation?.offset).toBe('number');
    // O payload hostil não pode voltar na resposta — seria eco de conteúdo
    // controlado pelo atacante num campo que o cliente costuma renderizar.
    expect(JSON.stringify(result)).not.toContain('evil.example');
  });

  it('deixa sintaxe incompleta como texto literal', () => {
    // CommonMark trata `[texto](` como literal; recusar seria recusar texto que
    // nunca virou link.
    expect(validateCommentBody('[texto](').ok).toBe(true);
  });
});

describe('ordem obrigatória: limite antes da varredura de links (§3 item 5)', () => {
  it('corpo longo com link hostil sai como body_too_long, não INVALID_COMMENT_LINK', () => {
    // `MAX_SCAN_LENGTH` do pacote de links é 12.000, mais frouxo que os 10.000
    // do comentário. Com a ordem certa, este corpo nunca chega à varredura.
    const longo = 'a'.repeat(COMMENT_BODY_MAX_LENGTH) + ' [x](http://evil.example)';
    expect(validateCommentBody(longo)).toEqual({ ok: false, code: 'body_too_long' });
  });

  it('input_too_large é inalcançável por esta função', () => {
    // Se esta asserção falhar, a ordem foi invertida — é o sinal que o contrato
    // manda observar, não um caso exótico de entrada.
    const result = validateCommentBody('a'.repeat(13_000));
    expect(result).toEqual({ ok: false, code: 'body_too_long' });
  });
});

describe('corpo canônico devolvido', () => {
  it('devolve Markdown, nunca HTML montado (decisão 24)', () => {
    const result = validateCommentBody('**forte** e *ênfase*');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.bodyMarkdown).toContain('**forte**');
    expect(result.bodyMarkdown).not.toContain('<strong>');
  });
});

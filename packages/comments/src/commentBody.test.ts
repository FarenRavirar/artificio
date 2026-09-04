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

  it('conta pontos de código, não unidades UTF-16 (achado P2, PR #246)', () => {
    // `String.length` conta 2 por emoji, então 5.001 emoji davam 10.002 e eram
    // recusados — enquanto `LENGTH()` do PostgreSQL conta 5.001 e aceitaria.
    // Medido no banco de produção: `length('🎲🎲🎲')` devolve 3.
    const cincoMil = '🎲'.repeat(5_001);
    expect(cincoMil.length).toBe(10_002); // UTF-16 engana
    expect(validateCommentBody(cincoMil).ok).toBe(true);

    expect(validateCommentBody('🎲'.repeat(COMMENT_BODY_MAX_LENGTH + 1)))
      .toEqual({ ok: false, code: 'body_too_long' });
  });

  it('corpo fora do BMP acima do teto de varredura sai como body_too_long', () => {
    // O contrato afirma que `input_too_large` é inalcançável por esta rota. Vale
    // para ASCII e NÃO vale fora do BMP: 10.000 emoji são 10.000 pontos de
    // código (dentro do limite) e 20.000 unidades UTF-16 (acima do teto de
    // varredura de 12.000). Sem a checagem própria, o usuário receberia
    // `INVALID_COMMENT_LINK` num corpo que não tem link nenhum.
    const result = validateCommentBody('🎲'.repeat(COMMENT_BODY_MAX_LENGTH));
    expect(result).toEqual({ ok: false, code: 'body_too_long' });
  });

  it('a canonicalização não faz o corpo crescer — e a segunda checagem vigia isso', () => {
    // Este teste MUDOU DE ALVO em 2026-09-04, e o motivo importa.
    //
    // Antes ele afirmava que `&` virava `&amp;` e estourava o limite: cinco
    // caracteres onde havia um. Isso deixou de acontecer quando
    // `protectLooseAmpersands` passou a preservar o `&` solto — o escape
    // corrompia o dado armazenado para todo consumidor que não termina em HTML
    // (texto plano, meta description, e-mail, e o próprio campo de escrita).
    //
    // Com `<`, `>` e `&` todos preservados, NENHUMA entrada conhecida cresce na
    // canonicalização. Medido: `>`×10.000 sai `body_empty` (não tem conteúdo
    // visível), e texto misturado com `<`, `>`, `&`, aspas e apóstrofo sai do
    // mesmo tamanho que entrou.
    //
    // A segunda checagem CONTINUA no código, e de propósito: ela é a defesa
    // contra uma regra de canonicalização futura que volte a expandir. O que
    // este teste vigia agora é a premissa — se algum caractere voltar a crescer,
    // ele falha e obriga a decidir conscientemente.
    for (const amostra of ['>', '<', '&', '"', "'"]) {
      const entrada = ('a' + amostra).repeat(COMMENT_BODY_MAX_LENGTH / 2);
      const result = validateCommentBody(entrada) as {
        ok: boolean;
        bodyMarkdown?: string;
      };

      expect(result.ok).toBe(true);
      expect(result.bodyMarkdown?.length).toBeLessThanOrEqual(COMMENT_BODY_MAX_LENGTH);
    }
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

describe('@menção continua texto comum (T2.6b, decisão 31)', () => {
  it.each([
    ['menção simples', 'obrigado @ana'],
    ['menção de papel', 'chama o @admin aqui'],
    ['conta inexistente', '@ninguem_com_esse_nome respondeu'],
    ['e-mail, que parece menção', 'escreve para fulano@exemplo.com'],
    ['arroba solta', 'preço @ 10 reais'],
    ['menção dentro de código', '`@ana`'],
  ])('preserva %s sem resolver conta', (_caso, input) => {
    // Decisão 31: `accounts.users` **não tem handle público único** — nome
    // Google é mutável e não único, e-mail não pode ser exposto. Resolver
    // menção por heurística sobre nome notificaria a pessoa errada, que é pior
    // que não notificar ninguém.
    //
    // Igualdade exata, e não `toContain('@')`: o defeito a barrar é o `@ana`
    // virar link, entidade ou marcador interno — todos passariam num
    // `toContain`.
    const result = validateCommentBody(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.bodyMarkdown).toBe(input);
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

  it('rebaixa imagem remota para link textual antes de persistir (decisão 26)', () => {
    const result = validateCommentBody('![mapa](https://evil.example/rastreio.png)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.bodyMarkdown).toBe(
      '[mapa — abrir imagem externa](https://evil.example/rastreio.png)',
    );
    expect(result.bodyMarkdown).not.toContain('![');
  });
});

import { describe, expect, it } from 'vitest';
import { acceptsTypeScript7 } from './check-typescript-7-readiness.mjs';

/**
 * A decisão que este teste protege é a única do script que não depende da rede:
 * dado o range de `peerDependencies.typescript` publicado pelo typescript-eslint,
 * ele aceita ou não alguma release 7.x?
 *
 * O custo de errar é assimétrico e está descrito no próprio script: um falso
 * BLOQUEADO custa rodar o comando de novo no mês seguinte; um falso DESTRAVADO
 * manda migrar o monorepo e quebra o lint type-aware de 12 pacotes. Uma versão
 * anterior lia só o teto do range, e por isso `>=8.0.0 <9.0.0` respondia "aceita"
 * — o `<9` passava na checagem de major e o `>=8`, que exclui todo o 7.x, era
 * ignorado (achado de review, PR #243).
 */
describe('acceptsTypeScript7', () => {
  describe('recusa ranges sem nenhuma release 7.x', () => {
    it.for([
      ['>=4.8.4 <6.0.0', 'teto no 6: nenhuma release 7.x cabe'],
      ['>=4.8.4 <7.0.0', 'teto no 7 exclusivo: 7.0.0 já fica de fora'],
      ['>=6.0.0 <7.0.0', 'piso e teto abaixo do 7'],
      ['>=9.0.0', 'piso no 9, sem teto'],
      ['>=6.0.0 <7.0.0 || >=8.0.0 <9.0.0', 'nenhuma das alternativas cobre o 7.x'],
    ])('%s — %s', ([range]) => {
      expect(acceptsTypeScript7(range)).toBe(false);
    });

    it('>=8.0.0 <9.0.0 — piso no 8 exclui o 7.x mesmo com teto alto', () => {
      // A regressão exata. Antes do fix devolvia `true`, e o script teria dito
      // DESTRAVADO num ecossistema que pulou o 7 inteiro.
      expect(acceptsTypeScript7('>=8.0.0 <9.0.0')).toBe(false);
    });

    it('>=7.5.0 <=7.2.0 — intervalo vazio não aceita release nenhuma', () => {
      // Comparar só o major dava `true` aqui: o piso caía em 7 e o teto também,
      // sem notar que o teto é MENOR que o piso (achado de review, PR #243).
      expect(acceptsTypeScript7('>=7.5.0 <=7.2.0')).toBe(false);
    });
  });

  describe('aceita ranges que comportam alguma release 7.x', () => {
    it.for([
      ['>=4.8.4 <8.0.0', 'faixa larga inclui todo o 7.x'],
      ['>=6.0.0 <8.0.0', 'faixa inclui todo o 7.x'],
      ['>=7.0.0 <8.0.0', 'exatamente o 7.x'],
      ['>=4.8.4 <=7.2.0', 'teto inclusivo dentro do 7.x'],
      ['>=7.0.0', 'piso no 7, sem teto'],
      ['^7.0.0', 'caret no 7'],
      ['>=6.0.0 <7.0.0 || >=7.5.0 <8.0.0', 'a segunda alternativa cobre'],
    ])('%s — %s', ([range]) => {
      expect(acceptsTypeScript7(range)).toBe(true);
    });

    it.for([
      ['>=7.5.0 <7.6.0', 'faixa estreita dentro do 7.x'],
      ['>=7.0.0 <7.0.1', 'faixa de um patch só'],
    ])('%s — %s', ([range]) => {
      // Comparar só o major devolvia `false` nestes: piso e teto empatavam em 7
      // e o teto não era "maior que 7" (achado de review, PR #243).
      expect(acceptsTypeScript7(range)).toBe(true);
    });
  });

  describe('entrada ausente ou inesperada não vira DESTRAVADO', () => {
    // O `npm view` pode devolver vazio, `null` ou um formato que ninguém previu.
    // Em todos os casos a resposta correta é "não aceita": conservador por
    // desenho, porque o erro caro é o falso positivo.
    it.for([[''], [null], [undefined], [42], [{}], [[]], ['qualquer coisa']])(
      '%o',
      ([range]) => {
        expect(acceptsTypeScript7(range)).toBe(false);
      },
    );
  });
});

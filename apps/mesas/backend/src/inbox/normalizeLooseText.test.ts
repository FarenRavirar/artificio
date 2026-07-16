import { describe, expect, it } from 'vitest';
import { normalizeLooseText } from './normalizeLooseText';

describe('normalizeLooseText (spec 079, requisito 1)', () => {
  it('quebra labels grudados numa linha corrida', () => {
    const input = 'Sistema: Próprio Data: A definir Vagas: 4 jogadores';
    const out = normalizeLooseText(input);
    expect(out).toBe('Sistema: Próprio\nData: A definir\nVagas: 4 jogadores');
  });

  it('não quebra texto livre com palavra-label dentro de frase sem ":" (teste negativo)', () => {
    const input = 'O sistema de vigilância os observava com atenção.';
    expect(normalizeLooseText(input)).toBe(input);
  });

  it('idempotente em texto já bem formatado (um label por linha)', () => {
    const input = 'Sistema: D&D 5e\nVagas: 4\nMestre: João';
    expect(normalizeLooseText(input)).toBe(input);
  });

  it('não quebra quando há só um ":" na linha, mesmo com palavra-label no meio (achado real: "Regras da Mesa:" não vira "Regras da\\nMesa:")', () => {
    const input = '▬ Regras da Mesa: Respeito mútuo, diversão e companheirismo.';
    expect(normalizeLooseText(input)).toBe(input);
  });

  it('não quebra frase livre que menciona "mesa" no meio, sem ":" (achado real: "conflite com a mesa, ele também...")', () => {
    const input = 'Caso a agenda do jogador conflite com a mesa, ele também poderá ser removido.';
    expect(normalizeLooseText(input)).toBe(input);
  });

  it('quebra múltiplos labels grudados, incluindo label de 2 palavras (achado real: "Data e Hora")', () => {
    const input = 'Sistema: Próprio Estilo: fantasia medieval Vagas: 4';
    const out = normalizeLooseText(input);
    expect(out).toBe('Sistema: Próprio\nEstilo: fantasia medieval\nVagas: 4');
  });
});

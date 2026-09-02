import { describe, expect, it } from 'vitest';
import { normalizeDiscordEmojis } from '../parseDiscordAnnouncement.js';

/**
 * Regional Indicator: par = bandeira, isolado = capitular (achado CodeRabbit, spec 099).
 *
 * O codigo convertia TODOS, contradizendo o proprio comentario da funcao: "mesa 🇧🇷"
 * virava "mesa BR". A capitular precisa continuar funcionando, entao nao da para
 * simplesmente parar de converter.
 */
describe('stripRegionalIndicators (via normalizeDiscordEmojis)', () => {
  it('PAR e bandeira e fica intacto', () => {
    expect(normalizeDiscordEmojis('Mesa 🇧🇷 online')).toBe('Mesa 🇧🇷 online');
  });

  it('indicador ISOLADO vira a letra (capitular)', () => {
    // U+1F1EA = 'E'. Uso real: capitular no inicio do paragrafo.
    expect(normalizeDiscordEmojis('🇪ra uma vez')).toBe('Era uma vez');
  });

  it('tres seguidos: o par vira bandeira, o terceiro vira letra', () => {
    // Ordem importa — a regex tenta o par primeiro, da esquerda para a direita.
    expect(normalizeDiscordEmojis('🇧🇷🇦')).toBe('🇧🇷A');
  });

  it('bandeiras separadas por texto continuam ambas intactas', () => {
    expect(normalizeDiscordEmojis('🇧🇷 e 🇵🇹')).toBe('🇧🇷 e 🇵🇹');
  });

  it('texto sem indicador nenhum passa inalterado', () => {
    expect(normalizeDiscordEmojis('Mesa de D&D as 20h')).toBe('Mesa de D&D as 20h');
  });
});

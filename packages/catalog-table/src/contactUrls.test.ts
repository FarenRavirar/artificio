import { describe, it, expect } from 'vitest';
import { toWhatsAppUrl } from './contactUrls.js';

/**
 * O que estes testes travam é a regra de QUEM já tem código de país.
 *
 * Decidir isso pelo prefixo `55` quebra o DDD 55, que é real (Santa Maria e
 * Passo Fundo, região central do RS): `(55) 99999-9999` tem 11 dígitos, era
 * lido como já prefixado, e saía `wa.me/55999999999` — número de 11 dígitos sem
 * país, que abre conversa errada ou nenhuma. Nada falhava em log.
 *
 * A regra correta é o comprimento: 10-11 dígitos é local brasileiro (fixo ou
 * celular com DDD), 12-13 já traz o país. Achado do CodeRabbit na PR #319.
 */
describe('toWhatsAppUrl — código de país por comprimento, não por prefixo', () => {
  it('DDD 55 local recebe o prefixo do país, e não é confundido com ele', () => {
    // O caso que o `startsWith('55')` quebrava.
    expect(toWhatsAppUrl('(55) 99999-9999')).toBe('https://wa.me/5555999999999');
  });

  it('DDD 55 em telefone fixo (10 dígitos) também recebe o prefixo', () => {
    expect(toWhatsAppUrl('(55) 3222-1234')).toBe('https://wa.me/555532221234');
  });

  it('número brasileiro já com país (13 dígitos) não é prefixado de novo', () => {
    expect(toWhatsAppUrl('5511999999999')).toBe('https://wa.me/5511999999999');
  });

  it('número brasileiro já com país em DDD 55 (13 dígitos) permanece intacto', () => {
    expect(toWhatsAppUrl('5555999999999')).toBe('https://wa.me/5555999999999');
  });

  it('celular local comum recebe o 55', () => {
    expect(toWhatsAppUrl('(11) 99999-9999')).toBe('https://wa.me/5511999999999');
  });

  it('o + explícito manda, mesmo em número curto de outro país', () => {
    // Sem isto, `+14155552671` (EUA) virava `wa.me/5514155552671` e abria
    // conversa com outra pessoa.
    expect(toWhatsAppUrl('+14155552671')).toBe('https://wa.me/14155552671');
  });

  it('rejeita o que não tem DDD + número', () => {
    expect(toWhatsAppUrl('123')).toBeNull();
    expect(toWhatsAppUrl('99999999999999')).toBeNull();
    expect(toWhatsAppUrl('')).toBeNull();
    expect(toWhatsAppUrl(null)).toBeNull();
    expect(toWhatsAppUrl(undefined)).toBeNull();
  });
});

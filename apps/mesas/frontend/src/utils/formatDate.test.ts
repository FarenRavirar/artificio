import { describe, it, expect } from 'vitest';
import { formatarDataLonga, formatarDataCurta, TIMEZONE_PRODUTO } from './formatDate';

/**
 * O que estes testes protegem não é o formato — é a INDEPENDÊNCIA do fuso do
 * ambiente. Sob SSR o mesmo código roda no Node do servidor e no browser do
 * visitante; se a formatação seguir o fuso local de cada um, o HTML sai com um
 * dia e a hidratação calcula outro para timestamp perto da virada.
 *
 * O caso que expõe isso é o de sempre: `03:00Z` é ainda o dia anterior em
 * São Paulo (UTC−3), e seria o dia seguinte em Tóquio. Fixando o fuso, os dois
 * lados concordam. Achado do Codex (P2) na PR #319.
 */
describe('formatDate — fuso fixo do produto', () => {
  const meiaNoiteUtc = new Date('2026-09-14T02:00:00.000Z');

  it('usa America/Sao_Paulo, o mesmo fuso que o backend aplica', () => {
    expect(TIMEZONE_PRODUTO).toBe('America/Sao_Paulo');
  });

  it('02:00Z ainda é o dia 13 em São Paulo, não o 14 do UTC', () => {
    // Sem `timeZone`, um servidor em UTC renderizaria "14" e o visitante
    // brasileiro hidrataria "13" — React descarta o HTML do servidor.
    expect(formatarDataCurta(meiaNoiteUtc)).toBe('13/09/2026');
    expect(formatarDataLonga(meiaNoiteUtc)).toContain('13');
    expect(formatarDataLonga(meiaNoiteUtc)).toContain('setembro');
  });

  it('aceita string ISO, que é a forma como a API entrega', () => {
    expect(formatarDataCurta('2026-09-14T02:00:00.000Z')).toBe('13/09/2026');
  });

  it('data inválida vira string vazia, não "Invalid Date" no HTML', () => {
    expect(formatarDataCurta('nao-e-data')).toBe('');
    expect(formatarDataLonga(new Date(NaN))).toBe('');
  });
});

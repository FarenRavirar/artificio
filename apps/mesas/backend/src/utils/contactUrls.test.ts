import { describe, expect, it } from 'vitest';
import { isResolvableUrl } from './contactUrls.js';

describe('isResolvableUrl', () => {
  it('aceita endereço com host alcançável', () => {
    expect(isResolvableUrl('https://forms.gle/abc')).toBe(true);
    expect(isResolvableUrl('forms.gle/abc')).toBe(true);
    expect(isResolvableUrl('https://sub.exemplo.com.br/inscricao')).toBe(true);
  });

  it('recusa identificador solto que canonicalizaria para host morto', () => {
    // Valores reais de produção (3 mesas ativas): o parser do Discord jogou o
    // nick do mestre no campo de URL e `https://uwill/` só produz erro de DNS.
    expect(isResolvableUrl('uwill')).toBe(false);
    expect(isResolvableUrl('.zero9899')).toBe(false);
    expect(isResolvableUrl('kauarang')).toBe(false);
  });

  it('recusa host sem TLD alfabético ou malformado', () => {
    expect(isResolvableUrl('localhost')).toBe(false);
    expect(isResolvableUrl('https://192.168.0.1/x')).toBe(false);
    expect(isResolvableUrl('exemplo.')).toBe(false);
    expect(isResolvableUrl('-exemplo.com')).toBe(false);
  });

  it('recusa o que canonicalizeHttpsUrl já rejeita', () => {
    expect(isResolvableUrl('javascript:alert(1)')).toBe(false);
    expect(isResolvableUrl('http://exemplo.com')).toBe(false);
    expect(isResolvableUrl('')).toBe(false);
    expect(isResolvableUrl(null)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { resolveSubTab } from './moderacaoSubTabs';

// Cobre o refactor que substituiu duas cadeias de `if` duplicadas (initializer do
// useState + efeito de sincronia com a URL) por uma função derivada de
// SUB_TAB_CONTENT. Achado real (review PR #280, coderabbit, nitpick).
describe('resolveSubTab — sub-abas de /gestao/mesas', () => {
  it('aceita cada sub-aba válida, inclusive "mesas" (R5/R6, spec 093)', () => {
    for (const value of ['mensagens', 'rascunhos', 'duplicatas', 'descartados', 'mesas']) {
      expect(resolveSubTab(value)).toBe(value);
    }
  });

  it('cai em "rascunhos" para param ausente, vazio ou desconhecido', () => {
    expect(resolveSubTab(undefined)).toBe('rascunhos');
    expect(resolveSubTab('')).toBe('rascunhos');
    expect(resolveSubTab('tables')).toBe('rascunhos');
    expect(resolveSubTab('__proto__')).toBe('rascunhos');
  });
});

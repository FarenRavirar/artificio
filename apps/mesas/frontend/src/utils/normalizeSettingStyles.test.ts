import { describe, expect, it } from 'vitest';
import { normalizeSettingStyles } from './normalizeSettingStyles';

// Espelho de apps/mesas/backend/src/discord/__tests__/normalizeSettingStyles.test.ts
// — a regra R19 (spec 093) é a mesma nos dois lados; não divergir.
describe('normalizeSettingStyles (R19, spec 093)', () => {
  it('capitaliza cada palavra (não só a primeira)', () => {
    expect(normalizeSettingStyles(['dark fantasy', 'alta fantasia'])).toEqual(['Dark Fantasy', 'Alta Fantasia']);
  });

  it('preserva preposição interna em minúsculo', () => {
    expect(normalizeSettingStyles(['fatia de vida', 'combate entre exércitos'])).toEqual(['Fatia de Vida', 'Combate entre Exércitos']);
  });

  it('remove pontuação terminal e converte para minúsculo antes de capitalizar', () => {
    expect(normalizeSettingStyles(['Exploração.', 'Macabro.', 'SOBREVIVÊNCIA'])).toEqual(['Exploração', 'Macabro', 'Sobrevivência']);
  });

  it('devolve null para entrada vazia ou nula', () => {
    expect(normalizeSettingStyles(null)).toBeNull();
    expect(normalizeSettingStyles(undefined)).toBeNull();
    expect(normalizeSettingStyles([])).toBeNull();
    expect(normalizeSettingStyles(['', '  ', '.'])).toBeNull();
  });
});

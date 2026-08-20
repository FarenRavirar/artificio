import { describe, expect, it } from 'vitest';
import { normalizeSettingStyles } from './normalizeSettingStyles.js';

// R19 (spec 093): forma canônica da migration_152 — capitalizar cada palavra,
// preservar preposição interna, remover pontuação terminal.
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

  it('preserva camelCase interno (não achata maiúscula interna)', () => {
    expect(normalizeSettingStyles(['MegaDungeon', 'Sci-Fi', 'Super-Herói'])).toEqual(['MegaDungeon', 'Sci-Fi', 'Super-Herói']);
  });

  it('rebaixa preposição inglesa interna', () => {
    expect(normalizeSettingStyles(['slice of life', 'dungeons and dragons'])).toEqual(['Slice of Life', 'Dungeons and Dragons']);
  });

  // Achado real (review PR #280, codex, P2): sem dedup no normalizador o backfill
  // da migration_160 regride na proxima escrita e o chip conta a mesma mesa 2x.
  it('deduplica apos normalizar, preservando ordem de primeira ocorrencia', () => {
    expect(normalizeSettingStyles(['exploração', 'Exploração'])).toEqual(['Exploração']);
    expect(normalizeSettingStyles(['Terror', 'Aventura', 'terror.'])).toEqual(['Terror', 'Aventura']);
  });

  // Achado real (review PR #280, coderabbit, inline): a lista de typos de acento
  // vivia so na migration_160. Regra que existe num caminho e nao no outro faz a
  // escrita reproduzir o valor que o backfill acabou de limpar.
  it('corrige typo de acento, alinhado a migration_160', () => {
    expect(normalizeSettingStyles(['politica', 'Politico'])).toEqual(['Política', 'Político']);
    expect(normalizeSettingStyles(['intriga politica'])).toEqual(['Intriga Política']);
  });

  it('devolve null para entrada vazia ou nula', () => {
    expect(normalizeSettingStyles(null)).toBeNull();
    expect(normalizeSettingStyles(undefined)).toBeNull();
    expect(normalizeSettingStyles([])).toBeNull();
    expect(normalizeSettingStyles(['', '  ', '.'])).toBeNull();
  });
});

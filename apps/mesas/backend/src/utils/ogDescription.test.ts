import { describe, it, expect } from 'vitest';
import { buildTableDescription, buildGmDescription } from './ogDescription.js';

const baseTable = {
  listing_excerpt: null as string | null,
  synopsis_narrative: null as string | null,
  synopsis: null as string | null,
  description: null as string | null,
  title: 'Idade das Trevas',
  system_name: 'Vampiro: A Máscara' as string | null,
  gm_display_name: 'Lorenzo' as string | null,
};

describe('buildTableDescription', () => {
  it('synopsis só-whitespace cai para description (bug OG medido em produção)', () => {
    const result = buildTableDescription({
      ...baseTable,
      synopsis: '\n',
      description: 'Uma crônica gótica nas colinas da Toscana.',
    });

    expect(result).toBe('Uma crônica gótica nas colinas da Toscana.');
  });

  it('todos os candidatos em branco e description vazio caem para o fallback de título', () => {
    const result = buildTableDescription({
      ...baseTable,
      listing_excerpt: '   ',
      synopsis_narrative: '\n\n',
      synopsis: '\t',
      description: '',
    });

    expect(result).toBe('Idade das Trevas — Vampiro: A Máscara — mestrada por Lorenzo');
  });

  it('descrição longa corta em 200 caracteres com reticências', () => {
    const result = buildTableDescription({
      ...baseTable,
      description: 'palavra '.repeat(100), // 800 caracteres
    });

    expect(result).toHaveLength(200);
    expect(result.endsWith('…')).toBe(true);
  });

  it('campo de maior prioridade com conteúdo vence (ordem preservada)', () => {
    const result = buildTableDescription({
      ...baseTable,
      listing_excerpt: 'Resumo curto para a listagem.',
      synopsis_narrative: 'Narrativa completa da crônica.',
      synopsis: 'Sinopse.',
      description: 'Descrição longa da mesa.',
    });

    expect(result).toBe('Resumo curto para a listagem.');
  });
});

describe('buildGmDescription', () => {
  it('tagline em branco cai para bio_long', () => {
    const result = buildGmDescription({
      tagline: '   ',
      bioLong: 'Mestre veterano de Vampiro desde os anos 90.',
      displayName: 'Lorenzo',
      siteName: 'Artifício Mesas',
    });

    expect(result).toBe('Mestre veterano de Vampiro desde os anos 90.');
  });

  it('tagline e bio_long em branco caem para o fallback de perfil', () => {
    const result = buildGmDescription({
      tagline: '\n',
      bioLong: null,
      displayName: 'Lorenzo',
      siteName: 'Artifício Mesas',
    });

    expect(result).toBe(
      'Conheça o perfil do mestre Lorenzo e descubra suas mesas ativas no Artifício Mesas.',
    );
  });
});

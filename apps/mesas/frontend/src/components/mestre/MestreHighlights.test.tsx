// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreHighlights } from './MestreHighlights';
import type { MestrePublicData } from '../../hooks/useMestre';

/**
 * Exibição de specialties/languages/badges na página pública (spec 099, B3/C2).
 *
 * Antes desta seção os três eram órfãos de exibição na página (`badges` nunca
 * renderizou em lugar nenhum; specialties/languages viviam como chips dentro
 * do `MestreBio`, movidos para cá para não duplicar). Só renderiza quando há
 * dado, e cada grupo só aparece se tiver conteúdo.
 */

function fakeProfile(overrides: Partial<MestrePublicData> = {}): MestrePublicData {
  return {
    id: 'm1',
    slug: 'mestre-teste',
    display_name: 'Mestre Teste',
    bio_long: null,
    avatar_url: null,
    avatar_crop_data: null,
    avatar_width: null,
    avatar_height: null,
    banner_url: null,
    banner_crop_data: null,
    banner_width: null,
    banner_height: null,
    languages: [],
    specialties: [],
    badges: [],
    avg_rating: null,
    reviews_count: 0,
    tables_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    tables: [],
    ...overrides,
  };
}

describe('MestreHighlights', () => {
  it('não renderiza nada quando os três grupos estão vazios', () => {
    const { container } = render(<MestreHighlights profile={fakeProfile()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renderiza os três grupos com rótulo e chips', () => {
    render(
      <MestreHighlights
        profile={fakeProfile({
          specialties: ['Horror', 'Intriga política'],
          languages: ['Português', 'Inglês'],
          badges: ['Streamer'],
        })}
      />,
    );
    expect(screen.getByText('Especialidades')).toBeTruthy();
    expect(screen.getByText('Horror')).toBeTruthy();
    expect(screen.getByText('Intriga política')).toBeTruthy();
    expect(screen.getByText('Idiomas')).toBeTruthy();
    expect(screen.getByText('Português')).toBeTruthy();
    expect(screen.getByText('Inglês')).toBeTruthy();
    expect(screen.getByText('Selos')).toBeTruthy();
    expect(screen.getByText('Streamer')).toBeTruthy();
  });

  it('só renderiza o grupo que tem dado', () => {
    render(<MestreHighlights profile={fakeProfile({ badges: ['Autor de aventuras'] })} />);
    expect(screen.getByText('Selos')).toBeTruthy();
    expect(screen.getByText('Autor de aventuras')).toBeTruthy();
    expect(screen.queryByText('Especialidades')).toBeNull();
    expect(screen.queryByText('Idiomas')).toBeNull();
  });

  it('trata payload sujo (não-array) como grupo vazio, sem quebrar', () => {
    const profile = fakeProfile() as unknown as Record<string, unknown>;
    profile.specialties = { a: 1 };
    profile.languages = 'português';
    profile.badges = null;
    const { container } = render(
      <MestreHighlights profile={profile as unknown as MestrePublicData} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

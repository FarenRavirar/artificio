// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreBio } from './MestreBio';
import type { MestrePublicData } from '../../hooks/useMestre';

/**
 * Bio na página pública (spec 099, B3/C2).
 *
 * Em 2026-08-31 os chips de especialidades/idiomas saíram daqui para a seção
 * própria `MestreHighlights` (os três grupos juntos, sem duplicar na página).
 * Estes testes travam o contrato novo: bio não renderiza os chips, e a seção
 * só aparece quando há bio ou tagline.
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

describe('MestreBio', () => {
  it('renderiza bio e tagline quando presentes', () => {
    render(
      <MestreBio
        profile={fakeProfile({ bio_long: 'Texto da bio.', tagline: 'Aventuras épicas' })}
      />,
    );
    expect(screen.getByText('Texto da bio.')).toBeTruthy();
    expect(screen.getByText('"Aventuras épicas"')).toBeTruthy();
  });

  it('não renderiza chips de especialidades/idiomas (moveram para MestreHighlights)', () => {
    render(
      <MestreBio
        profile={fakeProfile({
          bio_long: 'Texto da bio.',
          specialties: ['Horror'],
          languages: ['Português'],
        })}
      />,
    );
    expect(screen.queryByText('Especialidades')).toBeNull();
    expect(screen.queryByText('Idiomas')).toBeNull();
    expect(screen.queryByText('Horror')).toBeNull();
  });

  it('não renderiza nada quando só há specialties/languages (sem bio nem tagline)', () => {
    const { container } = render(
      <MestreBio
        profile={fakeProfile({ specialties: ['Horror'], languages: ['Português'] })}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});

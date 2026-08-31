// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreBio } from './MestreBio';
import { makeMestreProfile } from '../../test/mestreFixtures';

/**
 * Bio na página pública (spec 099, B3/C2).
 *
 * Em 2026-08-31 os chips de especialidades/idiomas saíram daqui para a seção
 * própria `MestreHighlights` (os três grupos juntos, sem duplicar na página).
 * Estes testes travam o contrato novo: bio não renderiza os chips, e a seção
 * só aparece quando há bio ou tagline.
 */


describe('MestreBio', () => {
  it('renderiza bio e tagline quando presentes', () => {
    render(
      <MestreBio
        profile={makeMestreProfile({ bio_long: 'Texto da bio.', tagline: 'Aventuras épicas' })}
      />,
    );
    expect(screen.getByText('Texto da bio.')).toBeTruthy();
    expect(screen.getByText('"Aventuras épicas"')).toBeTruthy();
  });

  it('não renderiza chips de especialidades/idiomas (moveram para MestreHighlights)', () => {
    render(
      <MestreBio
        profile={makeMestreProfile({
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
        profile={makeMestreProfile({ specialties: ['Horror'], languages: ['Português'] })}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});

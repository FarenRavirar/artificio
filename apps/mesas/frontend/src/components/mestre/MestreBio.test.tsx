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
 * Em 2026-09-04 a `tagline` saiu pelo MESMO motivo (spec 100): ela é o `<h1>`
 * do hero, e aparecia de novo aqui 665px abaixo — medido em beta.
 *
 * Estes testes travam o contrato: a bio não renderiza chips nem slogan, e a
 * seção só existe quando há BIO — só slogan não a faz aparecer.
 */


describe('MestreBio', () => {
  it('renderiza a bio, e NÃO repete o slogan que já é o h1 do hero', () => {
    render(
      <MestreBio
        profile={makeMestreProfile({ bio_long: 'Texto da bio.', tagline: 'Aventuras épicas' })}
      />,
    );
    expect(screen.getByText('Texto da bio.')).toBeTruthy();
    expect(screen.queryByText(/Aventuras épicas/)).toBeNull();
  });

  it('só slogan, sem bio: não renderiza nada — senão a seção sairia vazia', () => {
    const { container } = render(
      <MestreBio profile={makeMestreProfile({ tagline: 'Aventuras épicas' })} />,
    );
    expect(container.innerHTML).toBe('');
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

  it('não renderiza nada quando só há specialties/languages (sem bio)', () => {
    const { container } = render(
      <MestreBio
        profile={makeMestreProfile({ specialties: ['Horror'], languages: ['Português'] })}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});

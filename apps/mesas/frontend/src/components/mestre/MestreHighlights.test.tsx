// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreHighlights } from './MestreHighlights';
import type { MestrePublicData } from '../../hooks/useMestre';
import { makeMestreProfile } from '../../test/mestreFixtures';

/**
 * Exibição de specialties/languages/badges na página pública (spec 099, B3/C2).
 *
 * Antes desta seção os três eram órfãos de exibição na página (`badges` nunca
 * renderizou em lugar nenhum; specialties/languages viviam como chips dentro
 * do `MestreBio`, movidos para cá para não duplicar). Só renderiza quando há
 * dado, e cada grupo só aparece se tiver conteúdo.
 */


describe('MestreHighlights', () => {
  it('não renderiza nada quando os três grupos estão vazios', () => {
    const { container } = render(<MestreHighlights profile={makeMestreProfile()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renderiza os três grupos com rótulo e chips', () => {
    render(
      <MestreHighlights
        profile={makeMestreProfile({
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
    render(<MestreHighlights profile={makeMestreProfile({ badges: ['Autor de aventuras'] })} />);
    expect(screen.getByText('Selos')).toBeTruthy();
    expect(screen.getByText('Autor de aventuras')).toBeTruthy();
    expect(screen.queryByText('Especialidades')).toBeNull();
    expect(screen.queryByText('Idiomas')).toBeNull();
  });

  it('trata payload sujo (não-array) como grupo vazio, sem quebrar', () => {
    const profile = makeMestreProfile() as unknown as Record<string, unknown>;
    profile.specialties = { a: 1 };
    profile.languages = 'português';
    profile.badges = null;
    const { container } = render(
      <MestreHighlights profile={profile as unknown as MestrePublicData} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

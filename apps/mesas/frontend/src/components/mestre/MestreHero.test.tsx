import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreHero } from './MestreHero';
import { makeMestreProfile } from '../../test/mestreFixtures';

/**
 * Hero do mestre (spec 099): `experience_years` e autodeclarado — icone Medal
 * e rotulo "Declara N+ anos" para nao parecer verificado pela plataforma.
 * So `covil_verified` usa CheckCircle2. Os itens sao distinguidos por
 * `data-testid` (`trust-covil` / `trust-experience`), sem mudanca visual.
 */


describe('MestreHero — verificado vs autodeclarado', () => {
  const profile = makeMestreProfile({ covil_verified: true, experience_years: 14 });

  it('rotula a experiencia como autodeclarada', () => {
    render(<MestreHero profile={profile} mappedTables={[]} totalOpenSlots={0} />);
    expect(screen.getByText('Declara 14+ anos de experiência')).toBeTruthy();
  });

  it('mantem o bloco "Verificado no Covil"', () => {
    render(<MestreHero profile={profile} mappedTables={[]} totalOpenSlots={0} />);
    expect(screen.getByText('Verificado no Covil')).toBeTruthy();
  });

  it('o item de experiencia nao usa CheckCircle2 (usa Medal)', () => {
    render(<MestreHero profile={profile} mappedTables={[]} totalOpenSlots={0} />);
    const experienceItem = screen.getByTestId('trust-experience');
    // CheckCircle2 renderiza com a classe `lucide-circle-check` (lucide-react
    // v1.21: o nome interno do icone e "circle-check").
    expect(experienceItem.querySelector('svg.lucide-circle-check')).toBeNull();
    expect(experienceItem.querySelector('svg.lucide-medal')).not.toBeNull();
  });

  it('o item de covil continua com CheckCircle2', () => {
    render(<MestreHero profile={profile} mappedTables={[]} totalOpenSlots={0} />);
    const covilItem = screen.getByTestId('trust-covil');
    expect(covilItem.querySelector('svg.lucide-circle-check')).not.toBeNull();
  });
});

describe('MestreHero — dobra escrita pelo mestre (spec 099 C1)', () => {
  it('promove a tagline a headline e mantém o nome do mestre visível', () => {
    const profile = makeMestreProfile({
      display_name: 'Mestre Aurora',
      tagline: 'Mistério, escolhas difíceis e personagens que importam',
    });

    render(<MestreHero profile={profile} mappedTables={[]} totalOpenSlots={0} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Mistério, escolhas difíceis e personagens que importam',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Mestre Aurora')).toBeTruthy();
    expect(screen.queryByText(/Viva aventuras com/)).toBeNull();
  });

  it('mantém a headline atual como fallback quando a tagline está vazia', () => {
    const profile = makeMestreProfile({
      display_name: 'Mestre Aurora',
      tagline: '   ',
    });

    render(<MestreHero profile={profile} mappedTables={[]} totalOpenSlots={0} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Viva aventuras com Mestre Aurora' }),
    ).toBeTruthy();
  });

  it('leva para a dobra somente specialties, selling_points e languages', () => {
    const profile = makeMestreProfile({
      specialties: ['Horror', 'Intriga', 'Exploração'],
      selling_points: [
        { icon: 'clock', title: 'Ritmo pontual', description: 'Começa na hora.' },
        { icon: 'heart', title: 'Mesa acolhedora', description: 'Espaço seguro.' },
        { icon: 'book', title: 'Regras claras', description: 'Acordos explícitos.' },
      ],
      languages: ['Português', 'Inglês', 'Espanhol'],
      badges: ['Streamer'],
    });

    render(<MestreHero profile={profile} mappedTables={[]} totalOpenSlots={0} />);

    expect(screen.getByText('Horror')).toBeTruthy();
    expect(screen.getByText('Intriga')).toBeTruthy();
    expect(screen.getByText('Ritmo pontual')).toBeTruthy();
    expect(screen.getByText('Mesa acolhedora')).toBeTruthy();
    expect(screen.getByText('Português')).toBeTruthy();
    expect(screen.getByText('Inglês')).toBeTruthy();

    expect(screen.queryByText('Exploração')).toBeNull();
    expect(screen.queryByText('Regras claras')).toBeNull();
    expect(screen.queryByText('Espanhol')).toBeNull();
    expect(screen.queryByText('Streamer')).toBeNull();
  });
});

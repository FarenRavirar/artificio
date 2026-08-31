import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreHero } from './MestreHero';
import type { MestrePublicData } from '../../hooks/useMestre';

/**
 * Hero do mestre (spec 099): `experience_years` e autodeclarado — icone Medal
 * e rotulo "Declara N+ anos" para nao parecer verificado pela plataforma.
 * So `covil_verified` usa CheckCircle2. Os itens sao distinguidos por
 * `data-testid` (`trust-covil` / `trust-experience`), sem mudanca visual.
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

describe('MestreHero — verificado vs autodeclarado', () => {
  const profile = fakeProfile({ covil_verified: true, experience_years: 14 });

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

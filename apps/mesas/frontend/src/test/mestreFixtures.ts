import type { MestrePublicData } from '../hooks/useMestre';

/**
 * Fixture de `MestrePublicData` para os testes do perfil publico (spec 099).
 *
 * Extraida porque a MESMA funcao estava copiada literalmente em 4 arquivos
 * (`MestreHero`, `MestreBio`, `MestreHighlights`, `useMestre` — hash identico),
 * o que o Sonar acusou como 27-28 linhas duplicadas em cada um. O custo real da
 * copia nao e o Sonar: e o fixture que para de acompanhar o schema. Quando
 * `MestrePublicData` ganha campo, quatro arquivos precisam mudar juntos, e o
 * que fica para tras vira teste passando sobre forma que nao existe mais.
 *
 * Segue o padrao de `catalogFixtures.ts` (`make*` + `overrides`).
 */
export function makeMestreProfile(overrides: Partial<MestrePublicData> = {}): MestrePublicData {
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

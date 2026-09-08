// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MestreSystems } from './MestreSystems';
import { normalizeGmSystems } from '../../hooks/useMestre';

/**
 * Sistemas que o mestre mestra no perfil público (spec 100 F6.3c/F6.3f/D25).
 *
 * O campo gravava em `user_systems` desde sempre e a rota pública nunca
 * consultava a tabela — o mestre preenchia e o visitante não via nada. A ida e
 * volta completa (gravar no editor → aparecer na resposta pública) é coberta no
 * backend; aqui trava-se o lado que renderiza, e a normalização de entrada, que
 * é onde o payload cru chega sem validação.
 */
describe('MestreSystems', () => {
  it('não renderiza nada sem sistema gravado', () => {
    const { container } = render(<MestreSystems systems={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('exibe o nome com a cadeia inteira, não só a folha', () => {
    render(
      <MestreSystems
        systems={[
          { id: 'a', name: 'Dungeons & Dragons 5e 2024' },
          { id: 'b', name: 'Vampiro 5e' },
        ]}
      />,
    );

    expect(screen.getByText('Dungeons & Dragons 5e 2024')).toBeTruthy();
    expect(screen.getByText('Vampiro 5e')).toBeTruthy();
    expect(screen.getByText('Sistemas que eu mestro')).toBeTruthy();
  });

  it('expõe a âncora que a ordem de D25 usa', () => {
    const { container } = render(
      <MestreSystems systems={[{ id: 'a', name: 'Pathfinder 2e' }]} />,
    );
    expect(container.querySelector('#sistemas')).toBeTruthy();
  });
});

describe('normalizeGmSystems', () => {
  it('devolve lista vazia para entrada que não é array', () => {
    // JSONB e payload cru já chegaram como `{}` neste app (achado A1 da 099).
    expect(normalizeGmSystems({})).toEqual([]);
    expect(normalizeGmSystems(null)).toEqual([]);
    expect(normalizeGmSystems(undefined)).toEqual([]);
    expect(normalizeGmSystems('Pathfinder')).toEqual([]);
  });

  it('descarta item sem id ou sem nome utilizável', () => {
    expect(
      normalizeGmSystems([
        { id: 'a', name: 'Pathfinder 2e' },
        { id: '', name: 'Sem id' },
        { id: 'c', name: '   ' },
        { id: 'd' },
        null,
        'texto solto',
      ]),
    ).toEqual([{ id: 'a', name: 'Pathfinder 2e' }]);
  });
});

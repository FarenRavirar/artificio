import { fireEvent, render, screen } from '@testing-library/react';
import { ActiveFilterChips } from './ActiveFilterChips';

// T8.5 (spec 086) — primeiro teste do componente novo (Fase 8): chip some
// quando não há filtro ativo, aparece com label:valor, e clicar chama
// onRemove com a key certa.
describe('ActiveFilterChips', () => {
  it('não renderiza nada quando não há filtro ativo', () => {
    const { container } = render(<ActiveFilterChips filters={[]} onRemove={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra os chips ativos e a linha de resumo', () => {
    render(
      <ActiveFilterChips
        filters={[{ key: 'system_id', label: 'Sistema', value: 'Warhammer' }]}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /remover filtro sistema/i })).toBeInTheDocument();
    expect(screen.getByText('Sistema: Warhammer')).toBeInTheDocument();
  });

  it('chama onRemove com a key do filtro clicado', () => {
    const onRemove = vi.fn();
    render(
      <ActiveFilterChips
        filters={[{ key: 'system_id', label: 'Sistema', value: 'Warhammer' }]}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /remover filtro sistema/i }));

    expect(onRemove).toHaveBeenCalledWith('system_id');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { FilterPills } from './FilterPills';
import * as useCatalogSystemsModule from '../hooks/useCatalogSystems';
import * as useMaterialFacetsModule from '../hooks/useMaterialFacets';

// Spec 087 (T2.3) — pills de filtro do modo vitrine, reusando FilterControls.

function mockFacets() {
  vi.spyOn(useCatalogSystemsModule, 'useCatalogSystems').mockReturnValue({
    data: [
      { id: 'sys-1', name: 'D&D', slug: 'dnd', node_type: 'system', parent_id: null },
      { id: 'ed-1', name: '5ª Edição', slug: '5e', node_type: 'edition', parent_id: 'sys-1' },
    ],
  } as ReturnType<typeof useCatalogSystemsModule.useCatalogSystems>);
  vi.spyOn(useMaterialFacetsModule, 'useMaterialFacets').mockReturnValue({
    data: {
      material_types: [{ id: 'adventure', slug: 'adventure', name: 'Aventura', count: 3 }],
      systems: [{ id: 'sys-1', count: 2 }],
      editions: [{ id: 'ed-1', count: 1 }],
    },
  } as ReturnType<typeof useMaterialFacetsModule.useMaterialFacets>);
}

const EMPTY = { material_type: '', system_id: '', edition_id: '' };

describe('FilterPills', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra uma pill por faceta e abre o popover ao clicar', () => {
    mockFacets();
    render(<FilterPills values={EMPTY} onChange={vi.fn()} activeLabels={{}} />);

    const tipo = screen.getByRole('button', { name: 'Tipo' });
    expect(tipo).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(tipo);
    expect(tipo).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radio', { name: /Aventura/ })).toBeInTheDocument();
  });

  it('aplica o filtro e fecha o popover ao escolher uma opção', () => {
    mockFacets();
    const onChange = vi.fn();
    render(<FilterPills values={EMPTY} onChange={onChange} activeLabels={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tipo' }));
    fireEvent.click(screen.getByRole('radio', { name: /Aventura/ }));

    expect(onChange).toHaveBeenCalledWith('material_type', 'adventure');
    expect(screen.getByRole('button', { name: 'Tipo' })).toHaveAttribute('aria-expanded', 'false');
  });

  // Pill ativa fala o mesmo idioma do chip de busca: mostra o VALOR, nao o
  // rotulo generico. Filtro e busca sao a mesma operacao pro usuario.
  it('pill ativa mostra o valor no lugar do rótulo', () => {
    mockFacets();
    render(
      <FilterPills
        values={{ ...EMPTY, system_id: 'sys-1' }}
        onChange={vi.fn()}
        activeLabels={{ system_id: 'D&D' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Sistema: D&D' })).toBeInTheDocument();
  });

  it('limpa o filtro pelo botão de remover sem abrir o popover', () => {
    mockFacets();
    const onChange = vi.fn();
    render(
      <FilterPills
        values={{ ...EMPTY, system_id: 'sys-1' }}
        onChange={onChange}
        activeLabels={{ system_id: 'D&D' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Sistema' }));

    expect(onChange).toHaveBeenCalledWith('system_id', '');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('fecha o popover com Escape', () => {
    mockFacets();
    render(<FilterPills values={EMPTY} onChange={vi.fn()} activeLabels={{}} />);

    const tipo = screen.getByRole('button', { name: 'Tipo' });
    fireEvent.click(tipo);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(tipo).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha o popover ao clicar fora', () => {
    mockFacets();
    render(<FilterPills values={EMPTY} onChange={vi.fn()} activeLabels={{}} />);

    const tipo = screen.getByRole('button', { name: 'Tipo' });
    fireEvent.click(tipo);
    fireEvent.pointerDown(document.body);

    expect(tipo).toHaveAttribute('aria-expanded', 'false');
  });

  // Fechar por teclado sem devolver o foco joga quem navega por Tab de volta
  // pro inicio do documento.
  it('devolve o foco à pill ao fechar com Escape', () => {
    mockFacets();
    render(<FilterPills values={EMPTY} onChange={vi.fn()} activeLabels={{}} />);

    const tipo = screen.getByRole('button', { name: 'Tipo' });
    fireEvent.click(tipo);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(tipo).toHaveFocus();
  });

  // activeLabels chega depois das facetas; ate la a pill nao pode exibir o UUID
  // que esta no filtro.
  it('não mostra o id cru enquanto o rótulo do valor ativo não chegou', () => {
    mockFacets();
    render(
      <FilterPills
        values={{ ...EMPTY, system_id: 'sys-1' }}
        onChange={vi.fn()}
        activeLabels={{}}
      />,
    );

    expect(screen.queryByRole('button', { name: /sys-1/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sistema: …' })).toBeInTheDocument();
  });
});

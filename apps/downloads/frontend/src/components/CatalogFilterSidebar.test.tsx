import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogFilterSidebar } from './CatalogFilterSidebar';
import * as useMaterialFacetsModule from '../hooks/useMaterialFacets';
import * as useCatalogSystemsModule from '../hooks/useCatalogSystems';

// T8.5 (spec 086) — primeiro teste do componente novo (Fase 8): opções vêm
// só da faceta (nunca hardcoded), clicar uma opção chama onChange, e o
// drawer mobile abre/fecha (D108).

function renderSidebar(onChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onChange,
    ...render(
      <QueryClientProvider client={queryClient}>
        <CatalogFilterSidebar
          values={{ material_type: '', system_id: '', edition_id: '' }}
          onChange={onChange}
        />
      </QueryClientProvider>,
    ),
  };
}

function mockFacets() {
  vi.spyOn(useMaterialFacetsModule, 'useMaterialFacets').mockReturnValue({
    data: {
      material_types: [{ id: 'type-1', slug: 'aventura', name: 'Aventura', count: 3 }],
      systems: [{ id: 'sys-1', count: 2 }],
      editions: [{ id: 'ed-1', count: 1 }],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useMaterialFacetsModule.useMaterialFacets>);
}

function mockSystems() {
  vi.spyOn(useCatalogSystemsModule, 'useCatalogSystems').mockReturnValue({
    data: [
      { id: 'sys-1', name: 'Warhammer', slug: 'warhammer', node_type: 'system' as const, parent_id: null },
      { id: 'ed-1', name: 'Fourth Edition', slug: 'fourth-edition', node_type: 'edition' as const, parent_id: 'sys-1' },
    ],
    isLoading: false,
  } as unknown as ReturnType<typeof useCatalogSystemsModule.useCatalogSystems>);
}

describe('CatalogFilterSidebar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lista as opções vindas da faceta, sem lista hardcoded', () => {
    mockFacets();
    mockSystems();

    renderSidebar();

    expect(screen.getAllByText(/Aventura \(3\)/)).not.toHaveLength(0);
    expect(screen.getAllByText('Warhammer')).not.toHaveLength(0);
    expect(screen.getAllByText('Fourth Edition')).not.toHaveLength(0);
  });

  it('chama onChange ao selecionar um tipo de material', () => {
    mockFacets();
    mockSystems();
    const { onChange } = renderSidebar();

    const [option] = screen.getAllByLabelText(/Aventura \(3\)/);
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('material_type', 'type-1');
  });

  it('abre e fecha o drawer mobile', () => {
    mockFacets();
    mockSystems();

    renderSidebar();

    const openButton = screen.getByRole('button', { name: 'Filtros' });
    fireEvent.click(openButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

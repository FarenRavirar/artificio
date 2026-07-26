import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoMateriaisPage } from './GestaoMateriaisPage';
import * as useMaterialsCatalogModule from '../../hooks/useMaterialsCatalog';
import type { Material } from '../../types/material';

// T4.x (spec 075) — cobertura de teste do débito (páginas sem teste de
// componente): render de loading/lista vazia/lista com itens, rótulo de
// editorial_state e link de auditoria por item.


function makeMaterial(overrides: Partial<Material> = {}): Material {
  return { ...baseMaterial(), ...overrides };
}

function baseMaterial(): Material {
  return {
    id: 'material-1',
    slug: 'manual-do-aventureiro',
    title: 'Manual do Aventureiro',
    summary: null,
    description: null,
    material_type: 'pdf',
    access_kind: 'external_link',
    external_url: 'https://example.com/manual.pdf',
    creator_id: 'creator-1',
    editorial_state: 'published',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };
}

function makeListResponse(items: Material[]) {
  return { items, page: 1, page_size: 20, total: items.length, total_pages: 1 };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/materiais']}>
        <GestaoMateriaisPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockMaterialsCatalog(overrides: Partial<ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>> = {}) {
  vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);
}

describe('GestaoMateriaisPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockMaterialsCatalog({ data: undefined, isLoading: true });

    renderPage();

    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it('renderiza lista vazia sem itens quando não há materiais', () => {
    mockMaterialsCatalog({ data: makeListResponse([]), isLoading: false });

    renderPage();

    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum material encontrado')).toBeInTheDocument();
  });

  it('renderiza a lista de materiais com título, estado editorial e ação de auditoria', () => {
    mockMaterialsCatalog({
      data: makeListResponse([makeMaterial()]),
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('Manual do Aventureiro')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auditoria' })).toBeInTheDocument();
  });

  it('usa o valor bruto de editorial_state quando não há rótulo mapeado', () => {
    mockMaterialsCatalog({
      data: makeListResponse([
        { ...makeMaterial({ id: 'material-2' }), editorial_state: 'unknown_state' as unknown as 'draft' },
      ]),
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('unknown_state')).toBeInTheDocument();
  });
});

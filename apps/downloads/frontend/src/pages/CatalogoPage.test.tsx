import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogoPage } from './CatalogoPage';
import * as useMaterialsCatalogModule from '../hooks/useMaterialsCatalog';
import * as useCatalogSystemsModule from '../hooks/useCatalogSystems';
import * as useMaterialFacetsModule from '../hooks/useMaterialFacets';
import type { Material, MaterialListResponse } from '../types/material';

// T6.2 (spec 073) — busca/filtro/paginacao vivem como contrato unico de URL.


function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    slug: 'material-1',
    title: 'Material 1',
    summary: null,
    description: null,
    material_type: 'adventure',
    access_kind: 'external_link',
    external_url: 'https://example.test/a.pdf',
    creator_id: 'user-1',
    creator_slug: 'criador-1',
    editorial_state: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage(initialEntries: string[] = ['/catalogo']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <CatalogoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Spec 087 (T2.2) — a rota e uma so; o que muda e o MODO. Sem busca e sem
// filtro a pagina apresenta o acervo (prateleiras); com qualquer um dos dois,
// vira lista de resultado paginada.
describe('CatalogoPage — modo vitrine vs. modo resultado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockEmptyList() {
    const response: MaterialListResponse = {
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 1,
    };
    return vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);
  }

  it('sem busca nem filtro, mostra as prateleiras e nenhuma lista paginada', async () => {
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: { items: [makeMaterial()], page: 1, page_size: 20, total: 1, total_pages: 1 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage(['/catalogo']);

    expect(await screen.findByRole('heading', { name: 'Recém adicionados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mais visitados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mais bem avaliados' })).toBeInTheDocument();
    // Paginacao e do modo resultado; na vitrine nao existe.
    expect(screen.queryByRole('button', { name: 'Próxima' })).not.toBeInTheDocument();
  });

  it('desabilita a listagem principal no modo vitrine (nao paga fetch ocioso)', async () => {
    const spy = mockEmptyList();
    renderPage(['/catalogo']);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(expect.anything(), { enabled: false });
    });
  });

  it('trocar so a ordenação continua sendo vitrine, não vira busca vazia', async () => {
    // `sort` deliberadamente NAO entra no calculo de isBrowsing: clicar em
    // "Ver tudo" numa prateleira nao pode parecer um resultado de busca.
    // Prateleira precisa de item pra renderizar (Requisito 16), entao aqui o
    // mock devolve material — com lista vazia a ausencia de cabecalho seria
    // ambigua entre "e vitrine sem item" e "virou modo resultado".
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: { items: [makeMaterial()], page: 1, page_size: 20, total: 1, total_pages: 1 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage(['/catalogo?sort=trending']);

    expect(await screen.findByRole('heading', { name: 'Recém adicionados' })).toBeInTheDocument();
    expect(screen.queryByText(/nenhum material com esses filtros/i)).not.toBeInTheDocument();
  });

  it('com filtro aplicado, vira modo resultado com dropdown de ordenação', async () => {
    mockEmptyList();
    renderPage(['/catalogo?material_type=adventure']);

    expect(await screen.findByLabelText('Ordenar por')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recém adicionados' })).not.toBeInTheDocument();
  });

  it('oferece as ordenações novas de métrica calculada (T2.6)', async () => {
    mockEmptyList();
    renderPage(['/catalogo?q=aventura']);

    const select = await screen.findByLabelText('Ordenar por');
    expect(select).toContainHTML('Mais visitados');
    expect(select).toContainHTML('Mais bem avaliados');
  });
});

describe('CatalogoPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra os materiais retornados pela busca', async () => {
    const response: MaterialListResponse = {
      items: [makeMaterial()],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage(['/catalogo?q=aventura']);

    expect(await screen.findByText('Material 1')).toBeInTheDocument();
  });

  it('mostra mensagem quando nenhum material e encontrado', async () => {
    const response: MaterialListResponse = { items: [], page: 1, page_size: 20, total: 0, total_pages: 1 };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage(['/catalogo?q=inexistente']);

    expect(
      await screen.findByText(/nenhum material com esses filtros/i),
    ).toBeInTheDocument();
  });

  it('atualiza a query string ao digitar na busca', async () => {
    const response: MaterialListResponse = { items: [], page: 1, page_size: 20, total: 0, total_pages: 1 };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage(['/catalogo?q=a']);

    const input = screen.getByPlaceholderText(/buscar por título, autor ou sistema/i);
    fireEvent.change(input, { target: { value: 'aventura' } });

    await waitFor(() => {
      expect(useMaterialsCatalogModule.useMaterialsCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'aventura' }),
        expect.anything(),
      );
    }, { timeout: 1000 });
  });

  // Achado real (review PR #208, CodeRabbit): trocar de sistema sem limpar
  // edition_id deixava a URL com uma edicao de outro sistema presa no filtro.
  it('limpa edition_id ao trocar de sistema selecionado', async () => {
    const response: MaterialListResponse = { items: [], page: 1, page_size: 20, total: 0, total_pages: 1 };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);
    vi.spyOn(useCatalogSystemsModule, 'useCatalogSystems').mockReturnValue({
      data: [
        { id: 'sys-1', name: 'Sistema 1', slug: 'sistema-1', node_type: 'system', parent_id: null },
        { id: 'sys-2', name: 'Sistema 2', slug: 'sistema-2', node_type: 'system', parent_id: null },
        { id: 'ed-1', name: 'Edição 1', slug: 'edicao-1', node_type: 'edition', parent_id: 'sys-1' },
      ],
    } as ReturnType<typeof useCatalogSystemsModule.useCatalogSystems>);
    vi.spyOn(useMaterialFacetsModule, 'useMaterialFacets').mockReturnValue({
      data: {
        material_types: [] as { id: string; slug: string; name: string; count: number }[],
        systems: [{ id: 'sys-1', count: 1 }, { id: 'sys-2', count: 1 }],
        editions: [{ id: 'ed-1', count: 1 }],
      },
    } as ReturnType<typeof useMaterialFacetsModule.useMaterialFacets>);

    renderPage(['/catalogo?system_id=sys-1&edition_id=ed-1']);

    const system2Radio = await screen.findByRole('radio', { name: 'Sistema 2' });
    fireEvent.click(system2Radio);

    await waitFor(() => {
      expect(useMaterialsCatalogModule.useMaterialsCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({ system_id: 'sys-2', edition_id: undefined }),
        expect.anything(),
      );
    }, { timeout: 1000 });
  });
});

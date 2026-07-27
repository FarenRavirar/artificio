import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogoPage } from './CatalogoPage';
import { SobreEUsoPage } from './SobreEUsoPage';
import * as useMaterialsCatalogModule from '../hooks/useMaterialsCatalog';
import * as useCatalogSystemsModule from '../hooks/useCatalogSystems';
import * as useMaterialFacetsModule from '../hooks/useMaterialFacets';
import type { MaterialListResponse } from '../types/material';
import { makeMaterial } from '../test/fixtures';

// T6.2 (spec 073) — busca/filtro/paginacao vivem como contrato unico de URL.


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

  // Achado de review PR #214 (Codex, P1): `sort` explicito na URL e o destino
  // dos links "Ver tudo" das prateleiras. Antes ele nao derrubava a vitrine,
  // entao "Ver tudo" devolvia as mesmas tres prateleiras em vez da lista
  // paginada que promete.
  it('"Ver tudo" de uma prateleira (sort explícito) abre o modo resultado', async () => {
    mockEmptyList();
    renderPage(['/catalogo?sort=trending']);

    expect(await screen.findByLabelText('Ordenar por')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recém adicionados' })).not.toBeInTheDocument();
  });

  // O default de `sort` e 'recent'; o modo tem que sair de haver ou nao o
  // parametro, nunca do valor — senao /catalogo e /catalogo?sort=recent
  // renderizariam igual e "Ver tudo" da prateleira de recentes quebraria.
  it('sort=recent explícito também é modo resultado, apesar de ser o default', async () => {
    mockEmptyList();
    renderPage(['/catalogo?sort=recent']);

    expect(await screen.findByLabelText('Ordenar por')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recém adicionados' })).not.toBeInTheDocument();
  });

  it('sem nenhum parâmetro, segue vitrine e não mostra lista vazia', async () => {
    // Prateleira precisa de item pra renderizar (Requisito 16), entao aqui o
    // mock devolve material — com lista vazia a ausencia de cabecalho seria
    // ambigua entre "e vitrine sem item" e "virou modo resultado".
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: { items: [makeMaterial()], page: 1, page_size: 20, total: 1, total_pages: 1 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage(['/catalogo']);

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

  it('representa o termo da busca como chip removível', async () => {
    const response: MaterialListResponse = { items: [], page: 1, page_size: 20, total: 0, total_pages: 1 };
    vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);

    renderPage(['/catalogo?q=aventura']);

    const chip = await screen.findByRole('button', { name: /remover filtro busca/i });
    expect(chip).toHaveTextContent('aventura');
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /remover filtro busca/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Ordenar por')).not.toBeInTheDocument();
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

// Spec 088 (T0.4) — a canonical e da pagina, nao do app. Estes dois casos
// juntos sao o que impede alguem de "simplificar" movendo a tag pro
// `index.html`: o fallback SPA serve o mesmo HTML pra ficha, painel e gestao,
// e todas herdariam um canonical apontando pro catalogo.
describe('CatalogoPage — canonical', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.head.querySelectorAll('link[rel="canonical"]').forEach((tag) => tag.remove());
  });

  function mockList() {
    const response: MaterialListResponse = { items: [], page: 1, page_size: 20, total: 0, total_pages: 1 };
    return vi.spyOn(useMaterialsCatalogModule, 'useMaterialsCatalog').mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMaterialsCatalogModule.useMaterialsCatalog>);
  }

  function canonicalHrefs(): string[] {
    return Array.from(
      document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'),
    ).map((tag) => tag.href);
  }

  it('declara canonical unica apontando pra raiz', async () => {
    mockList();

    // Ancora no `h1`, presente nos DOIS modos — o dropdown de sort so existe
    // no modo resultado, e sem filtro na URL a pagina abre em modo vitrine.
    renderPage(['/catalogo']);
    await screen.findByRole('heading', { name: 'Catálogo' });

    expect(canonicalHrefs()).toEqual([`${window.location.origin}/`]);
  });

  it('mantem o alvo na raiz mesmo com filtro e paginacao na URL', async () => {
    mockList();

    renderPage(['/catalogo?q=aventura&sort=rating&page=2']);
    await screen.findByLabelText('Ordenar por');

    // Recorte da listagem consolida na raiz — nao aponta pra si mesmo.
    expect(canonicalHrefs()).toEqual([`${window.location.origin}/`]);
  });

  it('rota alheia nao herda a canonical do catalogo', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/sobre']}>
          <SobreEUsoPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(canonicalHrefs()).toEqual([]);
  });
});

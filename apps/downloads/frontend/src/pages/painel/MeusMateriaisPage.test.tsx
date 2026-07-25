import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeusMateriaisPage } from './MeusMateriaisPage';
import * as useMyMaterialsModule from '../../hooks/useMyMaterials';

// Débito (27 páginas sem teste de componente, spec 075): cobre loading,
// lista vazia, lista com estados editoriais traduzidos e link de edição.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

function makeMaterial(overrides: Partial<ReturnType<typeof baseMaterial>> = {}) {
  return { ...baseMaterial(), ...overrides };
}

function baseMaterial() {
  return {
    id: 'material-1',
    title: 'Bestiário Sombrio',
    editorial_state: 'draft',
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/painel/materiais']}>
        <MeusMateriaisPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockMyMaterials(overrides: Partial<ReturnType<typeof useMyMaterialsModule.useMyMaterials>> = {}) {
  vi.spyOn(useMyMaterialsModule, 'useMyMaterials').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useMyMaterialsModule.useMyMaterials>);
}

describe('MeusMateriaisPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockMyMaterials({ data: undefined, isLoading: true });

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há materiais publicados', () => {
    mockMyMaterials({ data: [], isLoading: false });

    renderPage();

    expect(screen.getByText('Você ainda não publicou nenhum material.')).toBeInTheDocument();
  });

  it('renderiza a lista de materiais com título e estado editorial traduzido', () => {
    mockMyMaterials({
      data: [
        makeMaterial({ id: 'material-1', title: 'Bestiário Sombrio', editorial_state: 'draft' }),
        makeMaterial({ id: 'material-2', title: 'Grimório Antigo', editorial_state: 'published' }),
      ],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('Bestiário Sombrio')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Grimório Antigo')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
  });

  it('mostra o estado editorial cru quando não mapeado', () => {
    mockMyMaterials({
      data: [makeMaterial({ editorial_state: 'estado_desconhecido' })],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('estado_desconhecido')).toBeInTheDocument();
  });

  it('link "Novo material" aponta para a rota de criação', () => {
    mockMyMaterials({ data: [], isLoading: false });

    renderPage();

    expect(screen.getByRole('link', { name: 'Novo material' })).toHaveAttribute(
      'href',
      '/painel/materiais/novo',
    );
  });

  it('link de editar aponta para a rota do material', () => {
    mockMyMaterials({ data: [makeMaterial({ id: 'material-9' })], isLoading: false });

    renderPage();

    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/painel/materiais/material-9/editar',
    );
  });
});

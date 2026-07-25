import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisaoGeralPage } from './VisaoGeralPage';
import * as authClientModule from '@artificio/auth/client';
import * as useMyMaterialsModule from '../../hooks/useMyMaterials';

// Débito (27 páginas sem teste de componente) — cobertura de VisaoGeralPage
// (painel do usuário comum, spec 074): saudação com nome do usuário logado
// via useSession, e contadores de materiais por estado editorial.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

function makeMaterial(overrides: Partial<{ editorial_state: string }> = {}) {
  return {
    id: 'material-1',
    slug: 'material-1',
    title: 'Material 1',
    editorial_state: 'published',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/painel']}>
        <VisaoGeralPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockSession(overrides: Partial<ReturnType<typeof authClientModule.useSession>> = {}) {
  vi.spyOn(authClientModule, 'useSession').mockReturnValue({
    user: { id: 'user-1', name: 'Fulano', email: 'fulano@example.com' },
    loading: false,
    ...overrides,
  } as unknown as ReturnType<typeof authClientModule.useSession>);
}

function mockMyMaterials(overrides: Partial<ReturnType<typeof useMyMaterialsModule.useMyMaterials>> = {}) {
  vi.spyOn(useMyMaterialsModule, 'useMyMaterials').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useMyMaterialsModule.useMyMaterials>);
}

describe('VisaoGeralPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saúda o usuário logado pelo nome', () => {
    mockSession();
    mockMyMaterials();

    renderPage();

    expect(screen.getByText('Olá, Fulano')).toBeInTheDocument();
  });

  it('usa "usuário" como fallback quando não há nome', () => {
    mockSession({ user: null });
    mockMyMaterials();

    renderPage();

    expect(screen.getByText('Olá, usuário')).toBeInTheDocument();
  });

  it('mostra zero em todos os contadores quando não há materiais', () => {
    mockSession();
    mockMyMaterials({ data: undefined });

    renderPage();

    expect(screen.getByText('Materiais publicados')).toBeInTheDocument();
    expect(screen.getByText('Em revisão')).toBeInTheDocument();
    expect(screen.getByText('Rascunhos')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('conta materiais por estado editorial', () => {
    mockSession();
    mockMyMaterials({
      data: [
        makeMaterial({ editorial_state: 'published' }),
        makeMaterial({ editorial_state: 'published' }),
        makeMaterial({ editorial_state: 'in_review' }),
        makeMaterial({ editorial_state: 'draft' }),
      ],
    });

    renderPage();

    const published = screen.getByText('Materiais publicados').previousElementSibling;
    const inReview = screen.getByText('Em revisão').previousElementSibling;
    const draft = screen.getByText('Rascunhos').previousElementSibling;

    expect(published).toHaveTextContent('2');
    expect(inReview).toHaveTextContent('1');
    expect(draft).toHaveTextContent('1');
  });
});

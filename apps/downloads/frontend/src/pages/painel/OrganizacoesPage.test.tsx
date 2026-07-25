import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { OrganizacoesPage } from './OrganizacoesPage';
import * as useOrganizationsModule from '../../hooks/useOrganizations';
import type { Organization } from '../../types/panel';

// Débito (27 páginas sem teste de componente) — cobertura de OrganizacoesPage
// (painel do usuário comum, spec 074): lista de organizações do usuário e
// formulário de criação de nova organização.

vi.mock('@artificio/ui', () => ({
  Header: () => <div data-testid="header" />,
  Footer: () => <div data-testid="footer" />,
  useTheme: () => ({ theme: 'dark' }),
  useChangelogBadge: () => ({ hasNewUpdate: false, markSeen: () => undefined }),
  CHANGELOG_UPDATE_MARKERS: { downloads: 'test-marker' },
  DynamicChangelogModal: () => null,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function makeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    slug: 'org-1',
    name: 'Organização 1',
    role: 'member',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/painel/organizacoes']}>
        <OrganizacoesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockUseOrganizations(overrides: Partial<ReturnType<typeof useOrganizationsModule.useOrganizations>> = {}) {
  vi.spyOn(useOrganizationsModule, 'useOrganizations').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useOrganizationsModule.useOrganizations>);
}

function mockUseCreateOrganization(overrides: Partial<ReturnType<typeof useOrganizationsModule.useCreateOrganization>> = {}) {
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(useOrganizationsModule, 'useCreateOrganization').mockReturnValue({
    mutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useOrganizationsModule.useCreateOrganization>);
  return mutateAsync;
}

describe('OrganizacoesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockUseOrganizations({ isLoading: true });
    mockUseCreateOrganization();

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há organizações', () => {
    mockUseOrganizations({ data: [] });
    mockUseCreateOrganization();

    renderPage();

    expect(screen.getByText('Você não participa de nenhuma organização.')).toBeInTheDocument();
  });

  it('lista organizações com papel de membro e administrador', () => {
    mockUseOrganizations({
      data: [
        makeOrganization({ id: 'org-1', name: 'Organização Admin', role: 'admin' }),
        makeOrganization({ id: 'org-2', name: 'Organização Membro', role: 'member' }),
      ],
    });
    mockUseCreateOrganization();

    renderPage();

    expect(screen.getByText('Organização Admin')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Organização Membro')).toBeInTheDocument();
    expect(screen.getByText('Membro')).toBeInTheDocument();
  });

  it('cria organização a partir do nome digitado e limpa o campo', async () => {
    mockUseOrganizations({ data: [] });
    const mutateAsync = mockUseCreateOrganization();

    renderPage();

    const input = screen.getByPlaceholderText('Nome da organização');
    fireEvent.change(input, { target: { value: 'Minha Organização' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ slug: 'minha-organiza-o', name: 'Minha Organização' });
    });
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    expect(toast.success).toHaveBeenCalledWith('Organização criada.');
  });

  it('mostra erro quando a criação falha', async () => {
    mockUseOrganizations({ data: [] });
    mockUseCreateOrganization({
      mutateAsync: vi.fn().mockRejectedValue(new Error('Falha ao criar organização: HTTP 500')),
    });

    renderPage();

    const input = screen.getByPlaceholderText('Nome da organização');
    fireEvent.change(input, { target: { value: 'Org Falha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Falha ao criar organização: HTTP 500');
    });
  });
});

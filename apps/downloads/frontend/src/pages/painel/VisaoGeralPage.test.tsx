import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisaoGeralPage } from './VisaoGeralPage';
import * as authClientModule from '@artificio/auth/client';
import * as useMyMaterialsModule from '../../hooks/useMyMaterials';
import type { Material } from '../../types/material';
import { makeMaterial as baseMaterial } from '../../test/fixtures';

// Débito (27 páginas sem teste de componente) — cobertura de VisaoGeralPage
// (painel do usuário comum, spec 074): saudação com nome do usuário logado
// via useSession, e contadores de materiais por estado editorial.


// Spec 088 — usa a fixture compartilhada (`src/test/fixtures`), so trocando o
// `id` que as assercoes deste arquivo esperam. Antes o `Partial` local so
// admitia `editorial_state` e o retorno tinha 4 dos 13 campos exigidos.
function makeMaterial(overrides: Partial<Material> = {}): Material {
  return baseMaterial({ id: 'material-1', ...overrides });
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

    expect(screen.getByText('Publicados')).toBeInTheDocument();
    expect(screen.getByText('Em revisão')).toBeInTheDocument();
    expect(screen.getByText('Rascunhos')).toBeInTheDocument();
    expect(screen.getByText('Rejeitados')).toBeInTheDocument();
    expect(screen.getByText('Retirados')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Criar rascunho' })).toHaveAttribute('href', '/painel/materiais/novo');
  });

  it('conta materiais por estado editorial', () => {
    mockSession();
    mockMyMaterials({
      data: [
        makeMaterial({
          id: 'published-1', editorial_state: 'published',
          avg_rating: 4.5, rating_count: 2, legacy_comment_count: 3, download_count: 7,
        }),
        makeMaterial({ id: 'published-2', editorial_state: 'published' }),
        makeMaterial({ id: 'review-1', editorial_state: 'in_review' }),
        makeMaterial({ id: 'draft-1', editorial_state: 'draft' }),
        makeMaterial({ id: 'rejected-1', editorial_state: 'rejected', rejection_reason: 'Falta licença.' }),
        makeMaterial({ id: 'withdrawn-1', editorial_state: 'withdrawn' }),
      ],
    });

    renderPage();

    const published = screen.getByText('Publicados').previousElementSibling;
    const inReview = screen.getByText('Em revisão').previousElementSibling;
    const draft = screen.getByText('Rascunhos').previousElementSibling;
    const rejected = screen.getByText('Rejeitados').previousElementSibling;
    const withdrawn = screen.getByText('Retirados').previousElementSibling;

    expect(published).toHaveTextContent('2');
    expect(inReview).toHaveTextContent('1');
    expect(draft).toHaveTextContent('1');
    expect(rejected).toHaveTextContent('1');
    expect(withdrawn).toHaveTextContent('1');
    expect(screen.getByText('Motivo: Falta licença.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ver no catálogo' })).toHaveLength(2);
    expect(screen.getByText('4.5 / 5 em 2 avaliações · 3 comentários antigos · 7 downloads')).toBeInTheDocument();
  });

  /**
   * O acervo legado é o caso RARO: a esmagadora maioria dos materiais nunca teve
   * comentário antigo, e depois do cutover nenhum material novo terá. A linha
   * "· 0 comentários antigos" apareceria em quase toda a lista, anunciando a
   * ausência de uma funcionalidade que saiu de cena — ruído permanente pelo
   * caso excepcional.
   */
  it.each([
    ['zero', 0],
    ['ausente', undefined],
  ])('omite o contador de comentários antigos quando é %s', (_label, legacy_comment_count) => {
    mockSession();
    mockMyMaterials({
      data: [
        makeMaterial({
          id: 'published-1', editorial_state: 'published',
          avg_rating: 4.5, rating_count: 2, legacy_comment_count, download_count: 7,
        }),
      ],
    });

    renderPage();

    expect(screen.queryByText(/comentários antigos/)).not.toBeInTheDocument();
    expect(screen.getByText('4.5 / 5 em 2 avaliações · 7 downloads')).toBeInTheDocument();
  });
});

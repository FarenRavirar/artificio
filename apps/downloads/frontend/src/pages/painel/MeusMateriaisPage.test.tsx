import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeusMateriaisPage } from './MeusMateriaisPage';
import * as useMyMaterialsModule from '../../hooks/useMyMaterials';
import type { Material } from '../../types/material';
import { makeMaterial as baseMaterial } from '../../test/fixtures';

// Débito (27 páginas sem teste de componente, spec 075): cobre loading,
// lista vazia, lista com estados editoriais traduzidos e link de edição.


// Spec 088 — usa a fixture compartilhada (`src/test/fixtures`), so trocando o
// que as assercoes deste arquivo esperam (material em rascunho). Antes
// devolvia 3 campos de um tipo que exige 13, e o tipo era inferido do proprio
// valor, o que escondia a divergencia: nenhum tsconfig incluia os testes.
function makeMaterial(overrides: Partial<Material> = {}): Material {
  return baseMaterial({
    id: 'material-1',
    slug: 'bestiario-sombrio',
    title: 'Bestiário Sombrio',
    editorial_state: 'draft',
    ...overrides,
  });
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
      // O valor e invalido DE PROPOSITO: o caso existe pra provar que a UI
      // degrada mostrando o estado cru se o backend enviar algo fora do enum
      // (payload externo e `unknown` ate ser normalizado — AGENTS.md §Regras
      // Gerais de Codigo). O cast e o unico jeito de expressar "payload que o
      // contrato nao preve" numa fixture tipada; sem ele o caso nao existiria.
      data: [makeMaterial({ editorial_state: 'estado_desconhecido' as Material['editorial_state'] })],
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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DenunciasPage } from './DenunciasPage';
import * as useMyReportsModule from '../../hooks/useMyReports';
import type { MyReport } from '../../hooks/useMyReports';

// Débito (27 páginas sem teste de componente) — cobertura de
// DenunciasPage (painel do usuário): loading/vazio e render da lista de
// denúncias abertas pelo próprio usuário (GET /reports/mine).


// Spec 088 — fixture tipada contra `MyReport` (schema real). Antes o tipo era
// inferido do proprio valor de exemplo, entao o `as const` do default
// congelava `case_state` em `'open'` e `resolution_note` em `null`: passar
// `'resolved'` ou uma nota real era erro de tipo, mesmo sendo valor valido do
// enum. Ancorar no schema libera todo o dominio legitimo e trava o resto.
function makeReport(overrides: Partial<MyReport> = {}): MyReport {
  return {
    id: 'report-1',
    material_id: 'material-1',
    category: 'copyright',
    priority: 'P0',
    case_state: 'open',
    details: 'Conteúdo infringe direitos autorais',
    resolution_note: null,
    created_at: '2026-07-01T00:00:00.000Z',
    resolved_at: null,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/painel/denuncias']}>
        <DenunciasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockMyReports(overrides: Partial<ReturnType<typeof useMyReportsModule.useMyReports>> = {}) {
  vi.spyOn(useMyReportsModule, 'useMyReports').mockReturnValue({
    data: undefined,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useMyReportsModule.useMyReports>);
}

describe('DenunciasPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra estado de carregamento', () => {
    mockMyReports({ data: undefined, isLoading: true });

    renderPage();

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há denúncias', () => {
    mockMyReports({ data: [], isLoading: false });

    renderPage();

    expect(screen.getByText('Você ainda não abriu nenhuma denúncia.')).toBeInTheDocument();
  });

  it('renderiza a lista de denúncias com categoria, estado e detalhes', () => {
    mockMyReports({ data: [makeReport()], isLoading: false });

    renderPage();

    expect(screen.getByText(/copyright/)).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo infringe direitos autorais')).toBeInTheDocument();
  });

  it('mostra a nota de resolução quando a denúncia foi resolvida', () => {
    mockMyReports({
      data: [
        makeReport({
          id: 'report-2',
          case_state: 'resolved',
          resolution_note: 'Verificado, conteúdo removido',
        }),
      ],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('Resolvida')).toBeInTheDocument();
    expect(screen.getByText('Resolução: Verificado, conteúdo removido')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoAuditoriaPage } from './GestaoAuditoriaPage';
import * as useMaterialHistoryModule from '../../hooks/useMaterialHistory';
import * as useAdminLinkHistoryModule from '../../hooks/useAdminLinkHistory';

// T3.1/T3.2 (spec 075) — auditoria completa: historico por campo + historico
// de links. Testa os dois caminhos de rota (com e sem :materialId) e os
// estados de loading/lista vazia/lista preenchida.


function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/gestao/auditoria/:materialId" element={<GestaoAuditoriaPage />} />
          <Route path="/gestao/auditoria" element={<GestaoAuditoriaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GestaoAuditoriaPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra mensagem para selecionar material quando sem materialId', () => {
    renderPage('/gestao/auditoria');

    expect(screen.getByText('Auditoria de edição')).toBeInTheDocument();
    expect(screen.getByText(/selecione um material para ver o histórico de auditoria/i)).toBeInTheDocument();
  });

  it('mostra loading enquanto histórico carrega', () => {
    vi.spyOn(useMaterialHistoryModule, 'useMaterialHistory').mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useMaterialHistoryModule.useMaterialHistory>);
    vi.spyOn(useAdminLinkHistoryModule, 'useAdminLinkHistory').mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useAdminLinkHistoryModule.useAdminLinkHistory>);

    renderPage('/gestao/auditoria/mat-1');

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra estados vazios quando não há histórico nem troca de link', () => {
    vi.spyOn(useMaterialHistoryModule, 'useMaterialHistory').mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaterialHistoryModule.useMaterialHistory>);
    vi.spyOn(useAdminLinkHistoryModule, 'useAdminLinkHistory').mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useAdminLinkHistoryModule.useAdminLinkHistory>);

    renderPage('/gestao/auditoria/mat-1');

    expect(screen.getByText('Sem histórico registrado.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma troca de link registrada.')).toBeInTheDocument();
  });

  it('lista histórico de campos e de links quando presentes', () => {
    vi.spyOn(useMaterialHistoryModule, 'useMaterialHistory').mockReturnValue({
      data: [
        {
          id: 'v1',
          field_name: 'title',
          old_value: 'Titulo Antigo',
          new_value: 'Titulo Novo',
          changed_by: 'admin@teste.com',
          changed_at: '2026-07-24T12:00:00.000Z',
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaterialHistoryModule.useMaterialHistory>);
    vi.spyOn(useAdminLinkHistoryModule, 'useAdminLinkHistory').mockReturnValue({
      data: [
        {
          id: 'l1',
          material_id: 'mat-1',
          field_name: 'download_url',
          old_value: 'https://old.example.com',
          new_value: 'https://new.example.com',
          changed_by: 'admin@teste.com',
          changed_at: '2026-07-24T13:00:00.000Z',
        },
      ],
    } as unknown as ReturnType<typeof useAdminLinkHistoryModule.useAdminLinkHistory>);

    renderPage('/gestao/auditoria/mat-1');

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText(/"Titulo Antigo" → "Titulo Novo"/)).toBeInTheDocument();
    expect(screen.getByText(/"https:\/\/old.example.com" → "https:\/\/new.example.com"/)).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SugestoesSistemaPage } from './SugestoesSistemaPage';
import * as materialsModule from '../../hooks/useMyMaterials';
import * as suggestionsModule from '../../hooks/useSystemSuggestions';
import { makeMaterial } from '../../test/fixtures';

function renderPage() {
  return render(<MemoryRouter initialEntries={['/painel/sugestoes-sistema']}><SugestoesSistemaPage /></MemoryRouter>);
}

function mockHooks() {
  vi.spyOn(materialsModule, 'useMyMaterials').mockReturnValue({
    data: [
      makeMaterial({ id: 'without-system', title: 'Sem sistema', system_id: null }),
      makeMaterial({ id: 'with-system', title: 'Com sistema', system_id: 'system-1' }),
    ],
  } as ReturnType<typeof materialsModule.useMyMaterials>);
  vi.spyOn(suggestionsModule, 'useMySystemSuggestions').mockReturnValue({
    data: [{
      id: 'suggestion-1', material_id: 'without-system', raw_value: 'Sistema Novo', source: 'user',
      status: 'rejected', suggested_by_user_id: 'user-1', resolution_action: null, resolved_node_id: null,
      rejection_reason: 'Já existe com outro nome.', reviewed_by: 'admin-1', reviewed_at: '2026-01-02T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    }],
    isLoading: false,
  } as ReturnType<typeof suggestionsModule.useMySystemSuggestions>);
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(suggestionsModule, 'useCreateSystemSuggestion').mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof suggestionsModule.useCreateSystemSuggestion>);
  return mutateAsync;
}

describe('SugestoesSistemaPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('oferece só materiais sem sistema e mostra o desfecho', () => {
    mockHooks();
    renderPage();

    expect(screen.getByRole('option', { name: 'Sem sistema' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Com sistema' })).not.toBeInTheDocument();
    expect(screen.getByText('Sem sistema · Recusada')).toBeInTheDocument();
    expect(screen.getByText('Motivo: Já existe com outro nome.')).toBeInTheDocument();
  });

  it('envia material e nome digitado', async () => {
    const mutateAsync = mockHooks();
    renderPage();

    fireEvent.change(screen.getByLabelText('Material sem sistema'), { target: { value: 'without-system' } });
    fireEvent.change(screen.getByLabelText('Nome do sistema'), { target: { value: '  Sistema Novo  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar sugestão' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ material_id: 'without-system', raw_value: 'Sistema Novo' }));
  });
});

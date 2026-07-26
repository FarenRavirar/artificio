import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoSugestoesSistemaPage } from './GestaoSugestoesSistemaPage';
import * as suggestionsModule from '../../hooks/useSystemSuggestions';
import * as summaryModule from '../../hooks/useAdminSummary';
import * as creatorRoleModule from '../../hooks/useCreatorRole';

const suggestion: suggestionsModule.SystemSuggestion = {
  id: 'suggestion-1',
  material_id: 'material-1',
  raw_value: 'D&D 5e',
  source: 'scraper',
  status: 'pending',
  suggested_by_user_id: null,
  resolution_action: null,
  resolved_node_id: null,
  rejection_reason: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-07-25T12:00:00.000Z',
};

const candidateData = {
  suggestion,
  candidates: [{ system_id: 'dnd-5e', name: 'Dungeons & Dragons 5e', path_slug: 'dnd/5e', node_type: 'edition', parent_id: 'dnd', score: 0.99, reasons: ['base_plus_edition'] }],
  recommended_action: 'merge_existing' as const,
  analysis: { base: 'd and d', edition_tokens: ['5e'], suggested_child_name: '5e', suggested_child_type: 'edition' as const, has_edition_context: true, has_qualifier_context: false },
};

function mockShell() {
  vi.spyOn(summaryModule, 'useAdminSummary').mockReturnValue({ data: undefined } as ReturnType<typeof summaryModule.useAdminSummary>);
  vi.spyOn(creatorRoleModule, 'useCreatorRole').mockReturnValue({ data: { role: 'admin' }, isLoading: false } as unknown as ReturnType<typeof creatorRoleModule.useCreatorRole>);
}

function renderPage(items: suggestionsModule.SystemSuggestion[], mutateAsync = vi.fn().mockResolvedValue({ success: true })) {
  mockShell();
  vi.spyOn(suggestionsModule, 'useAdminSystemSuggestions').mockReturnValue({ data: items, isLoading: false, error: null } as unknown as ReturnType<typeof suggestionsModule.useAdminSystemSuggestions>);
  vi.spyOn(suggestionsModule, 'useSystemSuggestionCandidates').mockImplementation((id) => ({ data: id ? candidateData : undefined, isLoading: false } as unknown as ReturnType<typeof suggestionsModule.useSystemSuggestionCandidates>));
  vi.spyOn(suggestionsModule, 'useResolveSystemSuggestion').mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof suggestionsModule.useResolveSystemSuggestion>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/gestao/sugestoes-sistema']}>
        <GestaoSugestoesSistemaPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return mutateAsync;
}

describe('GestaoSugestoesSistemaPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mostra fila vazia', () => {
    renderPage([]);
    expect(screen.getByText('Nenhuma sugestão pendente.')).toBeInTheDocument();
  });

  it('lista pendente, candidatos pontuados e aviso de catálogo compartilhado', async () => {
    renderPage([suggestion]);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));

    expect(await screen.findByText('Dungeons & Dragons 5e')).toBeInTheDocument();
    expect(screen.getByText(/Recomendação: Casar com existente/)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('compartilhado com Mesas e Glossário');
  });

  it('casa candidato existente pela mutação correta', async () => {
    const mutateAsync = renderPage([suggestion]);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Selecionar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casar com existente' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ suggestionId: 'suggestion-1', payload: { resolution_type: 'merge_existing', target_node_id: 'dnd-5e' } }));
  });

  it('recusa sugestão com motivo', async () => {
    const mutateAsync = renderPage([suggestion]);
    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    fireEvent.change(await screen.findByLabelText('Motivo'), { target: { value: 'Duplicata' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ suggestionId: 'suggestion-1', payload: { resolution_type: 'reject', reason: 'Duplicata' } }));
  });
});

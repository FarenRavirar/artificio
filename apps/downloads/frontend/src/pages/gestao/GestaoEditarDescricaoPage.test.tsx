import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoEditarDescricaoPage } from './GestaoEditarDescricaoPage';
import * as mediaModule from '../../hooks/useAdminMedia';
import * as metadataModule from '../../hooks/useUpdateMaterialMetadata';
import * as summaryModule from '../../hooks/useAdminSummary';
import * as creatorRoleModule from '../../hooks/useCreatorRole';

vi.mock('../../components/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => (
    <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

function renderPage(mutateAsync = vi.fn().mockResolvedValue({})) {
  vi.spyOn(summaryModule, 'useAdminSummary').mockReturnValue({ data: undefined } as ReturnType<typeof summaryModule.useAdminSummary>);
  vi.spyOn(creatorRoleModule, 'useCreatorRole').mockReturnValue({ data: { role: 'admin' } } as unknown as ReturnType<typeof creatorRoleModule.useCreatorRole>);
  vi.spyOn(mediaModule, 'useAdminMedia').mockReturnValue({
    data: { items: [{ material_id: 'material-1', material_slug: 'manual', material_title: 'Manual', editorial_state: 'published', cover_image_url: null, description_html: '<p>Inicial</p>' }] },
    isLoading: false,
  } as unknown as ReturnType<typeof mediaModule.useAdminMedia>);
  vi.spyOn(metadataModule, 'useUpdateMaterialMetadata').mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof metadataModule.useUpdateMaterialMetadata>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/gestao/materiais/material-1/editar-descricao']}>
        <Routes><Route path="/gestao/materiais/:materialId/editar-descricao" element={<GestaoEditarDescricaoPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return mutateAsync;
}

describe('GestaoEditarDescricaoPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('carrega HTML inicial e salva pelo PUT de metadata', async () => {
    const mutateAsync = renderPage();
    const editor = screen.getByLabelText('Descrição rica de Manual');
    expect(editor).toHaveValue('<p>Inicial</p>');

    fireEvent.change(editor, { target: { value: '<p>Novo <strong>texto</strong></p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar descrição' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ description_html: '<p>Novo <strong>texto</strong></p>' }));
  });

  it('converte documento vazio do TipTap para null', async () => {
    const mutateAsync = renderPage();
    fireEvent.change(screen.getByLabelText('Descrição rica de Manual'), { target: { value: '<p></p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar descrição' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ description_html: null }));
  });
});

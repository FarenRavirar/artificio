import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestaoArquivosPage } from './GestaoArquivosPage';
import * as useAdminSummaryModule from '../../hooks/useAdminSummary';

// T6.2 (spec 075) — página de upload de evidência (magic bytes), sem storage
// real conectado. Cobre estado inicial, validação de campos obrigatórios e
// os caminhos de sucesso/falha do upload via fetch mockado.


function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(useAdminSummaryModule, 'useAdminSummary').mockReturnValue({
    data: undefined,
  } as ReturnType<typeof useAdminSummaryModule.useAdminSummary>);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestao/arquivos']}>
        <GestaoArquivosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeFile(name = 'evidencia.pdf', content = 'conteudo-fake') {
  return new File([content], name, { type: 'application/pdf' });
}

describe('GestaoArquivosPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renderiza titulo, descricao e formulario de upload', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Arquivos' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ID do material')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('mostra mensagem de validação quando falta ID do material ou arquivo', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText('Informe o ID do material e escolha um arquivo.')).toBeInTheDocument();
  });

  it('envia arquivo com sucesso e mostra status de confirmação', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('ID do material'), { target: { value: 'material-123' } });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeFile()] } });

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText('Evidência registrada com sucesso.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/materials/material-123/evidence/upload?filename=evidencia.pdf'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('mostra mensagem de falha quando o backend retorna erro HTTP', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('ID do material'), { target: { value: 'material-123' } });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeFile()] } });

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(await screen.findByText('Falha: HTTP 400')).toBeInTheDocument();
  });

  it('mostra mensagem de erro inesperado quando o fetch rejeita', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('ID do material'), { target: { value: 'material-123' } });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [makeFile()] } });

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText('Erro: network down')).toBeInTheDocument());
  });
});

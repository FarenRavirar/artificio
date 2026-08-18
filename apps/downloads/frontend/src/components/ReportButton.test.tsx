import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportButton } from './ReportButton';
import * as authClientModule from '@artificio/auth/client';
import * as apiClientModule from '../services/apiClient';

vi.mock('@artificio/content-editor', () => ({
  // Mesma conta do pacote real: o mock precisa responder igual, senão o teste
  // valida um componente que barra o submit por regra diferente da de produção.
  contentOverflow: (value: string, maxLength?: number) =>
    maxLength === undefined ? 0 : Math.max(0, value.length - maxLength),
  ContentEditor: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <label>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>
  ),
}));

function renderButton(target: { materialId: string } | { commentId: string }) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ReportButton target={target} />
    </QueryClientProvider>,
  );
}

function mockSession(user: { id: string } | null = { id: 'user-1' }) {
  vi.spyOn(authClientModule, 'useSession').mockReturnValue({ user, loading: false } as ReturnType<typeof authClientModule.useSession>);
}

describe('ReportButton', () => {
  afterEach(() => vi.restoreAllMocks());

  it('orienta visitante sem sessão', () => {
    mockSession(null);
    renderButton({ materialId: 'material-1' });
    expect(screen.getByText('Entre com sua conta para denunciar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Denunciar' })).not.toBeInTheDocument();
  });

  it('envia material sem expor prioridade e anuncia sucesso', async () => {
    mockSession();
    const post = vi.spyOn(apiClientModule, 'apiPost').mockResolvedValue(new Response('{}', { status: 201 }));
    renderButton({ materialId: 'material-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Denunciar' }));
    await waitFor(() => expect(screen.getByLabelText('Motivo')).toHaveFocus());
    expect(screen.queryByText(/P0|P1|P2|P3/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'broken_link' } });
    fireEvent.change(screen.getByLabelText('Detalhes (opcional)'), { target: { value: 'Não abre.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/reports', {
      material_id: 'material-1', category: 'broken_link', details: 'Não abre.',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Denúncia enviada para análise humana.');
  });

  it('explica 409 ao denunciar comentário repetido', async () => {
    mockSession();
    vi.spyOn(apiClientModule, 'apiPost').mockResolvedValue(new Response(JSON.stringify({ error: 'duplicada' }), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    }));
    renderButton({ commentId: 'comment-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Denunciar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você já denunciou este conteúdo.');
  });

  it('remove sucesso antigo antes de mostrar erro de nova tentativa', async () => {
    mockSession();
    vi.spyOn(apiClientModule, 'apiPost')
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'indisponível' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      }));
    renderButton({ materialId: 'material-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Denunciar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Denúncia enviada');

    fireEvent.click(screen.getByRole('button', { name: 'Denunciar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar denúncia' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('indisponível');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

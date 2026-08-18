import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommentSection } from './CommentSection';
import * as authClientModule from '@artificio/auth/client';
import * as apiClientModule from '../services/apiClient';

vi.mock('@artificio/content-editor', () => ({
  // Mesma conta do pacote real: o mock precisa responder igual, senão o teste
  // valida um componente que barra o submit por regra diferente da de produção.
  contentOverflow: (value: string, maxLength?: number) =>
    maxLength === undefined ? 0 : Math.max(0, value.length - maxLength),
  ContentEditor: ({ label }: { label: string }) => <label>{label}<textarea /></label>,
  MarkdownContent: ({ value }: { value: string }) => <p>{value}</p>,
}));

describe('CommentSection — comentário moderado', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mantém a posição com marca, sem corpo nem nova denúncia', async () => {
    vi.spyOn(authClientModule, 'useSession').mockReturnValue({
      user: { id: 'user-1' }, loading: false,
    } as ReturnType<typeof authClientModule.useSession>);
    vi.spyOn(apiClientModule, 'apiGet').mockResolvedValue(new Response(JSON.stringify([
      { id: 'active', material_id: 'material-1', user_id: 'author-1', body: 'Visível', removed_at: null, removed_by_moderation: false, created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'removed', material_id: 'material-1', user_id: 'author-2', body: null, removed_at: '2026-01-02T00:00:00.000Z', removed_by_moderation: true, created_at: '2026-01-01T00:00:00.000Z' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CommentSection materialId="material-1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Visível')).toBeInTheDocument();
    expect(screen.getByText('Comentário removido pela moderação.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Denunciar' })).toHaveLength(1);
  });
});

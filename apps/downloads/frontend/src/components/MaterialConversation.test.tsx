import { cleanup, render, screen, waitFor } from '@testing-library/react';
import * as authClientModule from '@artificio/auth/client';
import { MaterialConversation } from './MaterialConversation';

/**
 * T5.4 (spec 090) — a conversa montada no host real do `downloads`.
 *
 * Cobre o que só aparece na integração, não nos testes do pacote: a rota que o
 * transporte chama, o `credentials: 'include'` que mantém a sessão same-origin,
 * a degradação quando o `accounts.` não responde e as permissões que este host
 * decide. Também é a linha `downloads` da matriz de T4.14 (Vite React).
 */

vi.mock('@artificio/content-editor', () => ({
  ContentEditor: ({ label }: { label: string }) => <label>{label}<textarea /></label>,
  MarkdownContent: ({ value }: { value: string }) => <p>{value}</p>,
}));

const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const LEGACY_ID = '33333333-3333-4333-8333-333333333333';
const HIDDEN_ID = '44444444-4444-4444-8444-444444444444';

function comment(overrides: Record<string, unknown>) {
  return {
    parent_id: null,
    depth: 0,
    edited_at: null,
    state: 'visible',
    author: { display_name: 'Alguém', avatar_url: null, badge: null, state: 'active' },
    upvotes: 0,
    downvotes: 0,
    score: 0,
    my_vote: 0,
    legacy: null,
    ...overrides,
  };
}

const THREAD = {
  state: 'fresh',
  snapshot_revision: 1,
  comments: [
    comment({
      id: AUTHOR_ID,
      root_id: AUTHOR_ID,
      body_markdown: 'Comentário visível',
      created_at: '2026-08-01T10:00:00.000Z',
      author: { display_name: 'Ana', avatar_url: null, badge: 'content_author', state: 'active' },
    }),
    comment({
      id: LEGACY_ID,
      root_id: LEGACY_ID,
      body_markdown: 'Comentário importado',
      created_at: '2020-01-01T00:00:00.000Z',
      author: { display_name: 'Antigo', avatar_url: null, badge: null, state: 'legacy' },
      my_vote: null,
      legacy: { source: 'downloads', author_name: 'Antigo' },
    }),
    comment({
      id: HIDDEN_ID,
      root_id: HIDDEN_ID,
      body_markdown: null,
      created_at: '2026-08-02T10:00:00.000Z',
      state: 'removed',
      upvotes: null,
      downvotes: null,
      score: null,
      my_vote: null,
    }),
  ],
  more: [],
  truncated: false,
};

function mockSession(userId: string | null) {
  vi.spyOn(authClientModule, 'useSession').mockReturnValue({
    user: userId ? { id: userId } : null,
    loading: false,
  } as ReturnType<typeof authClientModule.useSession>);
}

/**
 * O duplo é tipado com a assinatura real de `fetch`, e não com a do `impl`:
 * `vi.fn(() => …)` infere argumentos `[]`, e ler `mock.calls[0][1]` vira erro de
 * tupla vazia no `tsc` do build — que compila os testes, ao contrário do
 * vitest, que passava.
 */
function mockFetch(impl: () => Promise<Response>) {
  const spy = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

afterEach(() => {
  // `cleanup` explícito: sem ele o `it.each` acumula árvores montadas no mesmo
  // `document`, e `getAllByRole('alert')` passa a enxergar o alerta do caso
  // anterior — falha por ambiguidade que parece bug do componente e não é.
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MaterialConversation — integração com a fachada', () => {
  it('lê da fachada same-origin, nunca de /internal/v1', async () => {
    mockSession(OTHER_ID);
    const fetchSpy = mockFetch(() => jsonResponse(THREAD));

    render(<MaterialConversation materialId="material-1" />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/community/conversation');
    expect(String(url)).toContain('subject_id=material-1');
    // Requisito 6a: a credencial de serviço vive só no backend.
    expect(String(url)).not.toContain('/internal/v1');
    expect(init?.credentials).toBe('include');
  });

  it('renderiza a árvore devolvida pelo accounts.', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<MaterialConversation materialId="material-1" />);

    expect(await screen.findByText('Comentário visível')).toBeInTheDocument();
    expect(screen.getByText('Comentário importado')).toBeInTheDocument();
  });

  it('usa o rótulo de autor do domínio do downloads, não "autor do post"', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<MaterialConversation materialId="material-1" />);

    expect(await screen.findByText('Autor do material')).toBeInTheDocument();
    expect(screen.queryByText(/autor do post/i)).not.toBeInTheDocument();
  });

  it('mantém a posição do comentário retirado, sem vazar corpo', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<MaterialConversation materialId="material-1" />);

    expect(await screen.findByText('Comentário retirado.')).toBeInTheDocument();
  });

  it.each([
    ['accounts. fora', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['503 da fachada', () => jsonResponse({ error: 'community_comments_unavailable' }, 503)],
    ['corpo fora do schema', () => jsonResponse({ comments: 'não é array' })],
  ])('degrada em %s sem derrubar a página do material', async (_label, impl) => {
    mockSession(OTHER_ID);
    mockFetch(impl);

    render(<MaterialConversation materialId="material-1" />);

    // O cabeçalho da seção continua de pé: a falha fica contida na área de
    // comentários (requisito 22).
    expect(screen.getByRole('heading', { name: 'Comentários' })).toBeInTheDocument();

    // A busca é pela MENSAGEM, não por `getByRole('alert')` singular: o
    // componente mantém uma live region `role="alert"` vazia montada o tempo
    // todo, de propósito — leitor de tela não anuncia região inserida do zero
    // (`CommentsConversation.tsx:578-586`). Procurar o papel encontraria duas.
    await screen.findByText(/comentários estão temporariamente indisponíveis/i);
  });

  it('convida a entrar quando não há sessão, sem oferecer o compositor', async () => {
    mockSession(null);
    mockFetch(() => jsonResponse({ ...THREAD, comments: [] }));

    render(<MaterialConversation materialId="material-1" />);

    expect(await screen.findByText(/Entre com sua conta para comentar/i)).toBeInTheDocument();
  });

  it('oferece editar e retirar no comentário do próprio leitor (DEB-090-VIEWER-AUTHOR)', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse({
      ...THREAD,
      comments: [comment({
        id: AUTHOR_ID,
        root_id: AUTHOR_ID,
        body_markdown: 'Minha fala',
        created_at: '2026-08-01T10:00:00.000Z',
        viewer_is_author: true,
      })],
    }));

    render(<MaterialConversation materialId="material-1" />);
    await screen.findByText('Minha fala');

    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retirar/i })).toBeInTheDocument();
    // Decisão 5: autor não vota no próprio comentário — o servidor recusa com
    // `self_vote`, e a tela não pode oferecer o que sempre falharia.
    expect(screen.queryByRole('button', { name: /votar a favor|upvote/i })).not.toBeInTheDocument();
  });

  it('não oferece editar nem retirar em fala de terceiro', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<MaterialConversation materialId="material-1" />);
    await screen.findByText('Comentário visível');

    // `viewer_is_author` vem `false` (default do schema) em todos os itens da
    // fixture: nenhum é do leitor.
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retirar/i })).not.toBeInTheDocument();
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import * as authClientModule from '@artificio/auth/client';
import { TableConversation } from './TableConversation';

/**
 * T7.8 (spec 090) — a conversa montada no host real do `mesas`.
 *
 * Cobre o que só aparece na integração, não nos testes do pacote: a rota que o
 * transporte chama, a degradação quando o `accounts.` não responde, as
 * permissões que este host decide e o estado de mesa fechada. Também é a linha
 * `mesas` da matriz de T4.14 (Vite React).
 */

vi.mock('@artificio/content-editor', () => ({
  ContentEditor: ({ label }: { label: string }) => <label>{label}<textarea /></label>,
  MarkdownContent: ({ value }: { value: string }) => <p>{value}</p>,
}));

const TABLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
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
      id: HIDDEN_ID,
      root_id: HIDDEN_ID,
      body_markdown: null,
      created_at: '2026-08-01T11:00:00.000Z',
      state: 'removed',
      // Contadores nulos: comentário retirado não expõe placar (§7,
      // `not_votable`). Com zeros, `threadIntegrity` rejeita a árvore inteira e
      // nada renderiza — o sintoma é timeout, não erro visível.
      upvotes: null,
      downvotes: null,
      score: null,
      my_vote: null,
    }),
  ],
  // `more` e `truncated` são obrigatórios em `commentsThreadSchema`
  // (`conversation.ts:162-167`): sem eles a resposta cai em
  // `schema_incompatible` e a árvore nunca renderiza — o sintoma é timeout,
  // não erro de schema visível.
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
 * O duplo é tipado com a assinatura real de `fetch`: `vi.fn(() => …)` infere
 * argumentos `[]`, e ler `mock.calls[0][1]` vira erro de tupla vazia no `tsc`
 * do build — que compila os testes.
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
  // `document`, e a busca passa a enxergar o alerta do caso anterior — falha
  // por ambiguidade que parece bug do componente e não é.
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TableConversation — integração com a fachada', () => {
  it('lê da fachada do mesas, nunca de /internal/v1', async () => {
    mockSession(OTHER_ID);
    const spy = mockFetch(() => jsonResponse(THREAD));

    render(<TableConversation tableId={TABLE_ID} />);
    await screen.findByText('Comentário visível');

    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain('/api/v1/community/conversation');
    // Requisito 6a: o navegador nunca alcança a rota interna — a credencial de
    // serviço vive só no backend.
    expect(url).not.toContain('/internal/v1');
    expect(url).toContain(`subject_id=${TABLE_ID}`);
    // O `subject_type` NÃO viaja na query: o host o mantém na configuração e a
    // fachada o injeta no servidor (`communityComments.ts`), que é o único
    // lugar onde ele não pode ser trocado pelo cliente. Medido: a URL gerada é
    // `?subject_id=<id>&sort=best`.
    expect(url).not.toContain('subject_type');
  });

  it('manda a sessão junto, para o my_vote resolver', async () => {
    mockSession(OTHER_ID);
    const spy = mockFetch(() => jsonResponse(THREAD));

    render(<TableConversation tableId={TABLE_ID} />);
    await screen.findByText('Comentário visível');

    expect(spy.mock.calls[0][1]?.credentials).toBe('include');
  });

  it('usa o rótulo de quem publicou, não "mestre" nem "autor do material"', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<TableConversation tableId={TABLE_ID} />);

    // Requisito 15b: em mesa com `publisher_role = 'announcer'` quem anunciou
    // não é quem mestra, então "Mestre da mesa" seria falso justamente no caso
    // que a decisão do mantenedor nomeia.
    expect(await screen.findByText('Quem publicou a mesa')).toBeInTheDocument();
    expect(screen.queryByText(/autor do material/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^mestre da mesa$/i)).not.toBeInTheDocument();
  });

  it('mantém a posição do comentário retirado, sem vazar corpo', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<TableConversation tableId={TABLE_ID} />);

    expect(await screen.findByText('Comentário retirado.')).toBeInTheDocument();
  });

  it.each([
    ['accounts. fora', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['503 da fachada', () => jsonResponse({ error: 'community_comments_unavailable' }, 503)],
    ['502 de resposta inválida', () => jsonResponse({ error: 'invalid_accounts_response' }, 502)],
    ['corpo fora do schema', () => jsonResponse({ comments: 'não é array' })],
  ])('degrada em %s sem derrubar a página da mesa', async (_label, impl) => {
    mockSession(OTHER_ID);
    mockFetch(impl);

    render(<TableConversation tableId={TABLE_ID} />);

    // O cabeçalho da seção continua de pé: a falha fica contida na área de
    // comentários e o anúncio da mesa não é afetado (requisito 22).
    expect(screen.getByRole('heading', { name: 'Comentários' })).toBeInTheDocument();
    await screen.findByText(/comentários estão temporariamente indisponíveis/i);
  });

  it('convida a entrar quando não há sessão, sem oferecer o compositor', async () => {
    mockSession(null);
    mockFetch(() => jsonResponse({ ...THREAD, comments: [] }));

    render(<TableConversation tableId={TABLE_ID} />);

    expect(await screen.findByText(/Entre com sua conta para comentar/i)).toBeInTheDocument();
  });
});

describe('TableConversation — mesa fechada a fala nova (requisito 26a)', () => {
  it('avisa que a mesa não recebe comentários novos', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse({ ...THREAD, comments: [] }));

    render(<TableConversation tableId={TABLE_ID} canComment={false} />);

    expect(await screen.findByText(/não recebe comentários novos/i)).toBeInTheDocument();
  });

  it('não oferece responder em mesa fechada, mas a conversa segue legível', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<TableConversation tableId={TABLE_ID} canComment={false} />);
    // A leitura é preservada: 26a fecha a escrita nova, não a conversa.
    await screen.findByText('Comentário visível');

    expect(screen.queryByRole('button', { name: /responder/i })).not.toBeInTheDocument();
  });

  it('congela o voto e preserva a denúncia em mesa fechada', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<TableConversation tableId={TABLE_ID} canComment={false} />);
    await screen.findByText('Comentário visível');

    // Convergência de Discourse (arquivado: "Disable likes", "Continue to
    // allow flagging") e Reddit (arquivado: voto trava, report segue). Voto é
    // ranking e congela junto com a conversa; denúncia é segurança e nunca
    // fecha — conteúdo abusivo não deixa de ser abusivo porque a mesa acabou.
    expect(screen.getByRole('button', { name: /denunciar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /votar positivamente/i })).not.toBeInTheDocument();
  });

  it('mantém o voto disponível enquanto a mesa aceita comentário', async () => {
    // Contraste que dá sentido ao caso acima: sem ele, um bug que escondesse o
    // voto sempre passaria nos dois testes.
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<TableConversation tableId={TABLE_ID} />);
    await screen.findByText('Comentário visível');

    expect(screen.getByRole('button', { name: /votar positivamente/i })).toBeInTheDocument();
  });
});

describe('TableConversation — permissões decididas por este host', () => {
  it('oferece editar e retirar no comentário do próprio leitor', async () => {
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

    render(<TableConversation tableId={TABLE_ID} />);
    await screen.findByText('Minha fala');

    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retirar/i })).toBeInTheDocument();
    // Decisão 5: autor não vota no próprio comentário — o servidor recusa com
    // `self_vote`, e a tela não pode oferecer o que sempre falharia.
    expect(screen.queryByRole('button', { name: /votar positivamente/i })).not.toBeInTheDocument();
  });

  it('não oferece editar nem retirar em fala de terceiro', async () => {
    mockSession(OTHER_ID);
    mockFetch(() => jsonResponse(THREAD));

    render(<TableConversation tableId={TABLE_ID} />);
    await screen.findByText('Comentário visível');

    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retirar/i })).not.toBeInTheDocument();
  });
});

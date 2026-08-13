// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentsConversation } from './CommentsConversation.js';
import {
  commentsThreadSchema,
  type CommentsConversationClient,
} from './conversation.js';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_ID = '22222222-2222-4222-8222-222222222222';
const LEGACY_ID = '33333333-3333-4333-8333-333333333333';

const thread = commentsThreadSchema.parse({
  state: 'fresh',
  snapshot_revision: 7,
  comments: [
    {
      id: ROOT_ID,
      parent_id: null,
      root_id: ROOT_ID,
      depth: 0,
      body_markdown: '![mapa](https://evil.example/rastreio.png)',
      created_at: '2026-08-13T10:00:00.000Z',
      edited_at: '2026-08-13T10:05:00.000Z',
      state: 'visible',
      author: {
        display_name: 'Ana',
        avatar_url: 'https://images.example/ana.png',
        badge: 'content_author',
        state: 'active',
      },
      upvotes: 4,
      downvotes: 1,
      score: 3,
      my_vote: 1,
      legacy: null,
    },
    {
      id: CHILD_ID,
      parent_id: ROOT_ID,
      root_id: ROOT_ID,
      depth: 1,
      body_markdown: 'Resposta em árvore',
      created_at: '2026-08-13T10:06:00.000Z',
      edited_at: null,
      state: 'visible',
      author: { display_name: 'Beto', avatar_url: null, badge: null, state: 'active' },
      upvotes: 0,
      downvotes: 0,
      score: 0,
      my_vote: 0,
      legacy: null,
    },
    {
      id: LEGACY_ID,
      parent_id: null,
      root_id: LEGACY_ID,
      depth: 0,
      body_markdown: 'Comentário antigo',
      created_at: '2020-01-02T03:04:05.000Z',
      edited_at: null,
      state: 'visible',
      author: { display_name: 'Autor antigo', avatar_url: null, badge: null, state: 'legacy' },
      upvotes: 0,
      downvotes: 0,
      score: 0,
      my_vote: null,
      legacy: { source: 'site', author_name: 'Autor antigo' },
    },
  ],
  more: [{ parent_id: ROOT_ID, count: 2, cursor: 'cursor-opaco' }],
  truncated: true,
});

const client = {
  read: vi.fn(),
  create: vi.fn(),
  reply: vi.fn(),
  edit: vi.fn(),
  withdraw: vi.fn(),
  vote: vi.fn(),
  report: vi.fn(),
} as unknown as CommentsConversationClient;

const reactTestEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

beforeAll(() => {
  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
});

beforeEach(() => {
  vi.clearAllMocks();
});

function renderConversation() {
  return renderToStaticMarkup(
    <CommentsConversation
      state={{ status: 'fresh', data: thread, updatedAt: 1, ageMs: 0 }}
      sort="best"
      onSortChange={() => undefined}
      client={client}
      onMoreLoaded={() => undefined}
      canCreate
      contentAuthorLabel="Autor do post"
      permissions={(comment) => comment.id === LEGACY_ID
        ? { reply: true }
        : { reply: true, edit: true, withdraw: true, vote: true, report: true }}
    />,
  );
}

describe('CommentsConversation', () => {
  it('renderiza a árvore completa nos cinco níveis visuais permitidos', () => {
    const ids = [
      'a0000000-0000-4000-8000-000000000000',
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000003',
      'a0000000-0000-4000-8000-000000000004',
    ];
    const deepThread = commentsThreadSchema.parse({
      state: 'fresh',
      snapshot_revision: 1,
      comments: ids.map((id, depth) => ({
        id,
        parent_id: depth === 0 ? null : ids[depth - 1],
        root_id: ids[0],
        depth,
        body_markdown: `Nível ${depth}`,
        created_at: '2026-08-13T10:00:00.000Z',
        edited_at: null,
        state: 'visible',
        author: { display_name: `Autor ${depth}`, avatar_url: null, badge: null, state: 'active' },
        upvotes: 0,
        downvotes: 0,
        score: 0,
        my_vote: 0,
        legacy: null,
      })),
      more: [],
      truncated: false,
    });
    const html = renderToStaticMarkup(
      <CommentsConversation
        state={{ status: 'fresh', data: deepThread, updatedAt: 1, ageMs: 0 }}
        sort="best"
        onSortChange={() => undefined}
        client={client}
        onMoreLoaded={() => undefined}
      />,
    );

    for (let depth = 0; depth <= 4; depth += 1) {
      expect(html).toContain(`data-comment-depth="${depth}"`);
    }
  });

  it('expõe quatro sorts e ações como controles nativos de teclado', () => {
    const html = renderConversation();

    for (const label of ['Melhores', 'Mais votados', 'Recentes', 'Mais antigos']) {
      expect(html).toContain(label);
    }
    for (const label of [
      'Publicar comentário',
      'Responder a Ana',
      'Editar',
      'Retirar',
      'Denunciar',
      'Mostrar mais 2 comentários',
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('<select');
    expect(html).toContain('<button');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-comment-depth="1"');
  });

  it('nunca transforma imagem Markdown do corpo em fetch remoto', () => {
    const html = renderConversation();

    expect(html).not.toContain('<img src="https://evil.example/rastreio.png"');
    expect(html).toContain('href="https://evil.example/rastreio.png"');
    expect(html).toContain('mapa — abrir imagem externa');
  });

  it('distingue legado sem avatar, badge ou affordance de perfil, mas permite resposta', () => {
    const html = renderConversation();
    const legacyStart = html.indexOf('Autor antigo');
    const legacyEnd = html.indexOf('</article>', legacyStart);
    const legacyMarkup = html.slice(legacyStart, legacyEnd);

    expect(legacyMarkup).toContain('comentário importado — autoria não verificada');
    expect(legacyMarkup).toContain('Responder a Autor antigo');
    expect(legacyMarkup).not.toContain('<img');
    expect(legacyMarkup).not.toContain('artificio-comments__badge');
    expect(legacyMarkup).not.toContain('href="/perfil');
  });

  it('liga sort, voto, edição, denúncia e more aos callbacks injetados', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onSortChange = vi.fn();
    const onMoreLoaded = vi.fn();
    vi.mocked(client.read).mockResolvedValue(thread);
    vi.mocked(client.vote).mockResolvedValue({ my_vote: 0, upvotes: 3, downvotes: 1, score: 2 });

    await act(async () => {
      root.render(
        <CommentsConversation
          state={{ status: 'fresh', data: thread, updatedAt: 1, ageMs: 0 }}
          sort="best"
          onSortChange={onSortChange}
          client={client}
          onMoreLoaded={onMoreLoaded}
          permissions={(comment) => comment.id === ROOT_ID
            ? { reply: true, edit: true, withdraw: true, vote: true, report: true }
            : { reply: true }}
        />,
      );
    });

    const sort = container.querySelector('select#artificio-comments-sort');
    expect(sort).toBeInstanceOf(HTMLSelectElement);
    await act(async () => {
      if (!(sort instanceof HTMLSelectElement)) return;
      sort.value = 'top';
      sort.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onSortChange).toHaveBeenCalledWith('top');

    const vote = container.querySelector(`button[aria-label="Votar positivamente no comentário de Ana"]`);
    await act(async () => {
      if (vote instanceof HTMLButtonElement) vote.click();
    });
    expect(client.vote).toHaveBeenCalledWith(ROOT_ID, 0);

    const buttonByText = (text: string) => Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === text);

    await act(async () => buttonByText('Editar')?.click());
    expect(container.textContent).toContain('Salvar edição');
    await act(async () => buttonByText('Cancelar')?.click());

    await act(async () => buttonByText('Denunciar')?.click());
    expect(container.textContent).toContain('Enviar denúncia');
    await act(async () => buttonByText('Cancelar')?.click());

    await act(async () => buttonByText('Mostrar mais 2 comentários')?.click());
    expect(client.read).toHaveBeenCalledWith('best', 'cursor-opaco');
    expect(onMoreLoaded).toHaveBeenCalledWith(
      thread,
      { parent_id: ROOT_ID, count: 2, cursor: 'cursor-opaco' },
    );

    await act(async () => root.unmount());
  });
});

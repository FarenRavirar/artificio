import { describe, expect, it } from 'vitest';

import {
  commentsThreadSchema,
  createCommentOperation,
  createCommentReportOperation,
  setCommentVoteOperation,
  mergeCommentsThreadPage,
} from './conversation.js';

const ROOT_ID = '11111111-1111-4111-8111-111111111111';

describe('contrato da conversa', () => {
  it('normaliza a árvore HTTP e rebaixa imagem para link antes da UI', () => {
    const thread = commentsThreadSchema.parse({
      state: 'fresh',
      snapshot_revision: 3,
      comments: [{
        id: ROOT_ID,
        parent_id: null,
        root_id: ROOT_ID,
        depth: 0,
        body_markdown: '![mapa](https://evil.example/rastreio.png)',
        created_at: '2026-08-13T10:00:00.000Z',
        edited_at: null,
        state: 'visible',
        author: {
          display_name: 'Ana',
          avatar_url: null,
          badge: null,
          state: 'active',
        },
        upvotes: 0,
        downvotes: 0,
        score: 0,
        my_vote: 0,
        legacy: null,
      }],
      more: [],
      truncated: false,
    });

    expect(thread.comments[0]?.body_markdown).toBe(
      '[mapa — abrir imagem externa](https://evil.example/rastreio.png)',
    );
  });

  it('recusa legado que sugere avatar ou badge de conta verificada', () => {
    const result = commentsThreadSchema.safeParse({
      state: 'fresh',
      snapshot_revision: 1,
      comments: [{
        id: ROOT_ID,
        parent_id: null,
        root_id: ROOT_ID,
        depth: 0,
        body_markdown: 'Texto legado',
        created_at: '2026-08-13T10:00:00.000Z',
        edited_at: null,
        state: 'visible',
        author: {
          display_name: 'Autor antigo',
          avatar_url: 'https://example.com/avatar.png',
          badge: 'content_author',
          state: 'legacy',
        },
        upvotes: 0,
        downvotes: 0,
        score: 0,
        my_vote: null,
        legacy: { source: 'site', author_name: 'Autor antigo' },
      }],
      more: [],
      truncated: false,
    });

    expect(result.success).toBe(false);
  });

  it('canonicaliza corpo na criação e fecha voto e denúncia por schema', () => {
    const create = createCommentOperation.inputSchema.parse({
      subjectType: 'site.post',
      subjectId: '42',
      bodyMarkdown: '![mapa](https://example.com/mapa.png)',
    });
    expect(create.bodyMarkdown).toContain('abrir imagem externa');

    expect(setCommentVoteOperation.inputSchema.safeParse({
      commentId: ROOT_ID,
      value: 2,
    }).success).toBe(false);
    expect(createCommentReportOperation.inputSchema.safeParse({
      commentId: ROOT_ID,
      reasonCode: 'inventado',
    }).success).toBe(false);
  });

  it('mescla página de more sem duplicar comentário nem conservar cursor consumido', () => {
    const base = commentsThreadSchema.parse({
      state: 'fresh',
      snapshot_revision: 3,
      comments: [],
      more: [{ parent_id: null, count: 1, cursor: 'consumido' }],
      truncated: true,
    });
    const page = commentsThreadSchema.parse({
      state: 'fresh',
      snapshot_revision: 3,
      comments: [],
      more: [{ parent_id: null, count: 2, cursor: 'seguinte' }],
      truncated: true,
    });

    expect(mergeCommentsThreadPage(base, page, 'consumido').more).toEqual([
      { parent_id: null, count: 2, cursor: 'seguinte' },
    ]);
    expect(() => mergeCommentsThreadPage(
      base,
      { ...page, snapshot_revision: 4 },
      'consumido',
    )).toThrow('revisões diferentes');
  });
});

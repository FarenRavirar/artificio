import { describe, expect, it } from 'vitest';
import type { ConversationComment } from '@artificio/comments/react';

import { permissionsFor } from './PostConversation.js';
import { SITE_SUBJECT_TYPE } from './useSiteConversation.js';

/**
 * T6.5 (spec 090) — legado do `site` é **imutável, mas respondível**
 * (decisão 23).
 *
 * O teste é da função de permissão, e não do componente montado: `permissionsFor`
 * é onde a decisão mora, e exercitá-la direto dispensa jsdom — que não é
 * dependência do `site`, e adicionar pacote para viabilizar teste é decisão do
 * mantenedor. O componente em volta é ligação de props para
 * `CommentsConversation`, que tem suíte própria no pacote.
 */

const comentario = (over: Partial<ConversationComment> = {}): ConversationComment => ({
  id: 'a0000000-0000-4000-8000-000000000000',
  parent_id: null,
  root_id: 'a0000000-0000-4000-8000-000000000000',
  depth: 0,
  body_markdown: 'olá',
  created_at: '2026-08-16T10:00:00.000Z',
  edited_at: null,
  state: 'visible',
  author: { display_name: 'Ana', avatar_url: null, badge: null, state: 'active' },
  upvotes: 0,
  downvotes: 0,
  score: 0,
  my_vote: 0,
  viewer_is_author: false,
  legacy: null,
  ...over,
} as ConversationComment);

const USUARIA = { id: 'user-1' };

describe('permissões da conversa do site', () => {
  it('não oferece nada sem sessão', () => {
    // Sem conta não há ação possível: exibir botão que sempre falha é pior que
    // não exibir.
    expect(permissionsFor(null)(comentario())).toEqual({});
  });

  it('legado aceita resposta e denúncia, mas nunca edição, retirada ou voto', () => {
    const legado = comentario({
      legacy: { source: 'site', author_name: 'Visitante Antigo', content_html: '<p>oi</p>', format: 'html' },
    } as Partial<ConversationComment>);

    const permissoes = permissionsFor(USUARIA)(legado);

    // Decisão 23: "antigo descreve proveniência, não congela a conversa" — daí
    // `reply`. Os 25 comentários importados do WordPress não têm conta por trás
    // (`legacy_author_name`, autoria não verificada), então editar ou retirar
    // não tem a quem atribuir, e votar daria placar a fala que nunca participou
    // do sistema de reputação.
    expect(permissoes.reply).toBe(true);
    expect(permissoes.report).toBe(true);
    expect(permissoes.edit).toBe(false);
    expect(permissoes.withdraw).toBe(false);
    expect(permissoes.vote).toBe(false);
  });

  it('autor edita e retira o próprio comentário, mas não vota nele', () => {
    const meu = comentario({ viewer_is_author: true } as Partial<ConversationComment>);

    const permissoes = permissionsFor(USUARIA)(meu);

    expect(permissoes.edit).toBe(true);
    expect(permissoes.withdraw).toBe(true);
    // Votar no próprio comentário inflaria o placar; denunciar a si mesmo não
    // tem sentido operacional.
    expect(permissoes.vote).toBe(false);
    expect(permissoes.report).toBe(false);
  });

  it('comentário retirado não volta a ser editável, e o oculto por revisão sim', () => {
    const retirado = comentario({ viewer_is_author: true, state: 'removed' } as Partial<ConversationComment>);
    const emRevisao = comentario({
      viewer_is_author: true,
      state: 'pending_review_hidden',
    } as Partial<ConversationComment>);

    // §4 separa os dois: `pending_review_hidden` "continua editável, e a edição
    // não o revela" — é quando o corpo sumiu que o autor mais precisa do
    // caminho —, enquanto retirado devolve `403`/`comment_removed`. Tratar os
    // dois como um só ofereceria botão que sempre falha, ou esconderia o que a
    // spec garante.
    expect(permissionsFor(USUARIA)(retirado).edit).toBe(false);
    expect(permissionsFor(USUARIA)(emRevisao).edit).toBe(true);

    // Oculto não recebe resposta nem voto, em nenhum dos dois estados.
    expect(permissionsFor(USUARIA)(retirado).reply).toBe(false);
    expect(permissionsFor(USUARIA)(emRevisao).reply).toBe(false);
  });

  it('comentário de outra pessoa aceita voto, resposta e denúncia', () => {
    const alheio = comentario();

    const permissoes = permissionsFor(USUARIA)(alheio);

    expect(permissoes.vote).toBe(true);
    expect(permissoes.reply).toBe(true);
    expect(permissoes.report).toBe(true);
    expect(permissoes.edit).toBe(false);
    expect(permissoes.withdraw).toBe(false);
  });

  it('o subject_type é o mesmo literal do guard do backend', () => {
    // Divergir aqui faria o `accounts.` receber assunto que o guard nunca
    // autoriza — `404` uniforme, sem erro de compilação em lugar nenhum.
    expect(SITE_SUBJECT_TYPE).toBe('site.post');
  });
});

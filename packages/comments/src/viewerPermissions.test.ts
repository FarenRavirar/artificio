import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversationComment } from './conversation.js';
import {
  canModerateComments,
  resolveViewerPermissions,
  type CommentModerationRole,
} from './viewerPermissions.js';

/**
 * Política de capacidades da conversa — a única, para os três apps.
 *
 * O que estes testes protegem não é uma regra nova: é o fato de haver **um** dono
 * dela. Antes, `site`, `mesas` e `downloads` mantinham cópias locais idênticas, e
 * as três divergiram do backend em conjunto — nenhuma oferecia a retirada por
 * moderador, embora a rota já existisse nas fachadas. Com a política aqui, um
 * teste basta para os três.
 */

const comment = (over: Partial<ConversationComment> = {}): ConversationComment => ({
  state: 'visible',
  viewer_is_author: false,
  legacy: null,
  ...over,
} as ConversationComment);

const MODERATOR = { role: 'moderator' as const };
const ADMIN = { role: 'admin' as const };
const COMUM = { role: 'user' as const };

describe('equivalência com o papel global do accounts.', () => {
  it('cobre exatamente os papéis declarados por UserRole em @artificio/auth', () => {
    // `viewerPermissions.ts` reafirma o alias em vez de importá-lo, para não
    // acoplar `comments` a `auth` — que não é dependência deste pacote e cujo
    // `tsc` recusaria o import (medido: TS2307).
    //
    // Por isso a equivalência é verificada lendo o FONTE do `auth`, e não por
    // atribuição de tipo: um `import type` aqui compila no vitest por resolução
    // transitiva do pnpm e falha no `tsc` do pacote — falso-verde exato que este
    // teste existe para não ser.
    const fonteDoAuth = readFileSync(
      resolve(__dirname, '../../auth/src/types.ts'),
      'utf8',
    );
    const declaracao = /export type UserRole =([^;]+);/.exec(fonteDoAuth);
    expect(declaracao).not.toBeNull();

    const papeisDoAuth = [...declaracao![1].matchAll(/"([^"]+)"|'([^']+)'/g)]
      .map((match) => match[1] ?? match[2])
      .sort();
    const papeisDaPolitica: CommentModerationRole[] = ['admin', 'moderator', 'user'];

    // Papel novo no `auth` quebra aqui e obriga a decidir se ele modera.
    expect(papeisDoAuth).toEqual([...papeisDaPolitica].sort());
  });

  it('trata como moderador só moderator e admin', () => {
    // Mesmo conjunto do guard do servidor (`communityModeration.ts:48-55`).
    // Divergir aqui ofereceria botão que sempre volta 403, ou o esconderia de
    // quem o servidor autoriza.
    expect(canModerateComments('moderator')).toBe(true);
    expect(canModerateComments('admin')).toBe(true);
    expect(canModerateComments('user')).toBe(false);
    expect(canModerateComments(undefined)).toBe(false);
  });
});

describe('retirada por moderação', () => {
  it('oferece o botão a moderador e admin em comentário alheio', () => {
    // É o defeito relatado pelo mantenedor em 2026-08-18: como admin, não havia
    // nenhuma forma de retirar um comentário pela conversa.
    const permissoes = resolveViewerPermissions({ viewer: ADMIN });
    expect(permissoes(comment()).moderateRemove).toBe(true);
    expect(resolveViewerPermissions({ viewer: MODERATOR })(comment()).moderateRemove).toBe(true);
  });

  it('não oferece a usuário comum', () => {
    expect(resolveViewerPermissions({ viewer: COMUM })(comment()).moderateRemove).toBe(false);
  });

  it('não oferece no próprio comentário, onde withdraw é o caminho certo', () => {
    // Auto-retirada não pede motivo nem gera registro de moderação contra si.
    const permissoes = resolveViewerPermissions({ viewer: ADMIN });
    const meu = permissoes(comment({ viewer_is_author: true }));

    expect(meu.moderateRemove).toBe(false);
    expect(meu.withdraw).toBe(true);
  });

  it('não oferece no que já está retirado', () => {
    const permissoes = resolveViewerPermissions({ viewer: ADMIN });
    expect(permissoes(comment({ state: 'removed' })).moderateRemove).toBe(false);
  });

  it('sobrevive ao assunto fechado, junto com a denúncia', () => {
    // Mesa encerrada fecha fala nova, não segurança: conteúdo abusivo não deixa
    // de ser abusivo porque a mesa acabou.
    const permissoes = resolveViewerPermissions({ viewer: ADMIN, subjectAcceptsWrites: false });
    const alvo = permissoes(comment());

    expect(alvo.moderateRemove).toBe(true);
    expect(alvo.report).toBe(true);
    expect(alvo.reply).toBe(false);
    expect(alvo.vote).toBe(false);
  });
});

describe('restauração por moderação — o par da retirada', () => {
  it('aparece exatamente onde a retirada não aparece, e nunca junto dela', () => {
    // Os dois cobrem os dois estados possíveis do alvo e são mutuamente
    // exclusivos. Sem a restauração, um clique errado em "Retirar" só se desfaz
    // pela fila de moderação — que hoje existe no `downloads` e em mais nenhum
    // app, então na prática não se desfaz.
    const permissoes = resolveViewerPermissions({ viewer: ADMIN });

    const visivel = permissoes(comment());
    expect(visivel.moderateRemove).toBe(true);
    expect(visivel.moderateRestore).toBe(false);

    const retirado = permissoes(comment({ state: 'removed' }));
    expect(retirado.moderateRemove).toBe(false);
    expect(retirado.moderateRestore).toBe(true);
  });

  it('não restaura o que só aguarda revisão', () => {
    // `pending_review_hidden` está oculto por processo, não por decisão de
    // moderação: restaurar ali daria a um clique o poder de aprovar o que a fila
    // ainda não julgou.
    const permissoes = resolveViewerPermissions({ viewer: ADMIN });
    expect(permissoes(comment({ state: 'pending_review_hidden' })).moderateRestore).toBe(false);
  });

  it('não oferece restauração a usuário comum', () => {
    const permissoes = resolveViewerPermissions({ viewer: COMUM });
    expect(permissoes(comment({ state: 'removed' })).moderateRestore).toBe(false);
  });

  it('sobrevive ao assunto fechado, como a retirada', () => {
    const permissoes = resolveViewerPermissions({ viewer: MODERATOR, subjectAcceptsWrites: false });
    expect(permissoes(comment({ state: 'removed' })).moderateRestore).toBe(true);
  });
});

describe('capacidades do visitante e do autor', () => {
  it('não oferece nada a quem não está logado, nem moderação', () => {
    expect(resolveViewerPermissions({ viewer: null })(comment())).toEqual({});
  });

  it('fecha resposta, edição e voto quando o assunto não aceita escrita', () => {
    // É o único parâmetro que varia entre os apps: só o `mesas` o usa.
    const fechado = resolveViewerPermissions({ viewer: COMUM, subjectAcceptsWrites: false });
    const meu = fechado(comment({ viewer_is_author: true }));

    expect(meu.reply).toBe(false);
    expect(meu.edit).toBe(false);
    expect(meu.vote).toBe(false);
    // Auto-retirada continua: o autor não perde o controle sobre a própria fala
    // porque o assunto fechou.
    expect(meu.withdraw).toBe(true);
  });

  it('mantém legado imutável e sem voto, mas respondível (decisão 23)', () => {
    const permissoes = resolveViewerPermissions({ viewer: COMUM });
    const antigo = permissoes(comment({
      legacy: { author_name: 'Anônimo', content_html: '<p>oi</p>' },
    } as Partial<ConversationComment>));

    expect(antigo.edit).toBe(false);
    expect(antigo.withdraw).toBe(false);
    expect(antigo.vote).toBe(false);
    expect(antigo.reply).toBe(true);
  });

  it('não deixa o autor votar no próprio comentário', () => {
    const permissoes = resolveViewerPermissions({ viewer: COMUM });
    expect(permissoes(comment({ viewer_is_author: true })).vote).toBe(false);
    expect(permissoes(comment()).vote).toBe(true);
  });
});

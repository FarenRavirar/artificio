import { describe, expect, it } from 'vitest';
import {
  MAX_COMMENT_DEPTH,
  placeComment,
  type CommentSubjectScope,
  type ParentComment,
} from './threadIntegrity.js';

const SUBJECT: CommentSubjectScope = {
  realm: 'prod',
  source_app: 'site',
  subject_type: 'post',
  subject_id: 'abc',
};

function parent(overrides: Partial<ParentComment> = {}): ParentComment {
  return {
    ...SUBJECT,
    id: 'pai',
    root_id: 'raiz',
    depth: 0,
    visibility_state: 'visible',
    ...overrides,
  };
}

describe('placeComment', () => {
  it('raiz nasce com depth 0 e sem pai', () => {
    // `root_id` fica nulo de propósito: a raiz é o próprio `root_id`, e o `id`
    // só existe depois do INSERT. Quem fecha isso é o handler, na transação.
    expect(placeComment(SUBJECT, null)).toEqual({
      ok: true,
      parent_id: null,
      root_id: null,
      depth: 0,
    });
  });

  it('resposta herda o root_id do pai, nunca o id do pai', () => {
    // O erro fácil aqui é usar `parent.id` como `root_id`: funciona para resposta
    // a uma raiz (onde os dois coincidem) e quebra silenciosamente a partir do
    // segundo nível, criando várias "raízes" dentro da mesma árvore.
    const result = placeComment(SUBJECT, parent({ id: 'n2', root_id: 'raiz', depth: 1 }));

    expect(result).toEqual({ ok: true, parent_id: 'n2', root_id: 'raiz', depth: 2 });
  });

  it.each([0, 1, 2, 3])('aceita resposta a pai em depth=%i', (depth) => {
    const result = placeComment(SUBJECT, parent({ depth }));

    expect(result).toMatchObject({ ok: true, depth: depth + 1 });
  });

  it('recusa resposta que passaria de depth=4', () => {
    // `feito quando`: "além de depth=4 é recusada". O pai em 4 é o último nível
    // que aceita leitura, não resposta.
    expect(placeComment(SUBJECT, parent({ depth: MAX_COMMENT_DEPTH }))).toEqual({
      ok: false,
      code: 'depth_exceeded',
    });
  });

  it('o teto é 4, não 2 — a versão anterior da task foi revogada pelo grilling', () => {
    // Regressão de contrato: `depth<=2` (três níveis) foi supersedido por
    // `depth<=4` (cinco níveis) em T0.8. Um pai em depth=2 precisa ACEITAR.
    expect(placeComment(SUBJECT, parent({ depth: 2 }))).toMatchObject({ ok: true, depth: 3 });
  });

  describe('pai fora do assunto é tratado como inexistente', () => {
    // Nunca `403`/`parent_not_found` distinto: dizer "existe mas não é seu"
    // confirma o identificador para quem está sondando entre realms e apps.
    it.each([
      ['outro realm', { realm: 'beta' }],
      ['outro app', { source_app: 'downloads' }],
      ['outro tipo de assunto', { subject_type: 'material' }],
      ['outro assunto do mesmo tipo', { subject_id: 'xyz' }],
    ])('%s', (_caso, diferenca) => {
      expect(placeComment(SUBJECT, parent(diferenca))).toEqual({
        ok: false,
        code: 'parent_not_found',
      });
    });
  });

  describe('estado do pai', () => {
    it.each([
      ['retirado pelo autor', 'author_removed'],
      ['removido por moderação', 'moderator_removed'],
      ['oculto sob revisão', 'pending_review_hidden'],
    ])('recusa resposta a comentário %s', (_caso, visibility_state) => {
      expect(placeComment(SUBJECT, parent({ visibility_state }))).toEqual({
        ok: false,
        code: 'parent_not_accepting_replies',
      });
    });

    it('aceita resposta a pai visível', () => {
      expect(placeComment(SUBJECT, parent({ visibility_state: 'visible' }))).toMatchObject({
        ok: true,
      });
    });
  });

  it('resposta a comentário legado é ACEITA (decisão 23)', () => {
    // Inversão explícita da versão anterior da task, que recusava. Legado é
    // imutável e sem voto, mas pode ser pai: "antigo descreve proveniência, não
    // congela a conversa". O legado não tem marca própria nesta função —
    // justamente porque não há regra diferente a aplicar.
    const legado = parent({ id: 'legado-1', root_id: 'legado-1', depth: 0 });

    expect(placeComment(SUBJECT, legado)).toEqual({
      ok: true,
      parent_id: 'legado-1',
      root_id: 'legado-1',
      depth: 1,
    });
  });

  it('escopo é comparado campo a campo, sem depender da ordem das chaves', () => {
    // Guarda contra uma implementação por `JSON.stringify` dos dois objetos, que
    // passaria nos testes acima e falharia com as chaves em outra ordem — o
    // `SELECT` do handler não garante ordem de propriedade nenhuma.
    const invertido: ParentComment = {
      subject_id: 'abc',
      subject_type: 'post',
      source_app: 'site',
      realm: 'prod',
      visibility_state: 'visible',
      depth: 0,
      root_id: 'raiz',
      id: 'pai',
    };

    expect(placeComment(SUBJECT, invertido)).toMatchObject({ ok: true });
  });

  it('a checagem de assunto vem antes da de profundidade', () => {
    // Pai de outro realm E em depth=4: precisa sair como `parent_not_found`.
    // Vazar `depth_exceeded` confirmaria que o id existe e que a árvore dele está
    // cheia — dois fatos sobre outro realm.
    const alheioELotado = parent({ realm: 'beta', depth: MAX_COMMENT_DEPTH });

    expect(placeComment(SUBJECT, alheioELotado)).toEqual({
      ok: false,
      code: 'parent_not_found',
    });
  });

  it('a checagem de estado vem antes da de profundidade', () => {
    // Pai removido E em depth=4: o motivo útil é o estado. `depth_exceeded`
    // faria o cliente tentar responder mais acima na árvore, o que também
    // falharia — mensagem que manda o usuário para o lugar errado.
    expect(
      placeComment(SUBJECT, parent({ visibility_state: 'author_removed', depth: MAX_COMMENT_DEPTH })),
    ).toEqual({ ok: false, code: 'parent_not_accepting_replies' });
  });
});

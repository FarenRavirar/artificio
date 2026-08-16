import type { Kysely } from 'kysely';
import { runSubjectAuthorizationConformance } from '@artificio/comments';
import type { Database } from '../db/types';
import {
  DOWNLOADS_SUBJECT_TYPE,
  createMaterialSubjectGuard,
  materialCanonicalPath,
} from './materialSubjectGuard';

/**
 * T5.3 (spec 090) — conformidade do guard do `downloads`.
 *
 * A suíte oficial (`runSubjectAuthorizationConformance`) é o que o pacote
 * fornece justamente porque o tipo `CommentSubjectGuard` obriga a assinatura,
 * não o comportamento: um guard que autorize tudo satisfaz o tipo e destrói a
 * garantia inteira. Ela roda aqui contra a implementação real; os testes de
 * domínio abaixo cobrem o que é específico do `downloads`.
 */

const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';

interface MaterialRow {
  id: string;
  slug: string;
  editorial_state: string;
  owner_user_id: string | null;
}

const MATERIALS: Record<string, MaterialRow> = {
  'published-with-owner': {
    id: 'published-with-owner',
    slug: 'guia-de-magia',
    editorial_state: 'published',
    owner_user_id: OWNER,
  },
  'published-orphan': {
    id: 'published-orphan',
    slug: 'acervo-importado',
    editorial_state: 'published',
    owner_user_id: null,
  },
  'draft-of-owner': {
    id: 'draft-of-owner',
    slug: 'rascunho',
    editorial_state: 'draft',
    owner_user_id: OWNER,
  },
  'in-review-orphan': {
    id: 'in-review-orphan',
    slug: 'em-revisao',
    editorial_state: 'in_review',
    owner_user_id: null,
  },
  withdrawn: {
    id: 'withdrawn',
    slug: 'retirado',
    editorial_state: 'withdrawn',
    owner_user_id: OWNER,
  },
  rejected: {
    id: 'rejected',
    slug: 'rejeitado',
    editorial_state: 'rejected',
    owner_user_id: OWNER,
  },
};

/**
 * Duplo do Kysely no formato exato da consulta do guard. Preso à forma da
 * query de propósito: se o guard trocar o `leftJoin` por outra coisa, este
 * duplo quebra e obriga a revisar o teste junto — um mock frouxo passaria a
 * validar nada.
 */
function fakeDb(): Kysely<Database> {
  let requestedId: string | null = null;
  const builder = {
    // `leftJoin` recebe callback desde a correção do OR de `creator_id`
    // (material de scraper contra material humano); o duplo ignora o corpo do
    // join porque a resolução de dono é fixada nas linhas de `MATERIALS`.
    leftJoin: () => builder,
    select: () => builder,
    where: (_column: string, _op: string, value: string) => {
      requestedId = value;
      return builder;
    },
    // O `ORDER BY creator_match_rank` da consulta real desempata quando o `OR`
    // do join casa duas linhas de criador. O duplo só precisa aceitar a chamada:
    // a resolução de dono aqui é fixada em `MATERIALS`, uma linha por material.
    orderBy: () => builder,
    executeTakeFirst: () => Promise.resolve(requestedId ? MATERIALS[requestedId] : undefined),
  };
  return { selectFrom: () => builder } as unknown as Kysely<Database>;
}

const guard = createMaterialSubjectGuard(fakeDb());

const subject = (subjectId: string) => ({
  subjectType: DOWNLOADS_SUBJECT_TYPE,
  subjectId,
});

describe('guard de assunto do downloads — suíte de conformidade do pacote', () => {
  it('passa em todas as checagens, com sensibilidade ao ator coberta', async () => {
    const report = await runSubjectAuthorizationConformance(guard, {
      commentableWithOwner: {
        label: 'material publicado, criador com conta',
        subject: subject('published-with-owner'),
        actingUserId: STRANGER,
      },
      commentableWithoutOwner: {
        label: 'material publicado do acervo importado, criador sem conta',
        subject: subject('published-orphan'),
        actingUserId: STRANGER,
      },
      missing: {
        label: 'id que não existe no acervo',
        subject: subject('nao-existe'),
        actingUserId: STRANGER,
      },
      invisibleToActor: {
        label: 'material em revisão, ator não é o criador',
        subject: subject('in-review-orphan'),
        actingUserId: STRANGER,
      },
      notCommentable: {
        label: 'material retirado — visível por link, fechado a comentário',
        subject: subject('withdrawn'),
        actingUserId: STRANGER,
      },
      // `visibleOnlyToActor` é deliberadamente OMITIDA, e a lacuna é medida
      // logo abaixo em vez de escondida.
      //
      // A fixture pede um alvo **comentável para o ator e invisível para
      // terceiro**. O `downloads` não tem essa categoria: `published` é a única
      // condição de visibilidade pública em toda consulta do módulo
      // (`routes/materials.ts:174,406,412,419,431,443`), e material publicado é
      // visível para qualquer um. Rascunho do próprio criador chega perto, mas
      // é o caso oposto — visível ao dono e **não comentável**, coberto no
      // teste de domínio abaixo.
      //
      // Fabricar aqui um cenário que o domínio não tem faria a suíte medir o
      // mock, não o guard. Se o `downloads` ganhar material restrito por ator
      // (grupo fechado, acesso pago), esta fixture passa a ser obrigatória.
    });

    const falhas = report.checks.filter((check) => !check.passed);
    expect(falhas.map((check) => `${check.name}: ${check.detail ?? ''}`)).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.actorSensitivityCovered).toBe(false);
  });
});

describe('guard de assunto do downloads — regras do domínio', () => {
  it('autoriza material publicado devolvendo dono e caminho canônico', async () => {
    const result = await guard(subject('published-with-owner'), STRANGER);

    expect(result).toEqual({
      authorized: true,
      authorization: {
        exists: true,
        visible: true,
        commentable: true,
        ownerUserId: OWNER,
        canonicalPath: '/materiais/guia-de-magia',
      },
    });
  });

  it('trata criador sem conta como dono nulo, sem inventar destinatário', async () => {
    const result = await guard(subject('published-orphan'), STRANGER);

    expect(result.authorized).toBe(true);
    if (result.authorized) expect(result.authorization.ownerUserId).toBeNull();
  });

  it('esconde rascunho de terceiro e o revela ao próprio criador, sem abrir comentário', async () => {
    expect(await guard(subject('draft-of-owner'), STRANGER)).toEqual({
      authorized: false,
      reason: 'not_visible',
    });
    expect(await guard(subject('draft-of-owner'), OWNER)).toEqual({
      authorized: false,
      reason: 'not_commentable',
    });
  });

  it('recusa material rejeitado e retirado como fechado, não como inexistente', async () => {
    expect(await guard(subject('rejected'), STRANGER)).toEqual({
      authorized: false,
      reason: 'not_commentable',
    });
    expect(await guard(subject('withdrawn'), STRANGER)).toEqual({
      authorized: false,
      reason: 'not_commentable',
    });
  });

  it('recusa subject_type de outro módulo sem consultar o acervo', async () => {
    const result = await guard(
      { subjectType: 'mesas.table', subjectId: 'published-with-owner' },
      STRANGER,
    );

    expect(result).toEqual({ authorized: false, reason: 'not_found' });
  });

  it('escapa o slug no caminho canônico', () => {
    expect(materialCanonicalPath('guia de magia')).toBe('/materiais/guia%20de%20magia');
    expect(materialCanonicalPath('a/b')).toBe('/materiais/a%2Fb');
  });
});

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
  'aaaaaaaa-0001-4000-8000-000000000001': {
    id: 'aaaaaaaa-0001-4000-8000-000000000001',
    slug: 'guia-de-magia',
    editorial_state: 'published',
    owner_user_id: OWNER,
  },
  'aaaaaaaa-0002-4000-8000-000000000002': {
    id: 'aaaaaaaa-0002-4000-8000-000000000002',
    slug: 'acervo-importado',
    editorial_state: 'published',
    owner_user_id: null,
  },
  'aaaaaaaa-0003-4000-8000-000000000003': {
    id: 'aaaaaaaa-0003-4000-8000-000000000003',
    slug: 'rascunho',
    editorial_state: 'draft',
    owner_user_id: OWNER,
  },
  'aaaaaaaa-0004-4000-8000-000000000004': {
    id: 'aaaaaaaa-0004-4000-8000-000000000004',
    slug: 'em-revisao',
    editorial_state: 'in_review',
    owner_user_id: null,
  },
  'aaaaaaaa-0005-4000-8000-000000000005': {
    id: 'aaaaaaaa-0005-4000-8000-000000000005',
    slug: 'retirado',
    editorial_state: 'withdrawn',
    owner_user_id: OWNER,
  },
  'aaaaaaaa-0006-4000-8000-000000000006': {
    id: 'aaaaaaaa-0006-4000-8000-000000000006',
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
        subject: subject('aaaaaaaa-0001-4000-8000-000000000001'),
        actingUserId: STRANGER,
      },
      commentableWithoutOwner: {
        label: 'material publicado do acervo importado, criador sem conta',
        subject: subject('aaaaaaaa-0002-4000-8000-000000000002'),
        actingUserId: STRANGER,
      },
      missing: {
        label: 'id que não existe no acervo',
        subject: subject('aaaaaaaa-0009-4000-8000-000000000009'),
        actingUserId: STRANGER,
      },
      invisibleToActor: {
        label: 'material em revisão, ator não é o criador',
        subject: subject('aaaaaaaa-0004-4000-8000-000000000004'),
        actingUserId: STRANGER,
      },
      notCommentable: {
        label: 'material retirado — visível por link, fechado a comentário',
        subject: subject('aaaaaaaa-0005-4000-8000-000000000005'),
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
    const result = await guard(subject('aaaaaaaa-0001-4000-8000-000000000001'), STRANGER);

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
    const result = await guard(subject('aaaaaaaa-0002-4000-8000-000000000002'), STRANGER);

    expect(result.authorized).toBe(true);
    if (result.authorized) expect(result.authorization.ownerUserId).toBeNull();
  });

  it('esconde rascunho de terceiro e o revela ao próprio criador, sem abrir comentário', async () => {
    expect(await guard(subject('aaaaaaaa-0003-4000-8000-000000000003'), STRANGER)).toEqual({
      authorized: false,
      reason: 'not_visible',
    });
    expect(await guard(subject('aaaaaaaa-0003-4000-8000-000000000003'), OWNER)).toEqual({
      authorized: false,
      reason: 'not_commentable',
    });
  });

  it('recusa material rejeitado e retirado como fechado, não como inexistente', async () => {
    expect(await guard(subject('aaaaaaaa-0006-4000-8000-000000000006'), STRANGER)).toEqual({
      authorized: false,
      reason: 'not_commentable',
    });
    expect(await guard(subject('aaaaaaaa-0005-4000-8000-000000000005'), STRANGER)).toEqual({
      authorized: false,
      reason: 'not_commentable',
    });
  });

  it('recusa subject_type de outro módulo sem consultar o acervo', async () => {
    const result = await guard(
      { subjectType: 'mesas.table', subjectId: 'aaaaaaaa-0001-4000-8000-000000000001' },
      STRANGER,
    );

    expect(result).toEqual({ authorized: false, reason: 'not_found' });
  });

  it('escapa o slug no caminho canônico', () => {
    expect(materialCanonicalPath('guia de magia')).toBe('/materiais/guia%20de%20magia');
    expect(materialCanonicalPath('a/b')).toBe('/materiais/a%2Fb');
  });
});

describe('guard de assunto do downloads — id malformado', () => {
  /**
   * Banco que EXPLODE se for consultado.
   *
   * Contra o duplo normal este teste passaria mesmo sem a guarda de formato: o
   * `fakeDb` devolve `undefined` para qualquer id desconhecido, e `undefined`
   * também vira `not_found`. Ou seja, ele mediria o mock, não a correção
   * (achado de review, PR #273). Aqui o veredito só pode ser `not_found` se a
   * guarda tiver recusado ANTES do `selectFrom` — que é exatamente a afirmação
   * em teste, porque em PostgreSQL real a consulta não devolve vazio: ela morre
   * com `invalid input syntax for type uuid`.
   */
  function explodingDb(): Kysely<Database> {
    return {
      selectFrom: () => {
        throw new Error('invalid input syntax for type uuid');
      },
    } as unknown as Kysely<Database>;
  }

  it('recusa slug como not_found, sem deixar o driver estourar 500', async () => {
    // O caso real (beta, 2026-08-18): a conversa era pedida com o SLUG do
    // material no lugar do id, e a query morria com `invalid input syntax for
    // type uuid` (`uuid.c:133`) — "Erro interno no servidor" ao abrir a página.
    // `download_material.id` é `uuid`, medido no banco.
    const strictGuard = createMaterialSubjectGuard(explodingDb());

    expect(await strictGuard(subject('quem-tem-medo-do-valete'), STRANGER)).toEqual({
      authorized: false,
      reason: 'not_found',
    });
  });

  it('recusa subject_type alheio sem tocar no banco', async () => {
    // Mesma lógica de prova para a primeira guarda da função: o retorno tem de
    // vir antes da consulta.
    const strictGuard = createMaterialSubjectGuard(explodingDb());

    expect(
      await strictGuard(
        { subjectType: 'mesas.table', subjectId: 'aaaaaaaa-0001-4000-8000-000000000001' },
        STRANGER,
      ),
    ).toEqual({ authorized: false, reason: 'not_found' });
  });
});

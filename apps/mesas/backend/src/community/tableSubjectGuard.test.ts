import type { Kysely } from 'kysely';
import { runSubjectAuthorizationConformance } from '@artificio/comments';
import type { Database } from '../db/types.js';
import {
  MESAS_SUBJECT_TYPE,
  createTableSubjectGuard,
  tableCanonicalPath,
} from './tableSubjectGuard.js';

/**
 * T7.2/T7.3 (spec 090) — conformidade do guard do `mesas`.
 *
 * A suíte oficial (`runSubjectAuthorizationConformance`) existe porque o tipo
 * `CommentSubjectGuard` obriga a assinatura, não o comportamento: um guard que
 * autorize tudo satisfaz o tipo e destrói a garantia inteira. Ela roda aqui
 * contra a implementação real; os testes de domínio abaixo cobrem o que é
 * específico do `mesas` — sobretudo a conversão `gm_id` → `google_id`, que é o
 * defeito nomeado por T7.2.
 */

/** UUID local (`mesas.users.id`) — o que `tables.gm_id` referencia. */
const GM_LOCAL_ID = '11111111-1111-4111-8111-111111111111';
/** ID da MESMA conta no `accounts.` (`users.google_id`). É este que viaja. */
const GM_GOOGLE_ID = '99999999-9999-4999-8999-999999999999';
const STRANGER = '22222222-2222-4222-8222-222222222222';

const ATIVA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORFA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RASCUNHO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ENCERRADA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const INEXISTENTE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ANUNCIADA = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const SEM_CONTA = '12121212-1212-4121-8121-121212121212';
/** Mesa cujo mestre ainda tem `google_sub` legado na coluna (15 de 68 em produção). */
const DONO_LEGADO = '13131313-1313-4131-8131-131313131313';

/** Conta de quem ANUNCIOU a mesa, que pode não ser quem mestra (`publisher_role`). */
const ANNOUNCER_GOOGLE_ID = '88888888-8888-4888-8888-888888888888';

interface TableRow {
  id: string;
  slug: string;
  status: string;
  archived_at: Date | null;
  origin: string | null;
  created_at: Date;
  starts_at: Date | null;
  owner_google_id: string | null;
}

const base = {
  archived_at: null,
  origin: 'manual',
  created_at: new Date('2026-08-01T00:00:00.000Z'),
  starts_at: null,
};

const TABLES: Record<string, TableRow> = {
  [ATIVA]: { ...base, id: ATIVA, slug: 'mesa-de-teste', status: 'active', owner_google_id: GM_GOOGLE_ID },
  // `google_sub` de 21 dígitos, o formato real dos 15 registros legados de
  // produção. As demais fixtures são UUID, e era essa a lacuna que deixou o
  // defeito chegar em produção com a suíte verde.
  [DONO_LEGADO]: { ...base, id: DONO_LEGADO, slug: 'mesa-dono-legado', status: 'active', owner_google_id: '106884162561229573720' },
  // Mesa órfã: `gm_id` nulo, então o LEFT JOIN não casa e o dono é nulo. Caso
  // real do acervo importado, não defensividade.
  [ORFA]: { ...base, id: ORFA, slug: 'mesa-orfa', status: 'active', owner_google_id: null },
  [RASCUNHO]: { ...base, id: RASCUNHO, slug: 'mesa-rascunho', status: 'draft', owner_google_id: GM_GOOGLE_ID },
  [ENCERRADA]: { ...base, id: ENCERRADA, slug: 'mesa-encerrada', status: 'ended', owner_google_id: GM_GOOGLE_ID },
  // `publisher_role = announcer`: quem publicou tem conta, quem mestra aparece
  // só em `actual_gm_name`. O JOIN resolve pela conta, que é a decisão de 15b.
  [ANUNCIADA]: { ...base, id: ANUNCIADA, slug: 'mesa-anunciada', status: 'active', owner_google_id: ANNOUNCER_GOOGLE_ID },
  // Mesa com mestre nomeado e SEM conta vinculada: `gm_id` nulo, LEFT JOIN sem
  // par. Distinta da órfã só na intenção — para o guard, as duas são dono nulo.
  [SEM_CONTA]: { ...base, id: SEM_CONTA, slug: 'mesa-mestre-externo', status: 'active', owner_google_id: null },
};

/**
 * Cadeia de `leftJoin` que a consulta real precisa percorrer:
 * `tables.gm_id → gm_profiles.id → gm_profiles.user_id → users.id`.
 *
 * O duplo **registra** os joins em vez de só aceitá-los, e o teste abaixo
 * afirma a cadeia. A versão anterior devolvia `builder` para qualquer chamada e
 * lia o dono de `TABLES` já resolvido — com isso, um join direto
 * `users.id = tables.gm_id` passava aqui e casava **zero** linhas em produção,
 * porque `gm_id` referencia `gm_profiles(id)`, não `users(id)`
 * (`migration_01_base_schema.sql:124`). Duplo que aceita qualquer consulta não
 * testa a consulta (achado de review, PR #268).
 */
const EXPECTED_JOINS = [
  ['gm_profiles', 'gm_profiles.id', 'tables.gm_id'],
  ['users', 'users.id', 'gm_profiles.user_id'],
] as const;

function fakeDb(): { db: Kysely<Database>; joins: string[][] } {
  let requestedId: string | null = null;
  const joins: string[][] = [];
  const builder: Record<string, unknown> = {
    leftJoin: (table: string, left: string, right: string) => {
      joins.push([table, left, right]);
      return builder;
    },
    select: () => builder,
    where: (_column: string, _op: string, value: string) => {
      requestedId = value;
      return builder;
    },
    executeTakeFirst: () => Promise.resolve(requestedId ? TABLES[requestedId] : undefined),
  };
  return { db: { selectFrom: () => builder } as unknown as Kysely<Database>, joins };
}

const fake = fakeDb();
const guard = createTableSubjectGuard(fake.db);

const subject = (subjectId: string) => ({
  subjectType: MESAS_SUBJECT_TYPE,
  subjectId,
});

describe('guard de assunto do mesas — suíte de conformidade do pacote', () => {
  it('passa em todas as checagens', async () => {
    const report = await runSubjectAuthorizationConformance(guard, {
      commentableWithOwner: {
        label: 'mesa ativa, mestre com conta',
        subject: subject(ATIVA),
        actingUserId: STRANGER,
      },
      commentableWithoutOwner: {
        label: 'mesa órfã, sem gm_id',
        subject: subject(ORFA),
        actingUserId: STRANGER,
      },
      missing: {
        label: 'mesa que não existe',
        subject: subject(INEXISTENTE),
        actingUserId: STRANGER,
      },
      invisibleToActor: {
        label: 'mesa em rascunho',
        subject: subject(RASCUNHO),
        actingUserId: STRANGER,
      },
      notCommentable: {
        label: 'mesa encerrada — lê, não escreve',
        subject: subject(ENCERRADA),
        actingUserId: STRANGER,
      },
      // `visibleOnlyToActor` é OMITIDA de propósito, e a lacuna é medida em
      // `actorSensitivityCovered`: o `mesas` não tem visibilidade por ator —
      // rascunho é invisível inclusive para o próprio mestre nesta fachada,
      // porque o painel dele é superfície autenticada separada. Ver o
      // comentário em `tableSubjectGuard.ts`.
    });

    const falhas = report.checks.filter((check) => !check.passed);
    expect(falhas.map((check) => `${check.name}: ${check.detail ?? ''}`)).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.actorSensitivityCovered).toBe(false);
  });
});

describe('guard de assunto do mesas — domínio', () => {
  it('atravessa gm_profiles para chegar em users (T7.2)', async () => {
    // O defeito que este teste fixa: `tables.gm_id` referencia
    // `gm_profiles(id)`, e não `users(id)`. Unir direto em `users.id` compila,
    // passa em duplo permissivo e casa **zero** linhas em produção — medido:
    // 27 mesas com `gm_id`, 0 pelo join direto, 27 pelo caminho correto. O
    // sintoma seria `ownerUserId: null`, indistinguível de mesa órfã.
    fake.joins.length = 0;
    await guard(subject(ATIVA), STRANGER);

    expect(fake.joins).toEqual(EXPECTED_JOINS.map((j) => [...j]));
  });

  it('devolve o id do mestre no accounts, nunca o UUID local (T7.2)', async () => {
    const result = await guard(subject(ATIVA), STRANGER);

    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    // O coração de T7.2: mandar `GM_LOCAL_ID` associaria a mesa a uma conta
    // inexistente no `accounts.`, e o publicador nunca receberia notificação do
    // próprio anúncio — sem erro em lugar nenhum.
    //
    // A coluna se chama `google_id` por herança: hoje ela guarda o `users.id` do
    // `accounts.` (`middleware/auth.ts:73` grava `session.user.id`).
    expect(result.authorization.ownerUserId).toBe(GM_GOOGLE_ID);
    expect(result.authorization.ownerUserId).not.toBe(GM_LOCAL_ID);
  });

  it('degrada `google_sub` legado para null em vez de estourar 400 no accounts', async () => {
    // Este caso faltava, e é por isso que o defeito chegou a produção com a
    // suíte verde: as duas fixtures acima são UUID, então o formato legado —
    // 21 dígitos, medido em 15 dos 68 usuários de produção — nunca era
    // exercitado. Bloqueava comentário em 14 mesas.
    const result = await guard(subject(DONO_LEGADO), STRANGER);

    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    expect(result.authorization.ownerUserId).toBeNull();
  });

  it('monta o canonical_path com slug e não com id', async () => {
    const result = await guard(subject(ATIVA), STRANGER);

    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    // `/mesas/<UUID>` abriria "mesa não encontrada" em todo link de volta — o
    // defeito que a PR #257 corrigiu no `downloads`.
    expect(result.authorization.canonicalPath).toBe('/mesas/mesa-de-teste');
    expect(result.authorization.canonicalPath).not.toContain(ATIVA);
  });

  it('mesa órfã autoriza com dono nulo, sem inventar destinatário', async () => {
    const result = await guard(subject(ORFA), STRANGER);

    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    expect(result.authorization.ownerUserId).toBeNull();
  });

  it('recusa subject_type de outro app sem consultar o banco', async () => {
    const result = await guard(
      { subjectType: 'downloads.material', subjectId: ATIVA },
      STRANGER,
    );

    expect(result).toEqual({ authorized: false, reason: 'not_found' });
  });

  it('recusa subject_id malformado como not_found, não como erro de driver', async () => {
    // Sem a guarda de formato, o texto chegaria ao Postgres e a query morreria
    // com `invalid input syntax for type uuid` — `500` onde o certo é `404`.
    const result = await guard(subject('nao-e-uuid'), STRANGER);

    expect(result).toEqual({ authorized: false, reason: 'not_found' });
  });

  it('rascunho é not_visible e encerrada é not_commentable', async () => {
    // A distinção é o requisito 26a: a conversa de uma mesa encerrada continua
    // legível; a de um rascunho nunca existiu publicamente.
    await expect(guard(subject(RASCUNHO), STRANGER)).resolves.toEqual({
      authorized: false,
      reason: 'not_visible',
    });
    await expect(guard(subject(ENCERRADA), STRANGER)).resolves.toEqual({
      authorized: false,
      reason: 'not_commentable',
    });
  });

  // T7.6 (requisito 15b) — destinatário nas mesas especiais. Decisão do
  // mantenedor (2026-07-27): recebe a CONTA PUBLICADORA, a única com vínculo
  // real no `accounts.`. Os três casos abaixo são os que a task nomeia.

  it('anunciante que não mestra ainda recebe: quem publicou tem conta', async () => {
    // `publisher_role = announcer` com `actual_gm_name` preenchido: quem
    // anunciou tem conta, quem mestra não. O destinatário é a conta, porque é
    // a única para onde há como notificar — badge segue a mesma regra.
    const result = await guard(subject(ANUNCIADA), STRANGER);

    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    expect(result.authorization.ownerUserId).toBe(ANNOUNCER_GOOGLE_ID);
  });

  it('mestre nomeado sem conta não vira destinatário inventado', async () => {
    // Mesa com `actual_gm_name` preenchido e `gm_id` nulo: há nome de mestre e
    // não há conta. Retornar qualquer coisa aqui criaria destinatário que não
    // existe, e a notificação iria para o vazio sem erro em lugar nenhum.
    const result = await guard(subject(SEM_CONTA), STRANGER);

    expect(result.authorized).toBe(true);
    if (!result.authorized) return;
    expect(result.authorization.ownerUserId).toBeNull();
  });

  it('tableCanonicalPath escapa o slug', () => {
    expect(tableCanonicalPath('mesa com espaço')).toBe('/mesas/mesa%20com%20espa%C3%A7o');
  });
});

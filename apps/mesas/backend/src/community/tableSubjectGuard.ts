import {
  authorize,
  refuse,
  type CommentSubjectGuard,
  type CommentSubjectRef,
  type SubjectAuthorizationResult,
} from '@artificio/comments';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';
import { db as defaultDb } from '../db/index.js';
import { canReadTableComments, canWriteTableComments } from '../utils/tableVisibility.js';

/**
 * T7.2/T7.3 (spec 090) — guard `CommentSubjectAuthorization` do `mesas`.
 *
 * ## Por que ele existe
 *
 * O `accounts.` recebe `(realm, source_app, subject_type, subject_id)` e **não
 * consulta tabela de domínio nenhuma** — ele não sabe o que é uma mesa de RPG.
 * Referência opaca não substitui autorização por objeto (`plan.md` §Referência
 * opaca, OWASP IDOR): quem afirma que a mesa existe, está visível e aceita
 * comentário é este backend, a cada request, e a afirmação só é confiável
 * porque viaja por credencial de serviço, nunca por sessão de navegador.
 *
 * O contrato e a suíte de conformidade vivem em `@artificio/comments`; a
 * consulta contra `tables` é o que pertence a este app.
 */

/** O único `subject_type` que o `mesas` fala (`contrato-http-v1.md:84`). */
export const MESAS_SUBJECT_TYPE = 'mesas.table';

/**
 * `canonical_path` da mesa — caminho, **nunca URL inteira** (requisito 5b). A
 * origem é resolvida no `accounts.` por `(realm, source_app)` allowlisted;
 * mandar URL pronta daqui abriria phishing e open redirect.
 *
 * **Usa o slug, nunca o id.** A rota pública é `/mesas/:slug`
 * (`frontend/src/App.tsx:54`) e o backend resolve por slug
 * (`routes/tables.ts`, `GET /:slug`), então `/mesas/<UUID>` abriria "mesa não
 * encontrada" em todo link de volta — o mesmo defeito que a PR #257 corrigiu
 * no `downloads`.
 */
export function tableCanonicalPath(slug: string): string {
  return `/mesas/${encodeURIComponent(slug)}`;
}

/**
 * Cria o guard. O `Kysely` entra por parâmetro para o teste rodar contra um
 * duplo sem subir banco — a decisão é pura consulta, e fabricar os cenários de
 * visibilidade em PostgreSQL real custaria fixture de integração para nada.
 */
export function createTableSubjectGuard(
  db: Kysely<Database> = defaultDb,
): CommentSubjectGuard {
  // `actingUserId` é o segundo parâmetro de `CommentSubjectGuard` e está
  // **omitido de propósito**, como em `postSubjectGuard.ts:69-73`: a
  // visibilidade da mesa não depende de quem pergunta (ver o comentário sobre
  // rascunho abaixo). Declarar o parâmetro sem usá-lo sugeriria o contrário —
  // e é exatamente o defeito que a fixture `visibleOnlyToActor` da suíte de
  // conformidade existe para pegar.
  return async function tableSubjectGuard(
    subject: CommentSubjectRef,
  ): Promise<SubjectAuthorizationResult> {
    // `subject_type` alheio nunca é "mesa que não achei": é o app perguntando a
    // coisa errada. Recusar como `not_found` mantém o `404` uniforme lá na
    // frente sem que este guard finja ter consultado o domínio de outro módulo.
    if (subject.subjectType !== MESAS_SUBJECT_TYPE) return refuse('not_found');

    // `tables.id` é UUID. Sem esta guarda, um id malformado chega ao Postgres
    // como texto e a query morre com `invalid input syntax for type uuid` —
    // `500` onde o certo é `404` (mesmo achado da PR #264 no `site`, onde o
    // tipo era `BIGINT`).
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject.subjectId)) {
      return refuse('not_found');
    }

    // ## O JOIN é o ponto inteiro desta função (T7.2, requisito 26c)
    //
    // São **dois** saltos, e pular qualquer um devolve `null` em silêncio:
    //
    //   tables.gm_id → gm_profiles.id → gm_profiles.user_id → users.google_id
    //
    // 1. `tables.gm_id` **não** referencia `users`: aponta para
    //    `gm_profiles(id)` (`migration_01_base_schema.sql:124`). A primeira
    //    versão desta consulta unia direto em `users.id` e casava **zero**
    //    linhas — medido em produção: 27 mesas com `gm_id`, 0 resolvidas pelo
    //    join direto, 27 pelo caminho por `gm_profiles` (achado de review,
    //    PR #268). O tipo não pega: as duas colunas são UUID.
    // 2. Do perfil sai `user_id`, que é o UUID **local** de `mesas.users`. O
    //    `accounts.` identifica a conta por `users.google_id`
    //    (`db/types.ts:14`), que é o `session.user.id` do SSO. Mandar o id
    //    local associaria a mesa a uma conta inexistente no registro central.
    //
    // O sintoma dos dois erros é idêntico e mudo: `ownerUserId: null`, que é um
    // valor legítimo para mesa órfã — então o publicador simplesmente deixa de
    // ser notificado do próprio anúncio, sem erro em lugar nenhum.
    //
    // `LEFT JOIN` e não `JOIN`: mesa órfã (`gm_id` nulo) e mestre externo sem
    // conta são casos legítimos do acervo importado, e `authorize` aceita
    // `ownerUserId: null` de propósito.
    const table = await db
      .selectFrom('tables')
      .leftJoin('gm_profiles', 'gm_profiles.id', 'tables.gm_id')
      .leftJoin('users', 'users.id', 'gm_profiles.user_id')
      .select([
        'tables.id as id',
        'tables.slug as slug',
        'tables.status as status',
        'tables.archived_at as archived_at',
        'tables.origin as origin',
        'tables.created_at as created_at',
        'tables.starts_at as starts_at',
        'users.google_id as owner_google_id',
      ])
      .where('tables.id', '=', subject.subjectId)
      .executeTakeFirst();

    if (!table) return refuse('not_found');

    // Nunca foi pública: rascunho e revisão pendente. `not_visible` em vez de
    // `not_commentable` porque confirmar que o id existe já é o oráculo que o
    // `404` uniforme fecha (§8).
    //
    // Diferente do `downloads`, **não há exceção para o dono**: lá o criador
    // enxerga o próprio material em rascunho. Aqui o painel do mestre é
    // superfície própria, autenticada, e não passa por esta fachada — abrir a
    // conversa pública de uma mesa não publicada não serviria a ninguém e
    // ampliaria a superfície sem pedido.
    if (!canReadTableComments(table)) return refuse('not_visible');

    // Visível, mas fechada a fala nova: encerrada, cancelada, arquivada ou
    // importada expirada. A conversa que já existe continua legível — é o que
    // separa `not_commentable` de `not_visible` no requisito 26a.
    if (!canWriteTableComments(table)) return refuse('not_commentable');

    return authorize({
      exists: true,
      visible: true,
      commentable: true,
      // Nulo é caso legítimo, não erro: mesa órfã (`gm_id` nulo) e mestre
      // nomeado só em `actual_gm_name` existem no acervo importado. Comentar
      // ali não notifica ninguém, e responder a um comentário continua
      // notificando quem escreveu o pai (requisitos 15a, 15b).
      ownerUserId: table.owner_google_id,
      canonicalPath: tableCanonicalPath(table.slug),
    });
  };
}

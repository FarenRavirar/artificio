import {
  authorize,
  refuse,
  type CommentSubjectGuard,
  type CommentSubjectRef,
  type SubjectAuthorizationResult,
} from '@artificio/comments';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { db as defaultDb } from '../db';

/**
 * T5.3 (spec 090) — guard `CommentSubjectAuthorization` do `downloads`.
 *
 * ## Por que ele existe
 *
 * O `accounts.` recebe `(realm, source_app, subject_type, subject_id)` e **não
 * consulta tabela de domínio nenhuma** — ele não sabe o que é um material de
 * RPG. Referência opaca não substitui autorização por objeto
 * (`plan.md` §Referência opaca, OWASP IDOR): quem afirma que o material existe,
 * está visível e aceita comentário é este backend, e a afirmação só é confiável
 * porque viaja por credencial de serviço, nunca por sessão de navegador.
 *
 * O contrato e a suíte de conformidade vivem em `@artificio/comments`; a
 * consulta contra `download_material` é o que pertence a este app.
 */

/** O único `subject_type` que o `downloads` fala (`contrato-http-v1.md` §2). */
export const DOWNLOADS_SUBJECT_TYPE = 'downloads.material';

/**
 * `canonical_path` do material — caminho, **nunca URL inteira** (requisito 5b).
 * A origem é resolvida no `accounts.` por `(realm, source_app)` allowlisted;
 * mandar URL pronta daqui abriria phishing e open redirect.
 *
 * O caminho espelha a rota pública real (`frontend/src/App.tsx`:
 * `/materiais/:materialSlug`) e usa o mesmo `encodeURIComponent` do sitemap
 * (`routes/publicSeo.ts:44`), para que o link de volta caia na mesma página que
 * o SEO anuncia.
 */
export function materialCanonicalPath(slug: string): string {
  return `/materiais/${encodeURIComponent(slug)}`;
}

/**
 * Estado editorial que aceita comentário.
 *
 * `published` é o único, e a distinção entre os outros quatro importa para o
 * motivo da recusa, não para o veredito:
 * - `draft` e `in_review` existem mas ainda não são públicos → invisível;
 * - `rejected` e `withdrawn` já foram públicos ou nunca serão, e o material
 *   permanece na tabela → visível para quem tem link, porém fechado a comentário.
 *
 * O `accounts.` colapsa tudo em `404` uniforme (`contrato-http-v1.md` §8) —
 * quem precisa da distinção é a resposta ao usuário deste app.
 */
const COMMENTABLE_STATE = 'published';
const INVISIBLE_STATES = new Set(['draft', 'in_review']);

/**
 * Cria o guard. O `Kysely` entra por parâmetro para o teste rodar contra um
 * duplo sem subir banco — a suíte de conformidade precisa exercitar cinco
 * cenários de visibilidade, e fabricá-los em PostgreSQL real custaria fixture
 * de integração para uma decisão que é pura consulta.
 */
export function createMaterialSubjectGuard(
  db: Kysely<Database> = defaultDb,
): CommentSubjectGuard {
  return async function materialSubjectGuard(
    subject: CommentSubjectRef,
    actingUserId: string,
  ): Promise<SubjectAuthorizationResult> {
    // `subject_type` alheio nunca é "material que não achei": é o app perguntando
    // a coisa errada. Recusar como `not_found` mantém o `404` uniforme lá na
    // frente sem que este guard finja ter consultado o domínio de outro módulo.
    if (subject.subjectType !== DOWNLOADS_SUBJECT_TYPE) return refuse('not_found');

    // O `JOIN` cobre as DUAS formas de `creator_id`, e isso não é defensividade:
    // material de scraper grava `download_creator.id`, material humano grava o
    // `user_id` do SSO — mesmo OR de `routes/materials.ts:224-225` (spec 084).
    // Medido em beta (2026-08-15): 91/91 materiais usam a primeira forma, então
    // um `JOIN` só por `id` passaria em todo teste contra o acervo atual e
    // devolveria `ownerUserId: null` no primeiro material humano — o dono
    // deixaria de ser notificado do próprio comentário, sem erro nenhum.
    //
    // O `OR` pode casar DUAS linhas distintas, e isso não é hipótese: `id` é PK
    // e `user_id` tem UNIQUE **parcial** (`migration_003` + `migration_013`),
    // então cada coluna é única isoladamente, mas nada impede o criador A ter
    // `id = X` enquanto o criador B tem `user_id = X`. Sem ordenação, o
    // `executeTakeFirst` escolheria pelo plano do Postgres — o dono do material
    // mudaria entre execuções da mesma query. O `ORDER BY` fixa a precedência na
    // forma canônica (`id`), a mesma que 91/91 materiais de beta usam.
    const material = await db
      .selectFrom('download_material')
      .leftJoin('download_creator', (join) => join.on((eb) => eb.or([
        eb('download_creator.id', '=', eb.ref('download_material.creator_id')),
        eb('download_creator.user_id', '=', eb.ref('download_material.creator_id')),
      ])))
      .select((eb) => [
        'download_material.id as id',
        'download_material.slug as slug',
        'download_material.editorial_state as editorial_state',
        'download_creator.user_id as owner_user_id',
        eb
          .case()
          .when('download_creator.id', '=', eb.ref('download_material.creator_id'))
          .then(0)
          .else(1)
          .end()
          .as('creator_match_rank'),
      ])
      .where('download_material.id', '=', subject.subjectId)
      .orderBy('creator_match_rank', 'asc')
      .executeTakeFirst();

    if (!material) return refuse('not_found');

    if (INVISIBLE_STATES.has(material.editorial_state)) {
      // Visibilidade depende de quem pergunta: o próprio criador enxerga o
      // material que ainda não publicou. Sem esta consulta ao ator, o guard
      // responderia igual para todo mundo — o defeito que
      // `visibleOnlyToActor` da suíte de conformidade existe para pegar.
      // Ele continua **não comentável**: rascunho não abre conversa, só deixa
      // de ser mentira dizer que não existe para o próprio dono.
      const ownsIt = material.owner_user_id !== null && material.owner_user_id === actingUserId;
      return refuse(ownsIt ? 'not_commentable' : 'not_visible');
    }

    if (material.editorial_state !== COMMENTABLE_STATE) return refuse('not_commentable');

    return authorize({
      exists: true,
      visible: true,
      commentable: true,
      // Nulo é caso legítimo, não erro: criador sem conta vinculada
      // (`download_creator.user_id` é nullable) existe no acervo importado.
      // Comentar ali não notifica ninguém, e responder a um comentário continua
      // notificando quem escreveu o pai (requisitos 15a, 15b).
      ownerUserId: material.owner_user_id,
      canonicalPath: materialCanonicalPath(material.slug),
    });
  };
}

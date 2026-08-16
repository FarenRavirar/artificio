import {
  authorize,
  refuse,
  type CommentSubjectGuard,
  type CommentSubjectRef,
  type SubjectAuthorizationResult,
} from "@artificio/comments";
import { getDb, type Db } from "../../db/connection.js";

/**
 * T6.4 (spec 090) — guard `CommentSubjectAuthorization` do `site`.
 *
 * ## Por que ele existe
 *
 * O `accounts.` recebe `(realm, source_app, subject_type, subject_id)` e **não
 * consulta tabela de domínio nenhuma** — ele não sabe o que é um post de blog.
 * Referência opaca não substitui autorização por objeto (`plan.md` §Referência
 * opaca, OWASP IDOR): quem afirma que o post existe, está publicado e aceita
 * comentário é este backend, e a afirmação só é confiável porque viaja por
 * credencial de serviço, nunca por sessão de navegador.
 *
 * Mesmo desenho de `apps/downloads/backend/src/community/materialSubjectGuard.ts`.
 * O que muda é a consulta e, principalmente, o que o domínio **não** tem —
 * documentado em `ownerUserId` abaixo.
 */

/** O único `subject_type` que o `site` fala (`contrato-http-v1.md:84`). */
export const SITE_SUBJECT_TYPE = "site.post";

/**
 * `canonical_path` do post — caminho, **nunca URL inteira** (requisito 5b).
 * A origem é resolvida no `accounts.` por `(realm, source_app)` allowlisted;
 * mandar URL pronta daqui abriria phishing e open redirect.
 *
 * A barra final não é cosmética: `astro.config.mjs` fixa
 * `trailingSlash: "always"`, então `/blog/x` e `/blog/x/` são páginas distintas
 * para o Astro, e só a segunda existe. Um link de volta sem a barra cairia no
 * 404 do próprio site.
 */
export function postCanonicalPath(slug: string): string {
  return `/blog/${encodeURIComponent(slug)}/`;
}

/**
 * Estado editorial que aceita comentário.
 *
 * `posts.status` herdou o vocabulário do WordPress na importação
 * (`db/migrations/001_init.sql:35`, `DEFAULT 'publish'`), e é por isso que o
 * literal é `publish` e não `published` como no `downloads` — copiar o nome do
 * outro app faria o guard recusar todos os 125 posts sem erro de compilação.
 *
 * Os demais estados do WordPress (`draft`, `pending`, `private`, `future`,
 * `trash`) colapsam em invisível: nenhum deles é público, e o `site` não tem
 * conceito de "dono do post" para abrir exceção a autor (ver `ownerUserId`).
 */
const COMMENTABLE_STATUS = "publish";

/**
 * Cria o guard. O `Db` entra por parâmetro para o teste rodar contra um duplo
 * sem subir banco — a decisão é pura consulta, e fabricar cinco cenários de
 * visibilidade em PostgreSQL real custaria fixture de integração para nada.
 */
export function createPostSubjectGuard(
  loadDb: () => Promise<Db> = getDb,
): CommentSubjectGuard {
  // `actingUserId` é o segundo parâmetro de `CommentSubjectGuard` e está
  // **omitido de propósito**: diferente do `downloads` — onde o criador enxerga
  // o próprio material em rascunho —, o `site` não tem dono de post
  // (`posts` não tem coluna de autor), então a visibilidade aqui não depende de
  // quem pergunta. Declarar o parâmetro sem usá-lo sugeriria o contrário.
  return async function postSubjectGuard(
    subject: CommentSubjectRef,
  ): Promise<SubjectAuthorizationResult> {
    // `subject_type` alheio nunca é "post que não achei": é o app perguntando a
    // coisa errada. Recusar como `not_found` mantém o `404` uniforme lá na
    // frente sem que este guard finja ter consultado o domínio de outro módulo.
    if (subject.subjectType !== SITE_SUBJECT_TYPE) return refuse("not_found");

    // `subject_id` é `String(post.id)` (T6.4) e `posts.id` é `BIGINT`. Sem esta
    // guarda, um id não-numérico chegaria ao Postgres como texto e a query
    // morreria com `invalid input syntax for type bigint` — erro de 500 onde o
    // certo é `404`. O intervalo seguro do JS não basta: `BIGINT` vai além de
    // `Number.MAX_SAFE_INTEGER`, então a validação é textual e o valor viaja
    // como string até o driver.
    if (!/^\d{1,19}$/.test(subject.subjectId)) return refuse("not_found");

    const db = await loadDb();
    const result = await db.query<{ slug: string; status: string }>(
      "SELECT slug, status FROM posts WHERE id = $1",
      [subject.subjectId],
    );
    const post = result.rows[0];

    if (!post) return refuse("not_found");

    // Diferente do `downloads`, aqui não há distinção entre "invisível" e
    // "visível mas fechado": o `site` não tem dono de post a quem mostrar
    // rascunho. Todo estado que não seja `publish` é `not_visible`, e o
    // `accounts.` colapsa tudo em `404` uniforme de qualquer forma (§8).
    if (post.status !== COMMENTABLE_STATUS) return refuse("not_visible");

    return authorize({
      exists: true,
      visible: true,
      commentable: true,
      // **Sempre nulo, e isto é o domínio falando, não omissão.** `posts`
      // (`001_init.sql:28-45`) não tem coluna de autor: o blog foi importado do
      // WordPress sem vínculo com conta do SSO, e o campo `author` do WP não
      // sobreviveu à importação. Inventar um dono aqui criaria destinatário de
      // notificação que nunca existiu (mesma razão do `owner_user_id: null` do
      // importador de comentários, `importLegacyComments.ts:203`).
      //
      // Consequência aceita: comentar num post não notifica ninguém. Responder
      // a um comentário continua notificando quem escreveu o pai — que é o
      // caminho que os requisitos 15a/15b garantem e não depende do dono.
      ownerUserId: null,
      canonicalPath: postCanonicalPath(post.slug),
    });
  };
}

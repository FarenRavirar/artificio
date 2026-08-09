import type { Kysely, Transaction } from "kysely";
import type { Database } from "./db.js";

/**
 * T2.12 + T2.13 + T2.14 — voto, revisão de ranking e contagens públicas
 * (`contrato-http-v1.md` §7; decisões 5, 8, 9, 10, 11, 12, 13).
 *
 * ## As três tasks são uma transação só
 *
 * T2.12 muda o voto, T2.13 incrementa `ranking_revision` sob lock, T2.14 devolve
 * as contagens. Separá-las em módulos daria três funções que só funcionam
 * chamadas juntas, na ordem certa — e a primeira vez que alguém chamasse duas
 * delas o score ficaria fora da revisão que o cursor congelou. §7 fixa o
 * conjunto: "atualiza voto, contagens, `comment_score_version`, incrementa
 * `ranking_revision` do assunto sob lock curto, tudo na mesma transação".
 *
 * ## Estado absoluto, não delta
 *
 * O corpo é `{ value: -1 | 0 | 1 }` e descreve **onde o voto deve ficar**, não o
 * que mudar. É o que torna o retry idêntico inofensivo por construção e dispensa
 * `Idempotency-Key`, `ETag` e `If-Match` (§6, decisão 12): reenviar o mesmo
 * estado é no-op, e dois dispositivos concorrentes convergem para a última
 * transação persistida.
 *
 * `0` **remove a linha**, não grava zero: `community_comment_vote.value` tem
 * `CHECK (value IN (-1, 1))`, então zero nem chega ao banco. Ausência de linha é
 * a representação de "sem voto", e é o que `my_vote` devolve como `null`.
 *
 * ## Por que o lock é no assunto, e por que é curto
 *
 * `ranking_revision` vive em `community_comment_subject` e é o número que o
 * cursor congela (T2.3). Dois votos concorrentes no mesmo assunto que lessem a
 * revisão sem lock gravariam faixas de score com o mesmo `valid_from_revision`, e
 * o `UNIQUE (realm, source_app, comment_id, valid_from_revision)` derrubaria uma
 * delas — ou pior, as duas passariam em comentários diferentes e a foto da árvore
 * ficaria inconsistente.
 *
 * O `UPDATE ... RETURNING` faz as duas coisas numa instrução: trava a linha e
 * devolve o valor novo. Não há `SELECT ... FOR UPDATE` antes — seria uma segunda
 * ida ao banco segurando o lock por mais tempo, e o lock precisa ser curto o
 * bastante para não serializar o assunto inteiro sob carga.
 *
 * ## Score é histórico, não campo mutável
 *
 * Cada mudança **fecha** a faixa corrente (`valid_to_revision`) e **abre** uma
 * nova. É o que permite a leitura de uma revisão congelada encontrar o score
 * daquele momento em vez do atual (`spec.md` 8d), e o que o índice parcial
 * `uq_community_comment_score_current` protege: uma única faixa aberta por
 * comentário.
 *
 * `score` e `best_score` são **colunas geradas** — `upvotes - downvotes` e
 * `comment_wilson_reddit_80_v1(...)`. Nada aqui as calcula: decisão 21 diz que
 * PostgreSQL é a fonte canônica e que TypeScript não mantém segunda
 * implementação produtiva da fórmula.
 */

/** Estado absoluto do voto, como §7 o define. */
export type VoteValue = -1 | 0 | 1;

export interface VoteInput {
  realm: string;
  sourceApp: string;
  commentId: string;
  actingUserId: string;
  value: VoteValue;
}

export type VoteRejectionCode =
  /** Alvo inexistente, ou de outro `realm`/`source_app` da credencial. */
  | "comment_not_found"
  /** Autor não vota no próprio comentário (decisão 5). */
  | "self_vote"
  /** Legado não aceita voto (decisão 6). */
  | "legacy_immutable"
  /** Tombstone e `pending_review_hidden` não são votáveis (§7). */
  | "not_votable";

/** Payload de `200` (§7): `{ my_vote, upvotes, downvotes, score }`. */
export interface VoteTally {
  my_vote: VoteValue;
  upvotes: number;
  downvotes: number;
  score: number;
}

export type VoteResult =
  | { ok: true; tally: VoteTally }
  | { ok: false; code: VoteRejectionCode; status: number };

class VoteRejection extends Error {
  constructor(
    readonly code: VoteRejectionCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "VoteRejection";
  }
}

interface LockedComment {
  id: string;
  subject_type: string;
  subject_id: string;
  community_actor_id: string | null;
  visibility_state: string;
  legacy_source: string | null;
}

/**
 * Carrega o comentário e aplica as três recusas do contrato.
 *
 * `FOR SHARE` e não `FOR UPDATE`: o voto **não** escreve nesta linha — escreve em
 * `community_comment_vote` e em `community_comment_score_version`. O que a trava
 * compartilhada garante é que o comentário não vire tombstone entre a checagem e
 * a gravação do voto, sem serializar votos concorrentes no mesmo comentário
 * (que é o caso comum e precisa escalar).
 */
async function lockVotableComment(
  trx: Transaction<Database>,
  input: VoteInput,
  actorId: string,
): Promise<LockedComment> {
  const comment = await trx
    .selectFrom("community_comment")
    .select([
      "id",
      "subject_type",
      "subject_id",
      "community_actor_id",
      "visibility_state",
      "legacy_source",
    ])
    .where("id", "=", input.commentId)
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .forShare()
    .executeTakeFirst();

  if (!comment) {
    throw new VoteRejection("comment_not_found", 404);
  }

  // Legado antes de autoria: comentário importado tem ator nulo, então a
  // checagem de auto-voto não o alcançaria e ele passaria. Decisão 6: score
  // permanente `0`, sem voto.
  if (comment.legacy_source !== null) {
    throw new VoteRejection("legacy_immutable", 403);
  }

  // Auto-voto recusado (decisão 5) — divergência deliberada do Reddit, que dá
  // upvote automático ao autor. Aqui o score representa reação de **outras**
  // contas; incluir a do autor mediria participação, não recepção.
  if (comment.community_actor_id === actorId) {
    throw new VoteRejection("self_vote", 403);
  }

  // Tombstone e conteúdo sob revisão não são votáveis: o corpo não está visível,
  // então votar seria opinar sobre placeholder — e o voto ainda mexeria no score
  // que a leitura já esconde.
  if (comment.visibility_state !== "visible") {
    throw new VoteRejection("not_votable", 403);
  }

  return comment;
}

/**
 * Ator do usuário. Diferente da escrita de comentário, **não cria** o ator.
 *
 * Quem nunca participou da comunidade não tem ator, e criar um aqui gravaria
 * identidade comunitária por causa de um voto que pode ser recusado logo em
 * seguida (auto-voto, legado, tombstone). O ator nasce no primeiro comentário
 * (`communityCommentWrite.ts`); para votar, ele é criado sob demanda **depois**
 * das recusas.
 */
async function resolveActorId(
  trx: Transaction<Database>,
  userId: string,
): Promise<string | null> {
  const row = await trx
    .selectFrom("community_actor_account_link")
    .select("actor_id")
    .where("user_id", "=", userId)
    .executeTakeFirst();

  return row?.actor_id ?? null;
}

/** Cria ator e vínculo para quem vota antes de ter comentado. */
async function createActor(
  trx: Transaction<Database>,
  userId: string,
): Promise<string> {
  // `defaultValues()`, nunca `values({})`: o objeto vazio compila para
  // `INSERT INTO community_actor () VALUES ()`, que o PostgreSQL recusa. Chegou
  // a produção uma vez (2026-08-08) e o teste de SQL compilado existe por isso.
  const actor = await trx
    .insertInto("community_actor")
    .defaultValues()
    .returning("id")
    .executeTakeFirstOrThrow();

  await trx
    .insertInto("community_actor_account_link")
    .values({ actor_id: actor.id, user_id: userId })
    .execute();

  return actor.id;
}

/** Voto atual do ator, ou `null` se ele ainda não votou. */
async function currentVote(
  trx: Transaction<Database>,
  input: VoteInput,
  actorId: string,
): Promise<-1 | 1 | null> {
  const row = await trx
    .selectFrom("community_comment_vote")
    .select("value")
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("comment_id", "=", input.commentId)
    .where("community_actor_id", "=", actorId)
    .executeTakeFirst();

  return row?.value ?? null;
}

/**
 * Contagens correntes do comentário, da faixa aberta.
 *
 * Faixa ausente significa comentário que nunca recebeu voto — não é erro, e
 * devolver zeros é o que mantém a resposta uniforme. Criar a primeira faixa só
 * quando o primeiro voto chega evita uma linha por comentário sem voto nenhum.
 */
async function currentTally(
  trx: Transaction<Database>,
  input: VoteInput,
): Promise<{ upvotes: number; downvotes: number }> {
  const row = await trx
    .selectFrom("community_comment_score_version")
    .select(["upvotes", "downvotes"])
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("comment_id", "=", input.commentId)
    .where("valid_to_revision", "is", null)
    .executeTakeFirst();

  return { upvotes: row?.upvotes ?? 0, downvotes: row?.downvotes ?? 0 };
}

/**
 * Delta de contagem entre dois estados de voto.
 *
 * Puro e separado da transação de propósito: é a única aritmética do fluxo, e é
 * onde um erro produziria contagem negativa — que o `CHECK (upvotes >= 0)` do
 * banco recusaria, abortando a transação inteira em runtime.
 */
export function tallyDelta(
  from: -1 | 1 | null,
  to: -1 | 1 | null,
): { upvotes: number; downvotes: number } {
  const delta = { upvotes: 0, downvotes: 0 };

  if (from === 1) delta.upvotes -= 1;
  if (from === -1) delta.downvotes -= 1;
  if (to === 1) delta.upvotes += 1;
  if (to === -1) delta.downvotes += 1;

  return delta;
}

/**
 * `PUT /internal/v1/comments/:id/vote` (§7).
 *
 * A ordem interna é: recusas → no-op → lock da revisão → voto → faixa de score →
 * auditoria. O no-op sai **antes** do lock porque não há o que serializar quando
 * nada muda — e tomar o lock do assunto para uma requisição que não escreve
 * serializaria votos legítimos de outros comentários do mesmo assunto.
 */
export async function castVote(
  db: Kysely<Database>,
  input: VoteInput,
): Promise<VoteResult> {
  try {
    return await db.transaction().execute(async (trx) => {
      // Ator resolvido antes do comentário porque a recusa de auto-voto compara
      // os dois. Ainda **não** cria: criar aqui gravaria identidade comunitária
      // para um voto que pode ser recusado nas linhas seguintes.
      const existingActorId = await resolveActorId(trx, input.actingUserId);

      const comment = await lockVotableComment(
        trx,
        input,
        // Ator inexistente nunca é o autor do comentário — o autor sempre tem
        // ator. String vazia não casa com UUID nenhum e mantém a checagem
        // uniforme.
        existingActorId ?? "",
      );

      const actorId = existingActorId ?? (await createActor(trx, input.actingUserId));

      const from = existingActorId ? await currentVote(trx, input, actorId) : null;
      const to: -1 | 1 | null = input.value === 0 ? null : input.value;

      const tally = await currentTally(trx, input);

      // No-op (§7): mesmo valor devolve `200` **sem nova revisão e sem novo
      // registro de histórico**. Incrementar a revisão aqui invalidaria o cursor
      // de quem está navegando, por uma requisição que não mudou nada.
      if (from === to) {
        return {
          ok: true as const,
          tally: {
            my_vote: (to ?? 0) as VoteValue,
            upvotes: tally.upvotes,
            downvotes: tally.downvotes,
            score: tally.upvotes - tally.downvotes,
          },
        };
      }

      // Lock curto e incremento na mesma instrução (T2.13). `UPDATE ...
      // RETURNING` trava a linha do assunto e devolve o valor novo sem um
      // `SELECT ... FOR UPDATE` antes — que seria uma segunda ida ao banco
      // segurando o lock por mais tempo.
      const subject = await trx
        .updateTable("community_comment_subject")
        .set((eb) => ({
          ranking_revision: eb("ranking_revision", "+", 1),
          updated_at: new Date(),
        }))
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .where("subject_type", "=", comment.subject_type)
        .where("subject_id", "=", comment.subject_id)
        .returning("ranking_revision")
        .executeTakeFirstOrThrow();

      const revision = subject.ranking_revision;

      if (to === null) {
        await trx
          .deleteFrom("community_comment_vote")
          .where("realm", "=", input.realm)
          .where("source_app", "=", input.sourceApp)
          .where("comment_id", "=", input.commentId)
          .where("community_actor_id", "=", actorId)
          .execute();
      } else {
        // Insert-or-update numa instrução: `SELECT` antes seria o
        // check-before-transaction que §6 manda não replicar, e a chave primária
        // composta já resolve o conflito.
        await trx
          .insertInto("community_comment_vote")
          .values({
            realm: input.realm,
            source_app: input.sourceApp,
            community_actor_id: actorId,
            comment_id: input.commentId,
            value: to,
          })
          .onConflict((oc) =>
            oc
              .columns(["realm", "source_app", "community_actor_id", "comment_id"])
              .doUpdateSet({ value: to, updated_at: new Date() }),
          )
          .execute();
      }

      const delta = tallyDelta(from, to);
      const upvotes = tally.upvotes + delta.upvotes;
      const downvotes = tally.downvotes + delta.downvotes;

      // Fecha a faixa corrente na revisão anterior. `valid_to_revision` é
      // exclusivo na leitura (`> revision`), então fechar em `revision` faz a
      // faixa antiga valer até a revisão imediatamente anterior — que é o que
      // mantém a foto congelada consistente.
      await trx
        .updateTable("community_comment_score_version")
        .set({ valid_to_revision: revision })
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .where("comment_id", "=", input.commentId)
        .where("valid_to_revision", "is", null)
        .execute();

      // `score` e `best_score` **não** entram no `INSERT`: são colunas geradas, e
      // gravá-las levanta erro no PostgreSQL. A fórmula de Wilson vive na função
      // `comment_wilson_reddit_80_v1` (decisão 21) — TypeScript nunca a
      // reimplementa.
      await trx
        .insertInto("community_comment_score_version")
        .values({
          realm: input.realm,
          source_app: input.sourceApp,
          comment_id: input.commentId,
          valid_from_revision: revision,
          valid_to_revision: null,
          upvotes,
          downvotes,
        })
        .execute();

      // Auditoria na mesma transação. `community_comment_vote_audit_change_check`
      // recusa linha em que `old_value` e `new_value` são iguais — o no-op já
      // saiu acima, então toda linha daqui é mudança real.
      await trx
        .insertInto("community_comment_vote_audit")
        .values({
          realm: input.realm,
          source_app: input.sourceApp,
          community_actor_id: actorId,
          comment_id: input.commentId,
          old_value: from,
          new_value: to,
          reason: "user_vote",
          invalidated_by_actor_id: null,
        })
        .execute();

      // Nenhum `notification_event` nem `notification_receipt`: voto **não**
      // notifica (decisão 13, T2.16). Nem o voto individual, nem marco agregado
      // ("seu comentário chegou a 10 pontos") — o autor acompanha a contagem na
      // própria thread. A ausência é o requisito, e o teste afirma sobre ela.

      return {
        ok: true as const,
        tally: {
          my_vote: (to ?? 0) as VoteValue,
          upvotes,
          downvotes,
          score: upvotes - downvotes,
        },
      };
    });
  } catch (error) {
    if (error instanceof VoteRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}

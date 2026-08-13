import type { Kysely } from "kysely";
import type { Database } from "./db.js";

export const COMMUNITY_NEW_ACCOUNT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT = 3;
export const COMMUNITY_NEW_ACCOUNT_WRITE_LIMIT = 10;

/** Canary inicial: `accounts.` é prod-only, mas a credencial fixa o realm beta. */
export function isCommunityNewAccountPolicyEnabled(realm: string): boolean {
  return realm === "beta";
}

export interface CommunityAccountStatus {
  isNew: boolean;
  accountIsYoung: boolean;
  commentCountIsLow: boolean;
  commentCount: number;
}

/**
 * T4.20 — conta nova enquanto qualquer um dos sinais ainda estiver presente:
 * idade menor que sete dias **ou** menos de três comentários no total.
 *
 * A fronteira é intencional: no instante em que completa sete dias a idade
 * deixa de qualificar, e o terceiro comentário elimina o segundo sinal.
 */
export function classifyCommunityAccount(
  createdAt: Date,
  commentCount: number,
  now = new Date(),
): CommunityAccountStatus {
  const accountIsYoung = now.getTime() - createdAt.getTime() < COMMUNITY_NEW_ACCOUNT_MAX_AGE_MS;
  const commentCountIsLow = commentCount < COMMUNITY_NEW_ACCOUNT_MIN_COMMENT_COUNT;

  return {
    isNew: accountIsYoung || commentCountIsLow,
    accountIsYoung,
    commentCountIsLow,
    commentCount,
  };
}

/** Deriva o status no momento da escrita; não persiste classificação paralela. */
export async function readCommunityAccountStatus(
  db: Kysely<Database>,
  userId: string,
  now = new Date(),
): Promise<CommunityAccountStatus | null> {
  const row = await db
    .selectFrom("users as u")
    .leftJoin("community_actor_account_link as l", "l.user_id", "u.id")
    .select((eb) => [
      "u.created_at",
      eb
        .selectFrom("community_comment as c")
        .select((inner) => inner.fn.countAll<string>().as("total"))
        .whereRef("c.community_actor_id", "=", "l.actor_id")
        .as("comment_count"),
    ])
    .where("u.id", "=", userId)
    .executeTakeFirst();

  if (!row) return null;

  return classifyCommunityAccount(row.created_at, Number(row.comment_count ?? 0), now);
}

import type { Transaction } from 'kysely';
import type { Database } from '../db/types.js';
import { db } from '../db/index.js';

export interface ResolveActorNameOptions {
  trx?: Transaction<Database>;
  fallback?: string;
  logTag?: string;
}

export async function resolveActorName(
  userId: string,
  options: ResolveActorNameOptions = {},
): Promise<string> {
  const executor = options.trx ?? db;
  const fallback = options.fallback ?? 'Usuário';
  const tag = options.logTag ?? 'actorNameResolver';

  try {
    const profile = await executor
      .selectFrom('profiles')
      .select('display_name')
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (profile?.display_name && profile.display_name.trim().length > 0) {
      return profile.display_name.trim();
    }

    const user = await executor
      .selectFrom('users')
      .select(['username', 'email'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (user?.username && user.username.trim().length > 0) {
      return user.username.trim();
    }

    if (user?.email) {
      return user.email.split('@')[0];
    }
  } catch (error) {
    console.error(`[${tag}][resolveActorName]`, error);
  }

  return fallback;
}

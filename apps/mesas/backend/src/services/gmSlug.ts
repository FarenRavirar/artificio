import { sql, type Kysely, type Transaction } from 'kysely';
import { db } from '../db/index.js';
import type { Database } from '../db/types.js';
import { auditIdentityChange, auditIdentityRejected } from './identityAudit.js';

/**
 * Spec 106 R3. Slug de mestre: formato, unicidade e redirecionamento de slug antigo.
 *
 * `gm_slug_redirects` guarda `gm_id`, nao o slug novo: o destino e sempre o slug
 * atual, entao nao existem cadeias (A→B→C responde A→C).
 */
export const GM_SLUG_PATTERN = /^[a-z0-9-]+$/;
export const GM_SLUG_MAX = 40;

type Executor = Kysely<Database> | Transaction<Database>;

export class GmSlugError extends Error {
  constructor(
    readonly code: 'format' | 'taken' | 'not_found' | 'same',
    message: string,
  ) {
    super(message);
    this.name = 'GmSlugError';
  }
}

/**
 * Slug ocupado = esta em `gm_profiles` OU e slug antigo de alguem. Sem o segundo
 * ramo, um mestre novo "herdaria" o 301 de outro: o link velho levaria a pessoa
 * errada. `exceptGmId` deixa o dono reaver o proprio slug antigo.
 */
export async function isGmSlugTaken(slug: string, executor: Executor = db, exceptGmId?: string): Promise<boolean> {
  const perfil = await executor.selectFrom('gm_profiles').select('id').where('slug', '=', slug).executeTakeFirst();
  if (perfil && perfil.id !== exceptGmId) return true;
  const antigo = await executor
    .selectFrom('gm_slug_redirects')
    .select('gm_id')
    .where('old_slug', '=', slug)
    .executeTakeFirst();
  return !!antigo && antigo.gm_id !== exceptGmId;
}

/** Varias candidatas de uma vez (usado pelo sufixo `-N` de perfil novo). */
export async function takenGmSlugs(candidates: string[], executor: Executor = db): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const [perfis, antigos] = await Promise.all([
    executor.selectFrom('gm_profiles').select('slug').where('slug', 'in', candidates).execute(),
    executor.selectFrom('gm_slug_redirects').select('old_slug').where('old_slug', 'in', candidates).execute(),
  ]);
  return new Set([...perfis.map((r) => r.slug), ...antigos.map((r) => r.old_slug)]);
}

/** Slug atual do mestre dono de `oldSlug`, ou `null` se `oldSlug` nao e um redirect. */
export async function resolveGmSlugRedirect(oldSlug: string, executor: Executor = db): Promise<string | null> {
  const row = await executor
    .selectFrom('gm_slug_redirects as r')
    .innerJoin('gm_profiles as gm', 'gm.id', 'r.gm_id')
    .select('gm.slug')
    .where('r.old_slug', '=', oldSlug)
    .executeTakeFirst();
  return row?.slug ?? null;
}

interface RenameInput {
  gmId: string;
  newSlug: string;
  /** Quem executa: usuario da sessao ou, em script, o admin que autorizou. */
  actorId: string;
  door: string;
}

/**
 * Troca o slug em transacao: valida, grava o redirect do slug antigo e atualiza
 * `gm_profiles.slug`. Sem endpoint publico; o uso e o script de correcao do dado
 * (spec 106 T6.1). Recusa tambem vira linha de auditoria.
 */
export async function renameGmSlug(input: RenameInput): Promise<{ from: string; to: string }> {
  const newSlug = input.newSlug.trim();
  // Preenchido apos a leitura do perfil: a recusa `taken` aponta o perfil afetado.
  let alvo = null as { id: string; user_id: string } | null;
  try {
    if (newSlug.length < 2 || newSlug.length > GM_SLUG_MAX || !GM_SLUG_PATTERN.test(newSlug)) {
      throw new GmSlugError('format', 'Slug deve ter 2 a 40 caracteres: letras minúsculas, números e hífen.');
    }
    return await db.transaction().execute(async (trx) => {
      // Trava a linha: duas trocas simultaneas do mesmo perfil gravariam redirects trocados.
      const atual = await trx
        .selectFrom('gm_profiles')
        .select(['id', 'slug', 'user_id'])
        .where('id', '=', input.gmId)
        .forUpdate()
        .executeTakeFirst();
      if (!atual) throw new GmSlugError('not_found', 'Perfil de mestre não encontrado.');
      alvo = { id: atual.id, user_id: atual.user_id };
      if (atual.slug === newSlug) throw new GmSlugError('same', 'O slug já é esse.');
      if (await isGmSlugTaken(newSlug, trx, input.gmId)) {
        throw new GmSlugError('taken', 'Slug já está em uso.');
      }

      // Voltar a um slug antigo do proprio perfil: o redirect dele deixa de existir.
      await trx.deleteFrom('gm_slug_redirects').where('old_slug', '=', newSlug).execute();
      await trx
        .insertInto('gm_slug_redirects')
        .values({ old_slug: atual.slug, gm_id: atual.id })
        .onConflict((oc) => oc.column('old_slug').doUpdateSet({ gm_id: atual.id }))
        .execute();
      await trx
        .updateTable('gm_profiles')
        .set({ slug: newSlug, updated_at: sql`now()` })
        .where('id', '=', atual.id)
        .execute();

      await auditIdentityChange(
        {
          actorId: input.actorId,
          targetUserId: atual.user_id,
          field: 'slug',
          from: atual.slug,
          to: newSlug,
          door: input.door,
          entityId: atual.id,
        },
        trx,
      );
      return { from: atual.slug, to: newSlug };
    });
  } catch (error) {
    if (error instanceof GmSlugError && error.code !== 'same') {
      await auditIdentityRejected({
        actorId: input.actorId,
        field: 'slug',
        attempted: newSlug,
        reason: error.code,
        door: input.door,
        // format/not_found: perfil nao confirmado, sem usuario-alvo; taken: o perfil lido.
        entityId: alvo?.id ?? input.gmId,
        targetUserId: alvo?.user_id ?? null,
      });
    }
    throw error;
  }
}

import type { Transaction } from 'kysely';
import type { Database } from '../db/types.js';
import { logActivity, type ActivityAction, type ActivityEntityType } from './activityLogger.js';

/**
 * Spec 106 R8: toda mudanca (ou recusa) de nome e slug grava `activity_log`.
 * Antes, o nome do Victor mudou sem rastro: 25 linhas dele no log, zero de nome.
 *
 * Os quatro campos mudam em portas diferentes (`me.ts`, `profile.ts`, `gmPanel.ts`,
 * `profileService.ts`, `renameGmSlug`); a tabela abaixo e o unico lugar que sabe
 * qual `action` e qual entidade cada campo usa. `logActivity` engole erro por
 * desenho: auditoria nunca derruba a acao de merito.
 */
export type IdentityField = 'display_name' | 'nickname' | 'username' | 'slug';

const FIELDS: Record<
  IdentityField,
  { changed: ActivityAction; rejected: ActivityAction; entity: ActivityEntityType; label: string }
> = {
  display_name: {
    changed: 'profile.display_name_changed',
    rejected: 'profile.display_name_rejected',
    entity: 'user',
    label: 'nome de exibição',
  },
  username: {
    changed: 'user.username_changed',
    rejected: 'user.username_rejected',
    entity: 'user',
    label: 'username',
  },
  nickname: {
    changed: 'gm.nickname_changed',
    rejected: 'gm.nickname_rejected',
    entity: 'gm_profile',
    label: 'nome público do mestre',
  },
  slug: {
    changed: 'gm.slug_changed',
    rejected: 'gm.slug_rejected',
    entity: 'gm_profile',
    label: 'slug do mestre',
  },
};

interface ChangeInput {
  actorId: string;
  /** Dono da conta afetada; difere de `actorId` quando um admin troca o dado de outro. */
  targetUserId?: string;
  field: IdentityField;
  from: string | null;
  to: string | null;
  /** Rota ou script que gravou (`PUT /me/preferences`, `renameGmSlug`...). */
  door: string;
  /** `gm_profiles.id` para os campos de mestre; `users.id` nos demais. */
  entityId?: string;
}

/** No-op quando o valor nao mudou: o PATCH reenvia o campo inteiro a cada salvamento. */
export async function auditIdentityChange(input: ChangeInput, trx?: Transaction<Database>): Promise<void> {
  if (input.from === input.to) return;
  const meta = FIELDS[input.field];
  const targetUserId = input.targetUserId ?? input.actorId;
  await logActivity(
    {
      actorId: input.actorId,
      action: meta.changed,
      entityType: meta.entity,
      entityId: input.entityId ?? targetUserId,
      targetUserId,
      summary: `${meta.label}: "${input.from ?? ''}" → "${input.to ?? ''}"`,
      metadata: { from: input.from, to: input.to, door: input.door },
    },
    trx,
  );
}

interface RejectedInput {
  actorId: string;
  field: IdentityField;
  attempted: unknown;
  reason: string;
  door: string;
  /** Perfil/usuario afetado; omitido = o proprio ator, `null` = sem alvo identificado. */
  entityId?: string | null;
  targetUserId?: string | null;
}

/** `attempted` e texto do usuario: guardado como veio (truncado), nunca interpretado. */
export async function auditIdentityRejected(input: RejectedInput): Promise<void> {
  const meta = FIELDS[input.field];
  const attempted = typeof input.attempted === 'string' ? input.attempted.slice(0, 120) : String(input.attempted);
  await logActivity({
    actorId: input.actorId,
    action: meta.rejected,
    entityType: meta.entity,
    entityId: input.entityId === undefined ? input.actorId : input.entityId,
    targetUserId: input.targetUserId === undefined ? input.actorId : input.targetUserId,
    summary: `${meta.label} recusado: ${input.reason}`,
    metadata: { attempted, reason: input.reason, door: input.door },
  });
}

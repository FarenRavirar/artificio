import { db } from '../db';
import type { StorageProviderName } from './types';

// Contador mensal LOCAL de uso por provider (spec 071). Regra petrea do
// mantenedor: NUNCA arriscar cobranca no free tier — cota e checada ANTES de
// cada operacao real contra o limite com margem de 10%, e a contagem nunca
// bate no provider (ListObjectsV2 etc. tambem consumiriam cota Classe B).

export type OpsClass = 'a' | 'b'; // A = write/list/delete; B = read

export interface ProviderQuota {
  maxBytes: number | null;
  maxClassAOps: number | null;
  maxClassBOps: number | null;
}

/** Erro de cota efetivamente estourada (distinto de falha de infra ao checar). */
export class QuotaCheckError extends Error {
  constructor(readonly provider: StorageProviderName, message: string) {
    super(message);
    this.name = 'QuotaCheckError';
  }
}

function currentYearMonth(): string {
  // process.env.TZ nao influencia toISOString (sempre UTC) — mes de
  // faturamento do Cloudflare tambem e UTC, mantem consistencia.
  return new Date().toISOString().slice(0, 7);
}

async function getOrCreateRow(provider: StorageProviderName, yearMonth: string) {
  const existing = await db
    .selectFrom('download_storage_usage')
    .selectAll()
    .where('provider', '=', provider)
    .where('year_month', '=', yearMonth)
    .executeTakeFirst();

  if (existing) return existing;

  const inserted = await db
    .insertInto('download_storage_usage')
    .values({ provider, year_month: yearMonth })
    .onConflict((oc) => oc.columns(['provider', 'year_month']).doNothing())
    .returningAll()
    .executeTakeFirst();

  if (inserted) return inserted;

  // Corrida com outro request: a linha ja foi criada entre o select e o insert.
  return db
    .selectFrom('download_storage_usage')
    .selectAll()
    .where('provider', '=', provider)
    .where('year_month', '=', yearMonth)
    .executeTakeFirstOrThrow();
}

/**
 * Lanca StorageQuotaExceededError-compativel (via caller) se a operacao
 * levaria o uso do mes acima da cota. Chamar ANTES de executar a operacao
 * real contra o provider.
 */
export async function assertWithinQuota(
  provider: StorageProviderName,
  quota: ProviderQuota,
  extraBytes: number,
  opsClass: OpsClass,
): Promise<void> {
  const yearMonth = currentYearMonth();
  const row = await getOrCreateRow(provider, yearMonth);

  const projectedBytes = row.bytes_used + extraBytes;
  if (quota.maxBytes !== null && projectedBytes > quota.maxBytes) {
    throw new QuotaCheckError(provider, `quota_bytes_exceeded:${provider}`);
  }

  const projectedClassA = row.class_a_ops + (opsClass === 'a' ? 1 : 0);
  if (quota.maxClassAOps !== null && projectedClassA > quota.maxClassAOps) {
    throw new QuotaCheckError(provider, `quota_class_a_exceeded:${provider}`);
  }

  const projectedClassB = row.class_b_ops + (opsClass === 'b' ? 1 : 0);
  if (quota.maxClassBOps !== null && projectedClassB > quota.maxClassBOps) {
    throw new QuotaCheckError(provider, `quota_class_b_exceeded:${provider}`);
  }
}

/** Registra a operacao efetivamente executada — chamar so apos sucesso real. */
export async function recordUsage(
  provider: StorageProviderName,
  extraBytes: number,
  opsClass: OpsClass,
): Promise<void> {
  const yearMonth = currentYearMonth();
  await getOrCreateRow(provider, yearMonth);

  await db
    .updateTable('download_storage_usage')
    .set((eb) => ({
      bytes_used: eb('bytes_used', '+', extraBytes),
      class_a_ops: eb('class_a_ops', '+', opsClass === 'a' ? 1 : 0),
      class_b_ops: eb('class_b_ops', '+', opsClass === 'b' ? 1 : 0),
      updated_at: new Date(),
    }))
    .where('provider', '=', provider)
    .where('year_month', '=', yearMonth)
    .execute();
}

export async function getCurrentUsage(provider: StorageProviderName) {
  const yearMonth = currentYearMonth();
  const row = await getOrCreateRow(provider, yearMonth);
  return { bytesUsed: row.bytes_used, classAOps: row.class_a_ops, classBOps: row.class_b_ops };
}

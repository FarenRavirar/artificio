import { createHash } from 'node:crypto';
import type { StorageAdapter, StorageProviderName } from './types';

// Migracao entre providers (T4.1/T4.2, spec 071 F4). Job explicito, gated por
// aprovacao nominal do mantenedor por rodada — NUNCA roda em background/cron
// automatico. Cada chamada migra uma lista fixa de keys, de um adapter de
// origem para um de destino, com reconciliacao por checksum SHA-256 antes de
// apagar da origem: se o hash nao bater, aborta o item (mantem origem intacta)
// em vez de arriscar perda de dados.

export interface MigrationItem {
  key: string;
}

export interface MigrationResult {
  key: string;
  status: 'migrated' | 'checksum_mismatch' | 'error';
  fromProvider: StorageProviderName;
  toProvider: StorageProviderName;
  error?: string;
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Migra um item por vez: baixa da origem, sobe no destino, recalcula
 * checksum dos dois lados e so apaga da origem se os hashes coincidirem.
 * Nao apaga nada quando o checksum diverge — item fica duplicado (origem +
 * destino) ate investigacao manual, nunca some.
 */
export async function migrateItem(
  item: MigrationItem,
  source: StorageAdapter,
  destination: StorageAdapter,
): Promise<MigrationResult> {
  const base: Pick<MigrationResult, 'key' | 'fromProvider' | 'toProvider'> = {
    key: item.key,
    fromProvider: source.provider,
    toProvider: destination.provider,
  };

  try {
    const sourceBuffer = await source.download(item.key);
    const sourceHash = sha256(sourceBuffer);

    await destination.upload({
      key: item.key,
      buffer: sourceBuffer,
      contentType: 'application/octet-stream',
    });

    const destBuffer = await destination.download(item.key);
    const destHash = sha256(destBuffer);

    if (sourceHash !== destHash) {
      return { ...base, status: 'checksum_mismatch' };
    }

    await source.delete(item.key);
    return { ...base, status: 'migrated' };
  } catch (error) {
    return { ...base, status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Roda uma rodada de migracao para uma lista de items. Nao para no primeiro
 * erro — cada item e independente, resultado agregado permite o mantenedor
 * decidir proxima rodada (retry so dos que falharam/divergiram).
 */
export async function runMigrationBatch(
  items: MigrationItem[],
  source: StorageAdapter,
  destination: StorageAdapter,
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  for (const item of items) {
    results.push(await migrateItem(item, source, destination));
  }
  return results;
}

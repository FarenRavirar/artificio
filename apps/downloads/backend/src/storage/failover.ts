import type { StorageAdapter, StorageUploadInput, StorageUploadResult } from './types';
import { StorageQuotaExceededError } from './types';

// Failover automatico (T3.2): tenta cada adapter na ordem fixa recebida
// (R2 -> B2 -> Fastio -> Cloudinary, D091). So avanca para o proximo em
// StorageQuotaExceededError; qualquer outro erro sobe (nao mascara falha real
// de credencial/rede como se fosse cota).

export interface FailoverLogEntry {
  provider: string;
  reason: string;
  timestamp: string;
}

export type FailoverAuditLogger = (entry: FailoverLogEntry) => void;

export async function uploadWithFailover(
  adapters: StorageAdapter[],
  input: StorageUploadInput,
  auditLog: FailoverAuditLogger = (entry) => console.info('[storage-failover]', entry),
): Promise<StorageUploadResult> {
  if (adapters.length === 0) {
    throw new Error('Nenhum storage adapter configurado.');
  }

  let lastError: unknown;

  for (const adapter of adapters) {
    try {
      return await adapter.upload(input);
    } catch (error) {
      lastError = error;
      if (error instanceof StorageQuotaExceededError) {
        auditLog({
          provider: adapter.provider,
          reason: error.message,
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha de upload em todos os providers de storage.');
}

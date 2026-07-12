import type { StorageAdapter, StorageUploadInput, StorageUploadResult, StorageUsage } from './types';
import { StorageQuotaExceededError } from './types';

// Fastio (fast.io, T2.3): 3o fallback. Sem SDK npm publicado — chamadas REST
// diretas via fetch nativo. Contrato exato (paths/campos) pendente de
// confirmacao real no momento da integracao (T0.1); estrutura abaixo segue o
// padrao REST generico documentado publicamente e deve ser revisada contra a
// doc oficial antes do primeiro deploy com credencial real.

const FASTIO_TIMEOUT_MS = 15_000;

export interface FastioConfig {
  apiBaseUrl: string;
  apiKey: string;
  bucket: string;
  publicBaseUrl: string;
  quotaBytes: number | null;
  fetchImpl?: typeof fetch;
}

export function createFastioAdapter(config: FastioConfig): StorageAdapter {
  const fetchImpl = config.fetchImpl ?? fetch;

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${config.apiKey}` };
  }

  return {
    provider: 'fastio',

    async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
      if (config.quotaBytes !== null) {
        const usage = await this.getUsage();
        if (usage.usedBytes + input.buffer.byteLength > config.quotaBytes) {
          throw new StorageQuotaExceededError('fastio', 'Cota de fastio excedida.');
        }
      }

      const response = await fetchImpl(`${config.apiBaseUrl}/buckets/${encodeURIComponent(config.bucket)}/objects/${encodeURIComponent(input.key)}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': input.contentType },
        body: new Uint8Array(input.buffer),
        signal: AbortSignal.timeout(FASTIO_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Fastio upload falhou: HTTP ${response.status}`);
      }

      return { provider: 'fastio', key: input.key };
    },

    getPublicUrl(key: string): string {
      const encodedKey = key.split('/').map(encodeURIComponent).join('/');
      return `${config.publicBaseUrl.replace(/\/$/, '')}/${encodedKey}`;
    },

    async delete(key: string): Promise<void> {
      const response = await fetchImpl(`${config.apiBaseUrl}/buckets/${encodeURIComponent(config.bucket)}/objects/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: authHeaders(),
        signal: AbortSignal.timeout(FASTIO_TIMEOUT_MS),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Fastio delete falhou: HTTP ${response.status}`);
      }
    },

    async getUsage(): Promise<StorageUsage> {
      const response = await fetchImpl(`${config.apiBaseUrl}/buckets/${encodeURIComponent(config.bucket)}/usage`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(FASTIO_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Fastio usage falhou: HTTP ${response.status}`);
      }
      const body = await response.json() as { used_bytes?: number };
      // Fastio nao tem regra petrea de free-tier (ao contrario do R2); cota
      // aqui e so protecao operacional basica, sem contador local dedicado.
      return {
        provider: 'fastio',
        usedBytes: body.used_bytes ?? 0,
        quotaBytes: config.quotaBytes,
        classAOps: 0,
        classBOps: 0,
        quotaClassAOps: null,
        quotaClassBOps: null,
      };
    },

    async download(key: string): Promise<Buffer> {
      const response = await fetchImpl(`${config.apiBaseUrl}/buckets/${encodeURIComponent(config.bucket)}/objects/${encodeURIComponent(key)}`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(FASTIO_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`Fastio download falhou: HTTP ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

import { createS3CompatAdapter } from './s3CompatAdapter';
import { createFastioAdapter } from './fastioAdapter';
import { createCloudinaryAdapter } from './cloudinaryAdapter';
import type { StorageAdapter } from './types';

export type { StorageAdapter, StorageProviderName, StorageUploadInput, StorageUploadResult, StorageUsage } from './types';
export { StorageQuotaExceededError } from './types';
export { uploadWithFailover } from './failover';

function parseQuota(raw: string | undefined, fallback: number | null): number | null {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// REGRA PETREA (mantenedor, 2026-07-12): free tier real do R2 e 10GB
// armazenamento / 1M operacoes Classe A (write/list/delete) / 10M operacoes
// Classe B (read) por mes. Zero risco de cobranca — os limites usados aqui
// sao 90% do free tier real, para que o failover dispare para B2 ANTES de
// qualquer chance de estourar e gerar custo. Nao subir estes defaults sem
// reconfirmar o free tier vigente da Cloudflare.
const R2_FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024; // 10 GiB
const R2_FREE_TIER_CLASS_A_OPS = 1_000_000;
const R2_FREE_TIER_CLASS_B_OPS = 10_000_000;
const R2_SAFETY_MARGIN = 0.9; // nunca chegar perto do limite real

const R2_DEFAULT_QUOTA_BYTES = Math.floor(R2_FREE_TIER_BYTES * R2_SAFETY_MARGIN);
const R2_DEFAULT_QUOTA_CLASS_A_OPS = Math.floor(R2_FREE_TIER_CLASS_A_OPS * R2_SAFETY_MARGIN);
const R2_DEFAULT_QUOTA_CLASS_B_OPS = Math.floor(R2_FREE_TIER_CLASS_B_OPS * R2_SAFETY_MARGIN);

// Ordem fixa R2 -> B2 -> Fastio -> Cloudinary (D091). Cada provider so entra
// na lista se as env vars obrigatorias estiverem presentes — permite rodar
// localmente so com Cloudinary configurado (ultimo fallback sempre disponivel
// via @artificio/media).
export function buildStorageAdapters(): StorageAdapter[] {
  const adapters: StorageAdapter[] = [];

  if (process.env.R2_ENDPOINT && process.env.R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
    adapters.push(createS3CompatAdapter({
      provider: 'r2',
      endpoint: process.env.R2_ENDPOINT,
      region: process.env.R2_REGION ?? 'auto',
      bucket: process.env.R2_BUCKET,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? '',
      quotaBytes: parseQuota(process.env.R2_QUOTA_BYTES, R2_DEFAULT_QUOTA_BYTES),
      quotaClassAOps: parseQuota(process.env.R2_QUOTA_CLASS_A_OPS, R2_DEFAULT_QUOTA_CLASS_A_OPS),
      quotaClassBOps: parseQuota(process.env.R2_QUOTA_CLASS_B_OPS, R2_DEFAULT_QUOTA_CLASS_B_OPS),
    }));
  }

  if (process.env.B2_ENDPOINT && process.env.B2_BUCKET && process.env.B2_ACCESS_KEY_ID && process.env.B2_SECRET_ACCESS_KEY) {
    adapters.push(createS3CompatAdapter({
      provider: 'b2',
      endpoint: process.env.B2_ENDPOINT,
      region: process.env.B2_REGION ?? 'us-west-000',
      bucket: process.env.B2_BUCKET,
      accessKeyId: process.env.B2_ACCESS_KEY_ID,
      secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
      publicBaseUrl: process.env.B2_PUBLIC_BASE_URL ?? '',
      quotaBytes: parseQuota(process.env.B2_QUOTA_BYTES, null),
      quotaClassAOps: parseQuota(process.env.B2_QUOTA_CLASS_A_OPS, null),
      quotaClassBOps: parseQuota(process.env.B2_QUOTA_CLASS_B_OPS, null),
    }));
  }

  if (process.env.FASTIO_API_BASE_URL && process.env.FASTIO_API_KEY && process.env.FASTIO_BUCKET) {
    adapters.push(createFastioAdapter({
      apiBaseUrl: process.env.FASTIO_API_BASE_URL,
      apiKey: process.env.FASTIO_API_KEY,
      bucket: process.env.FASTIO_BUCKET,
      publicBaseUrl: process.env.FASTIO_PUBLIC_BASE_URL ?? '',
      quotaBytes: parseQuota(process.env.FASTIO_QUOTA_BYTES, null),
    }));
  }

  adapters.push(createCloudinaryAdapter());

  return adapters;
}

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { StorageAdapter, StorageProviderName, StorageUploadInput, StorageUploadResult, StorageUsage } from './types';
import { StorageQuotaExceededError } from './types';
import { assertWithinQuota, recordUsage, getCurrentUsage } from './usageTracker';

// Adapter S3-compativel: usado por R2 (T2.1, primario) e B2 (T2.2, fallback
// por cota) — ambos expoem API compativel com S3 (T0.1 confirmado no plan.md).
//
// REGRA PETREA (mantenedor): free tier R2 = 10GB / 1M ops Classe A / 10M ops
// Classe B. Zero risco de cobranca — cota configurada com 10% de margem
// (build-r2/b2 config), checada localmente ANTES de cada operacao real via
// usageTracker (nunca bate no provider pra medir uso — ListObjectsV2 tambem
// gastaria Classe B).

export interface S3CompatConfig {
  provider: StorageProviderName;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  quotaBytes: number | null;
  quotaClassAOps: number | null;
  quotaClassBOps: number | null;
}

export function createS3CompatAdapter(config: S3CompatConfig): StorageAdapter {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const quota = {
    maxBytes: config.quotaBytes,
    maxClassAOps: config.quotaClassAOps,
    maxClassBOps: config.quotaClassBOps,
  };

  return {
    provider: config.provider,

    async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
      try {
        await assertWithinQuota(config.provider, quota, input.buffer.byteLength, 'a');
      } catch {
        throw new StorageQuotaExceededError(config.provider, `Cota de ${config.provider} excedida (upload).`);
      }

      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        Body: input.buffer,
        ContentType: input.contentType,
      }));

      await recordUsage(config.provider, input.buffer.byteLength, 'a');

      return { provider: config.provider, key: input.key };
    },

    getPublicUrl(key: string): string {
      return `${config.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    },

    async delete(key: string): Promise<void> {
      try {
        await assertWithinQuota(config.provider, quota, 0, 'a');
      } catch {
        throw new StorageQuotaExceededError(config.provider, `Cota de ${config.provider} excedida (delete).`);
      }

      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
      await recordUsage(config.provider, 0, 'a');
    },

    async getUsage(): Promise<StorageUsage> {
      // Le do contador local — nunca do provider (ListObjectsV2 gastaria
      // cota Classe B so pra medir uso, o que viola a regra petrea).
      const usage = await getCurrentUsage(config.provider);
      return {
        provider: config.provider,
        usedBytes: usage.bytesUsed,
        quotaBytes: config.quotaBytes,
        classAOps: usage.classAOps,
        classBOps: usage.classBOps,
        quotaClassAOps: config.quotaClassAOps,
        quotaClassBOps: config.quotaClassBOps,
      };
    },
  };
}

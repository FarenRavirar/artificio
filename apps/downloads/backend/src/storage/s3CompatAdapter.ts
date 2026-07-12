import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { StorageAdapter, StorageProviderName, StorageUploadInput, StorageUploadResult, StorageUsage } from './types';
import { StorageQuotaExceededError } from './types';
import { assertWithinQuota, recordUsage, getCurrentUsage, QuotaCheckError } from './usageTracker';

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
      } catch (err) {
        if (err instanceof QuotaCheckError) {
          throw new StorageQuotaExceededError(config.provider, `Cota de ${config.provider} excedida (upload).`);
        }
        throw err;
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
      const encodedKey = key.split('/').map(encodeURIComponent).join('/');
      return `${config.publicBaseUrl.replace(/\/$/, '')}/${encodedKey}`;
    },

    async delete(key: string): Promise<void> {
      try {
        await assertWithinQuota(config.provider, quota, 0, 'a');
      } catch (err) {
        if (err instanceof QuotaCheckError) {
          throw new StorageQuotaExceededError(config.provider, `Cota de ${config.provider} excedida (delete).`);
        }
        throw err;
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

    async download(key: string): Promise<Buffer> {
      // Download usado so por reconciliacao/migracao (T4.1/T4.2), nao pelo
      // fluxo normal de servir arquivo (isso passa por getPublicUrl). Gasta
      // cota Classe B — chamador decide se registra via recordUsage.
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      const chunks: Buffer[] = [];
      const body = result.Body as AsyncIterable<Buffer> | undefined;
      if (!body) {
        throw new Error(`Download de ${config.provider} falhou: corpo vazio para ${key}`);
      }
      for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    },
  };
}

import { uploadBuffer, deleteAsset } from '@artificio/media';
import type { StorageAdapter, StorageUploadInput, StorageUploadResult, StorageUsage } from './types';

// Cloudinary raw/PDF (T2.4): ultimo fallback. Reusa @artificio/media (mesmo
// pacote compartilhado ja usado por mesas/glossario) em vez de client proprio
// — evita segunda config de credencial Cloudinary no repo.

export function createCloudinaryAdapter(): StorageAdapter {
  return {
    provider: 'cloudinary',

    async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
      const result = await uploadBuffer(input.buffer, {
        folder: 'downloads-materials',
        publicId: input.key,
        resourceType: 'raw',
        overwrite: true,
      });
      return { provider: 'cloudinary', key: result.public_id };
    },

    getPublicUrl(key: string): string {
      // URL publica estavel via rota propria do backend — nunca expoe URL
      // crua do Cloudinary ao cliente (spec 071 §Escopo).
      return key;
    },

    async delete(key: string): Promise<void> {
      await deleteAsset(key, { resourceType: 'raw' });
    },

    async getUsage(): Promise<StorageUsage> {
      // Cloudinary e o ultimo fallback (sem cota de negocio propria aqui);
      // medicao de uso fica no dashboard Cloudinary compartilhado.
      return {
        provider: 'cloudinary',
        usedBytes: 0,
        quotaBytes: null,
        classAOps: 0,
        classBOps: 0,
        quotaClassAOps: null,
        quotaClassBOps: null,
      };
    },

    async download(key: string): Promise<Buffer> {
      // Cloudinary raw asset e servido por URL publica estavel (key aqui e o
      // public_id, que dobra como URL — ver getPublicUrl acima).
      const response = await fetch(key);
      if (!response.ok) {
        throw new Error(`Cloudinary download falhou: HTTP ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

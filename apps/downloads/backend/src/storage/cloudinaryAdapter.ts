import { uploadBuffer, deleteAsset } from '@artificio/media';
import type { StorageAdapter, StorageUploadInput, StorageUploadResult, StorageUsage } from './types';

// Cloudinary raw/PDF (T2.4): ultimo fallback. Reusa @artificio/media (mesmo
// pacote compartilhado ja usado por mesas/glossario) em vez de client proprio
// — evita segunda config de credencial Cloudinary no repo.

const CLOUDINARY_DOWNLOAD_TIMEOUT_MS = 15_000;

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
      // key aqui e o public_id do Cloudinary (nao uma URL); reconstroi a URL
      // real do asset raw a partir do cloud_name configurado (mesmo padrao
      // que @artificio/media usa internamente). Achado de review (PR #151):
      // versao anterior retornava a key crua, quebrando download() e
      // qualquer consumidor que precisasse da URL publica de fato.
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      if (!cloudName) {
        throw new Error('CLOUDINARY_CLOUD_NAME não configurado — impossível montar URL pública do Cloudinary.');
      }
      return `https://res.cloudinary.com/${cloudName}/raw/upload/${key}`;
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
      const response = await fetch(this.getPublicUrl(key), { signal: AbortSignal.timeout(CLOUDINARY_DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`Cloudinary download falhou: HTTP ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

// StorageAdapter (spec 071, T1.1): interface unica plugavel para os 4
// providers na ordem fixa R2 -> B2 -> Fastio -> Cloudinary (D091, D111 item 9).
// Trocar provider e config (STORAGE_PROVIDER_ORDER), nunca condicional
// espalhada nas rotas.

export type StorageProviderName = 'r2' | 'b2' | 'fastio' | 'cloudinary';

export interface StorageUploadInput {
  buffer: Buffer;
  key: string;
  contentType: string;
}

export interface StorageUploadResult {
  provider: StorageProviderName;
  key: string;
}

export interface StorageUsage {
  provider: StorageProviderName;
  usedBytes: number;
  quotaBytes: number | null;
  classAOps: number;
  classBOps: number;
  quotaClassAOps: number | null;
  quotaClassBOps: number | null;
}

export interface StorageAdapter {
  readonly provider: StorageProviderName;
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
  getUsage(): Promise<StorageUsage>;
}

export class StorageQuotaExceededError extends Error {
  constructor(readonly provider: StorageProviderName, message: string) {
    super(message);
    this.name = 'StorageQuotaExceededError';
  }
}

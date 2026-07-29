import { randomUUID } from 'node:crypto';
import { destroyAssetResult, downloadPublicImage, uploadBuffer, uploadFromUrl, type UploadResult } from '@artificio/media';
import { db } from '../db';
import { CoverImageValidationError, validateCoverImage } from './coverImage';

export const COVER_FOLDER = 'downloads-covers';
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

export class CoverMetadataWriteError extends Error {}

export function isCloudinaryCoverEnabled(): boolean {
  return process.env.DOWNLOADS_CLOUDINARY_COVERS_ENABLED?.trim().toLowerCase() === 'true';
}

export function isOwnedCoverPublicId(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith(`${COVER_FOLDER}/`));
}

export function externalCoverFields(url: string | null) {
  return {
    cover_image_url: url,
    cover_storage_provider: url ? 'external' : null,
    cover_public_id: null,
    cover_width: null,
    cover_height: null,
    cover_mime_type: null,
  };
}

function emptyMetadata(materialId: string) {
  return {
    material_id: materialId,
    scenario: null,
    genre: null,
    language: 'pt' as const,
    file_format: null,
    vtt_platform: null,
    license_kind: null,
    license_url: null,
    credits: null,
    target_audience: null,
    age_rating: null,
    publisher_name: null,
    publisher_key: null,
    file_size_text: null,
    page_count: null,
    creation_method: null,
    source_category: null,
    description_html: null,
    description_markdown: null,
  };
}

async function currentCover(materialId: string) {
  return db
    .selectFrom('download_material_metadata')
    .select(['cover_storage_provider', 'cover_public_id', 'cover_pending_delete_public_id'])
    .where('material_id', '=', materialId)
    .executeTakeFirst();
}

async function clearDeletedCover(materialId: string, publicId: string): Promise<void> {
  await db
    .updateTable('download_material_metadata')
    .set({ cover_pending_delete_public_id: null, updated_at: new Date() })
    .where('material_id', '=', materialId)
    .where('cover_pending_delete_public_id', '=', publicId)
    .executeTakeFirst();
}

export async function retryPendingCoverDeletion(materialId: string, publicId: string): Promise<boolean> {
  if (!isOwnedCoverPublicId(publicId) || !await destroyAssetResult(publicId)) return false;
  await clearDeletedCover(materialId, publicId);
  return true;
}

async function ensureNoPendingDeletion(materialId: string) {
  const metadata = await currentCover(materialId);
  const pending = metadata?.cover_pending_delete_public_id;
  if (pending && !await retryPendingCoverDeletion(materialId, pending)) {
    throw new Error('A remoção da capa anterior ainda está pendente. Tente novamente.');
  }
  return metadata && pending ? { ...metadata, cover_pending_delete_public_id: null } : metadata;
}

async function persistManagedCover(
  materialId: string,
  uploaded: UploadResult,
  validated: { width: number; height: number; mimeType: string },
  metadata: Awaited<ReturnType<typeof currentCover>>,
) {
  if (!isOwnedCoverPublicId(uploaded.public_id)) {
    await destroyAssetResult(uploaded.public_id);
    throw new Error('Provedor devolveu identidade de capa inválida.');
  }
  const oldPublicId = metadata?.cover_storage_provider === 'cloudinary'
    && isOwnedCoverPublicId(metadata.cover_public_id)
    && metadata.cover_public_id !== uploaded.public_id
    ? metadata.cover_public_id
    : null;
  const fields = {
    cover_image_url: uploaded.url,
    cover_storage_provider: 'cloudinary',
    cover_public_id: uploaded.public_id,
    cover_width: uploaded.width ?? validated.width,
    cover_height: uploaded.height ?? validated.height,
    cover_mime_type: validated.mimeType,
    cover_pending_delete_public_id: oldPublicId,
    updated_at: new Date(),
  };
  try {
    await db
      .insertInto('download_material_metadata')
      .values({ ...emptyMetadata(materialId), ...fields })
      .onConflict((conflict) => conflict.column('material_id').doUpdateSet(fields))
      .executeTakeFirstOrThrow();
  } catch (error) {
    await destroyAssetResult(uploaded.public_id);
    throw new CoverMetadataWriteError(error instanceof Error ? error.message : 'Falha ao salvar a capa.');
  }
  if (oldPublicId && await destroyAssetResult(oldPublicId)) await clearDeletedCover(materialId, oldPublicId);
  return {
    cover_image_url: uploaded.url,
    width: fields.cover_width,
    height: fields.cover_height,
    mime_type: validated.mimeType,
  };
}

export async function persistExternalCover(materialId: string, url: string | null): Promise<void> {
  const metadata = await currentCover(materialId);
  const oldPublicId = metadata?.cover_storage_provider === 'cloudinary'
    && isOwnedCoverPublicId(metadata.cover_public_id)
    ? metadata.cover_public_id
    : null;
  const fields = {
    ...externalCoverFields(url),
    cover_pending_delete_public_id: oldPublicId ?? metadata?.cover_pending_delete_public_id ?? null,
    updated_at: new Date(),
  };
  await db
    .insertInto('download_material_metadata')
    .values({ ...emptyMetadata(materialId), ...fields })
    .onConflict((conflict) => conflict.column('material_id').doUpdateSet(fields))
    .executeTakeFirstOrThrow();
  const pendingDeletion = fields.cover_pending_delete_public_id;
  if (isCloudinaryCoverEnabled() && pendingDeletion && await destroyAssetResult(pendingDeletion)) {
    await clearDeletedCover(materialId, pendingDeletion);
  }
}

function uploadPreset(): string {
  const preset = process.env.CLOUDINARY_COVER_UPLOAD_PRESET?.trim();
  if (!preset) throw new Error('Upload de capa não configurado.');
  return preset;
}

export async function storeCoverBuffer(materialId: string, buffer: Buffer, filename: string, mimeType: string) {
  if (!isCloudinaryCoverEnabled()) throw new Error('Upload de capa está desligado.');
  const validated = validateCoverImage(buffer, filename, mimeType);
  const metadata = await ensureNoPendingDeletion(materialId);
  const uploaded = await uploadBuffer(buffer, {
    folder: COVER_FOLDER,
    publicId: `material-${materialId}-${randomUUID()}`,
    uploadPreset: uploadPreset(),
    resourceType: 'image',
    overwrite: false,
  });
  return persistManagedCover(materialId, uploaded, validated, metadata);
}

export async function storeCoverFromPublicUrl(materialId: string, sourceUrl: string) {
  if (!isCloudinaryCoverEnabled()) {
    await persistExternalCover(materialId, sourceUrl);
    return { cover_image_url: sourceUrl, external: true as const };
  }
  const downloaded = await downloadPublicImage(sourceUrl, {
    maxBytes: MAX_COVER_BYTES,
    userAgent: 'DownloadsArtificioRPG/1.0 image-import',
  });
  const extension = downloaded.contentType === 'image/png' ? 'png' : downloaded.contentType === 'image/webp' ? 'webp' : 'jpg';
  return storeCoverBuffer(materialId, downloaded.buffer, `remote.${extension}`, downloaded.contentType);
}

export async function prepareScrapedCover(sourceUrl: string | null) {
  if (!sourceUrl || !isCloudinaryCoverEnabled()) return { ...externalCoverFields(sourceUrl), uploadedPublicId: null };
  try {
    const uploaded = await uploadFromUrl(sourceUrl, {
      folder: COVER_FOLDER,
      maxBytes: MAX_COVER_BYTES,
      uploadPreset: uploadPreset(),
    });
    if (!isOwnedCoverPublicId(uploaded.public_id)) {
      await destroyAssetResult(uploaded.public_id);
      throw new Error('Provedor devolveu identidade de capa inválida.');
    }
    return {
      cover_image_url: uploaded.url,
      cover_storage_provider: 'cloudinary',
      cover_public_id: uploaded.public_id,
      cover_width: uploaded.width,
      cover_height: uploaded.height,
      cover_mime_type: null,
      uploadedPublicId: uploaded.public_id,
    };
  } catch (error) {
    if (error instanceof CoverImageValidationError) throw error;
    console.warn('[scraper-cover] cópia falhou; mantendo URL externa', { sourceUrl, error: String(error) });
    return { ...externalCoverFields(sourceUrl), uploadedPublicId: null };
  }
}

import { randomUUID } from 'node:crypto';
import { destroyAssetResult, downloadPublicImage, uploadBuffer, type UploadResult } from '@artificio/media';
import { db } from '../db';
import { CoverImageValidationError, validateCoverImage } from './coverImage';

export const COVER_FOLDER = 'downloads-covers';
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

const materialCoverOperations = new Map<string, Promise<unknown>>();

async function serializeMaterialCoverOperation<T>(materialId: string, operation: () => Promise<T>): Promise<T> {
  const previous = materialCoverOperations.get(materialId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  materialCoverOperations.set(materialId, current);
  try {
    return await current;
  } finally {
    if (materialCoverOperations.get(materialId) === current) materialCoverOperations.delete(materialId);
  }
}

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

async function ensureNoPendingDeletion(materialId: string, deletionEnabled = true) {
  const metadata = await currentCover(materialId);
  const pending = metadata?.cover_pending_delete_public_id;
  if (pending && (!deletionEnabled || !await retryPendingCoverDeletion(materialId, pending))) {
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

async function persistExternalCoverUnlocked(materialId: string, url: string | null): Promise<void> {
  // Achado de review PR #228: uma única coluna rastreia exclusão pendente.
  // Resolver a pendência anterior antes de calcular a próxima evita
  // sobrescrever um public_id ainda não destruído e perder o retry.
  const metadata = await ensureNoPendingDeletion(materialId, isCloudinaryCoverEnabled());
  const oldPublicId = metadata?.cover_storage_provider === 'cloudinary'
    && isOwnedCoverPublicId(metadata.cover_public_id)
    ? metadata.cover_public_id
    : null;
  const fields = {
    ...externalCoverFields(url),
    cover_pending_delete_public_id: oldPublicId,
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

export function persistExternalCover(materialId: string, url: string | null): Promise<void> {
  return serializeMaterialCoverOperation(materialId, () => persistExternalCoverUnlocked(materialId, url));
}

function uploadPreset(): string {
  const preset = process.env.CLOUDINARY_COVER_UPLOAD_PRESET?.trim();
  if (!preset) throw new Error('Upload de capa não configurado.');
  return preset;
}

function coverExtensionForMimeType(contentType: string): 'png' | 'webp' | 'jpg' {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

async function storeCoverBufferUnlocked(materialId: string, buffer: Buffer, filename: string, mimeType: string) {
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

export function storeCoverBuffer(materialId: string, buffer: Buffer, filename: string, mimeType: string) {
  // Achado de review PR #228 (Codex P2): substituições concorrentes podiam
  // ler a mesma capa anterior e órfã o primeiro upload. Fila por material
  // mantém leitura, upload e persistência na mesma ordem dentro do backend.
  return serializeMaterialCoverOperation(
    materialId,
    () => storeCoverBufferUnlocked(materialId, buffer, filename, mimeType),
  );
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
  // Achado real (review PR #228, Sonar): decisão nomeada evita ternário
  // aninhado duplicado nos dois caminhos de capa remota.
  const extension = coverExtensionForMimeType(downloaded.contentType);
  return storeCoverBuffer(materialId, downloaded.buffer, `remote.${extension}`, downloaded.contentType);
}

export async function prepareScrapedCover(sourceUrl: string | null) {
  if (!sourceUrl || !isCloudinaryCoverEnabled()) return { ...externalCoverFields(sourceUrl), uploadedPublicId: null };
  try {
    // Achado de review PR #228 (Codex P1, SSRF): URL raspada é entrada de
    // terceiro. Baixar pelo caminho público validado aplica
    // `assertPublicHttpUrl` na URL inicial e em cada redirect;
    // `validateCoverImage` confere assinatura real, igual ao upload manual.
    const downloaded = await downloadPublicImage(sourceUrl, {
      maxBytes: MAX_COVER_BYTES,
      userAgent: 'DownloadsArtificioRPG/1.0 scraper-cover',
    });
    const extension = coverExtensionForMimeType(downloaded.contentType);
    const validated = validateCoverImage(downloaded.buffer, `scraped.${extension}`, downloaded.contentType);
    const uploaded = await uploadBuffer(downloaded.buffer, {
      folder: COVER_FOLDER,
      uploadPreset: uploadPreset(),
      resourceType: 'image',
      overwrite: false,
    });
    if (!isOwnedCoverPublicId(uploaded.public_id)) {
      await destroyAssetResult(uploaded.public_id);
      throw new Error('Provedor devolveu identidade de capa inválida.');
    }
    return {
      cover_image_url: uploaded.url,
      cover_storage_provider: 'cloudinary',
      cover_public_id: uploaded.public_id,
      cover_width: uploaded.width ?? validated.width,
      cover_height: uploaded.height ?? validated.height,
      cover_mime_type: validated.mimeType,
      uploadedPublicId: uploaded.public_id,
    };
  } catch (error) {
    if (error instanceof CoverImageValidationError) throw error;
    console.warn('[scraper-cover] cópia falhou; mantendo URL externa', { sourceUrl, error: String(error) });
    return { ...externalCoverFields(sourceUrl), uploadedPublicId: null };
  }
}

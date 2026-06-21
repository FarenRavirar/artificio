import { configure, isConfigured, uploadFromUrl, deleteAsset, type UploadResult } from "@artificio/media";
import { fetchOgImage } from "./og.js";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const FOLDER = "artificio/links";

export const cloudinaryEnabled = isConfigured;
export type StoredLogo = UploadResult;

export async function uploadLogoFromUrl(sourceUrl: string): Promise<UploadResult> {
  if (!isConfigured()) throw new Error("Cloudinary não configurado (CLOUDINARY_URL ou CLOUDINARY_CLOUD_NAME+API_KEY+API_SECRET).");
  return uploadFromUrl(sourceUrl, { folder: FOLDER, maxBytes: MAX_LOGO_BYTES });
}

export async function deleteLogo(publicId: string | null): Promise<void> {
  if (!publicId || !isConfigured()) return;
  await deleteAsset(publicId);
}

export async function resolveLogo(inviteUrl: string, tag?: string): Promise<{ logo_url: string; logo_public_id: string } | null> {
  if (!isConfigured()) return null;
  const og = await fetchOgImage(inviteUrl);
  if (!og) return null;
  try {
    const stored = await uploadLogoFromUrl(og);
    return { logo_url: stored.url, logo_public_id: stored.public_id };
  } catch (e) {
    console.warn(`[links${tag ? `/${tag}` : ""}] upload de logo falhou:`, String(e));
    return null;
  }
}

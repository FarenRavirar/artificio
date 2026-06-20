// Armazenamento de upload de mídia (spec 011, fase 2, T18). Env-gated:
//   - CLOUDINARY_URL (ou CLOUDINARY_CLOUD_NAME+API_KEY+API_SECRET) => upload real (source=cloudinary).
//   - ausente => grava em apps/site/uploads e serve via /uploads (source=local, modo dev/local).
import { isConfigured, uploadBuffer, deleteAsset } from "@artificio/media";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = process.env.SITE_UPLOADS_DIR || resolve(here, "../../uploads");

export const cloudinaryEnabled = isConfigured;

export interface StoredMedia {
  source: "cloudinary" | "local";
  url: string;
  public_id: string | null;
  width: number | null;
  height: number | null;
}

/** Sobe um buffer já validado. ext = extensão com ponto (".jpg") p/ o nome local. */
export async function storeUpload(buffer: Buffer, ext: string): Promise<StoredMedia> {
  if (isConfigured()) {
    const res = await uploadBuffer(buffer, { folder: "artificio/uploads", resourceType: "auto" });
    return { source: "cloudinary", url: res.url, public_id: res.public_id, width: res.width, height: res.height };
  }
  // dev/local: grava em disco e serve via /uploads (efêmero no container; documentado)
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  const name = `${randomUUID()}${ext}`;
  writeFileSync(resolve(UPLOADS_DIR, name), buffer);
  return { source: "local", url: `/uploads/${name}`, public_id: null, width: null, height: null };
}

/** Remove asset do Cloudinary por public_id. Não-fatal (usado p/ limpar feedback excluído). */
export async function deleteStoredMedia(publicId: string | null): Promise<void> {
  if (!publicId || !isConfigured()) return;
  await deleteAsset(publicId);
}

// Armazenamento de upload de mídia (spec 011, fase 2, T18). Env-gated:
//   - CLOUDINARY_URL (ou CLOUDINARY_CLOUD_NAME+API_KEY+API_SECRET) => upload real (source=cloudinary).
//   - ausente => grava em apps/site/uploads e serve via /uploads (source=local, modo dev/local).
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = process.env.SITE_UPLOADS_DIR || resolve(here, "../../uploads");

export function cloudinaryEnabled(): boolean {
  return Boolean(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);
}

let configured = false;
function ensureConfig(): void {
  if (configured) return;
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config(); // lê CLOUDINARY_URL
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  configured = true;
}

export interface StoredMedia {
  source: "cloudinary" | "local";
  url: string;
  public_id: string | null;
  width: number | null;
  height: number | null;
}

interface CloudinaryUploadResult {
  secure_url: string; public_id: string; width?: number; height?: number;
}

/** Sobe um buffer já validado. ext = extensão com ponto (".jpg") p/ o nome local. */
export async function storeUpload(buffer: Buffer, ext: string): Promise<StoredMedia> {
  if (cloudinaryEnabled()) {
    ensureConfig();
    const res = await new Promise<CloudinaryUploadResult>((resolvePromise, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "artificio/uploads", resource_type: "auto", overwrite: false },
        (err, result) => (err || !result ? reject(err ?? new Error("upload vazio")) : resolvePromise(result as CloudinaryUploadResult)),
      );
      stream.end(buffer);
    });
    return { source: "cloudinary", url: res.secure_url, public_id: res.public_id, width: res.width ?? null, height: res.height ?? null };
  }
  // dev/local: grava em disco e serve via /uploads (efêmero no container; documentado)
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  const name = `${randomUUID()}${ext}`;
  writeFileSync(resolve(UPLOADS_DIR, name), buffer);
  return { source: "local", url: `/uploads/${name}`, public_id: null, width: null, height: null };
}

/** Remove asset do Cloudinary por public_id. Não-fatal (usado p/ limpar feedback excluído). */
export async function deleteStoredMedia(publicId: string | null): Promise<void> {
  if (!publicId || !cloudinaryEnabled()) return;
  ensureConfig();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.error("[media-store] delete falhou:", publicId, String(err));
  }
}

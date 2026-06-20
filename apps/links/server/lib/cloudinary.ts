// Upload de logo p/ Cloudinary. Modelado em apps/mesas/.../uploadDiscordImage.ts (canon atual).
// NOTA: é uma cópia do padrão storeUpload/uploadBuffer — débito BL-CLOUDINARY-SHARED aberto
// p/ extrair um util compartilhado e remover a duplicação (ver spec 013 / backlog).
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

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

export function cloudinaryEnabled(): boolean {
  return Boolean(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);
}

export interface StoredLogo {
  url: string;
  public_id: string;
}

function uploadBuffer(buffer: Buffer, publicId: string): Promise<StoredLogo> {
  return new Promise((resolvePromise, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "artificio/links", public_id: publicId, resource_type: "image", overwrite: false },
      (err, result?: UploadApiResponse) => {
        if (err) return reject(err);
        if (!result?.secure_url || !result.public_id) return reject(new Error("Cloudinary não retornou URL."));
        resolvePromise({ url: result.secure_url, public_id: result.public_id });
      },
    );
    Readable.from(buffer).pipe(stream);
  });
}

/**
 * Baixa uma imagem (ex.: og:image do convite) e sobe ao Cloudinary.
 * public_id = sha256 do conteúdo (idempotente; mesma imagem não duplica).
 * Lança em falha — o chamador decide se é fatal (seed) ou não (sugestão).
 */
export async function uploadLogoFromUrl(sourceUrl: string): Promise<StoredLogo> {
  if (!cloudinaryEnabled()) throw new Error("Cloudinary não configurado (CLOUDINARY_URL/CLOUDINARY_CLOUD_NAME).");
  ensureConfig();

  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Download da imagem falhou: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
    throw new Error(`Conteúdo não é imagem suportada: ${contentType || "sem content-type"}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) throw new Error("Imagem vazia.");

  const publicId = createHash("sha256").update(buffer).digest("hex");
  return uploadBuffer(buffer, publicId);
}

/** Remove asset por public_id. Não-fatal. */
export async function deleteLogo(publicId: string | null): Promise<void> {
  if (!publicId || !cloudinaryEnabled()) return;
  ensureConfig();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.error("[links/cloudinary] destroy falhou:", publicId, String(err));
  }
}

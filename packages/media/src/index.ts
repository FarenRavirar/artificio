import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

let configured = false;

export interface MediaConfig {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface UploadBufferOpts {
  folder: string;
  publicId?: string;
  resourceType?: "image" | "video" | "raw" | "auto";
  overwrite?: boolean;
}

export interface UploadFromUrlOpts {
  folder: string;
  maxBytes?: number;
  timeout?: number;
}

export interface UploadResult {
  url: string;
  public_id: string;
  width: number | null;
  height: number | null;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_TIMEOUT_MS = 10_000;

export function configure(opts?: MediaConfig): void {
  if (configured) return;
  if (opts?.cloudName && opts?.apiKey && opts?.apiSecret) {
    cloudinary.config({
      cloud_name: opts.cloudName,
      api_key: opts.apiKey,
      api_secret: opts.apiSecret,
      secure: true,
    });
  } else if (process.env.CLOUDINARY_URL) {
    cloudinary.config();
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

export function isConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
}

export function uploadBuffer(buffer: Buffer, opts: UploadBufferOpts): Promise<UploadResult> {
  configure();
  return new Promise((resolvePromise, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder,
        public_id: opts.publicId ?? undefined,
        resource_type: opts.resourceType ?? "image",
        overwrite: opts.overwrite ?? false,
      },
      (err, result?: UploadApiResponse) => {
        if (err) return reject(err);
        if (!result?.secure_url || !result.public_id) return reject(new Error("Cloudinary não retornou URL."));
        resolvePromise({ url: result.secure_url, public_id: result.public_id, width: result.width ?? null, height: result.height ?? null });
      },
    );
    Readable.from(buffer).pipe(stream);
  });
}

export async function uploadFromUrl(sourceUrl: string, opts: UploadFromUrlOpts): Promise<UploadResult> {
  configure();
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;

  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`Download falhou: HTTP ${response.status}`);

  const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
    throw new Error(`Conteúdo não é imagem suportada: ${contentType || "sem content-type"}`);
  }

  const cl = response.headers.get("content-length");
  if (cl && Number(cl) > maxBytes) {
    throw new Error(`Imagem excede limite de ${maxBytes} bytes: ${cl} bytes (content-length).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) throw new Error("Imagem vazia.");
  if (buffer.byteLength > maxBytes) throw new Error(`Imagem excede limite de ${maxBytes} bytes: ${buffer.byteLength} bytes.`);

  const publicId = createHash("sha256").update(buffer).digest("hex");
  return uploadBuffer(buffer, { folder: opts.folder, publicId });
}

export async function deleteAsset(publicId: string, opts?: { resourceType?: "image" | "video" | "raw" }): Promise<void> {
  if (!publicId) return;
  configure();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: opts?.resourceType ?? "image" });
  } catch (err) {
    console.error("[@artificio/media] deleteAsset falhou:", publicId, String(err));
  }
}

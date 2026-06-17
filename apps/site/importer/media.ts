// Migração de mídia WP -> Cloudinary (D025/R8). Env-gated:
//   - CLOUDINARY_URL (ou CLOUDINARY_CLOUD_NAME+API_KEY+API_SECRET) presente => upload + rewrite.
//   - ausente => dry-run: mantém URLs do WP (zero rede, zero credencial).
// Cloudinary regenera variantes; guardamos só o secure_url do original. Idempotente via media_map.
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import type { Db } from "../db/connection.js";

let configured = false;

export interface MediaFailure {
  wpUrl: string;
  motivo: string;
}

export interface MediaReport {
  migrated: number;
  failures: MediaFailure[];
}

const mediaReport: MediaReport = {
  migrated: 0,
  failures: [],
};

const failedThisRun = new Set<string>();

let uploadImpl: ((wpUrl: string) => Promise<string>) | null = null;
let avifFallbackImpl: ((wpUrl: string) => Promise<string | null>) | null = null;

export function cloudinaryEnabled(): boolean {
  return Boolean(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);
}

// Migração em massa das mídias WP -> Cloudinary é OPT-IN (SITE_MIGRATE_MEDIA=true).
// Sem isso, o import-on-start mantém as URLs do WP (dry-run, boot rápido) mesmo com
// Cloudinary configurado — uploads NOVOS pelo admin (server/lib/media-store) seguem indo
// pro Cloudinary normalmente. Evita estourar o healthcheck subindo ~485 mídias no boot.
export function mediaMigrationEnabled(): boolean {
  return cloudinaryEnabled() && process.env.SITE_MIGRATE_MEDIA === "true";
}

export function resetMediaReport(): void {
  mediaReport.migrated = 0;
  mediaReport.failures = [];
  failedThisRun.clear();
}

export function getMediaReport(): MediaReport {
  return {
    migrated: mediaReport.migrated,
    failures: [...mediaReport.failures],
  };
}

export function __setUploadForTest(upload: ((wpUrl: string) => Promise<string>) | null): void {
  uploadImpl = upload;
}

export function __setAvifFallbackForTest(upload: ((wpUrl: string) => Promise<string | null>) | null): void {
  avifFallbackImpl = upload;
}

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

/** Extrai URLs de imagem do WP (/wp-content/) do HTML. */
export function extractImageUrls(html: string): string[] {
  const re = /<img[^>]+src="([^"]+)"/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (/\/wp-content\//.test(m[1])) out.add(m[1]);
  }
  return [...out];
}

/** Substitui ocorrências de URLs pelo destino (mapa from->to). */
export function rewriteUrls(html: string, map: Map<string, string>): string {
  let out = html;
  for (const [from, to] of map) {
    if (from !== to) out = out.split(from).join(to);
  }
  return out;
}

/** public_id estável a partir da URL WP (idempotência do upload). */
export function publicIdFor(wpUrl: string): string {
  try {
    const u = new URL(wpUrl);
    const path = u.pathname.replace(/^\/wp-content\/uploads\//, "").replace(/\.[a-z0-9]+$/i, "");
    return "artificio/blog/" + path.replace(/[^a-zA-Z0-9/_-]/g, "-");
  } catch {
    return "artificio/blog/" + wpUrl.replace(/[^a-zA-Z0-9]/g, "-").slice(-80);
  }
}

export function stripSizeSuffix(wpUrl: string): string {
  try {
    const url = new URL(wpUrl);
    url.pathname = url.pathname.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, "$1");
    return url.toString();
  } catch {
    return wpUrl.replace(/-\d+x\d+(\.[a-z0-9]+)(\?.*)?$/i, "$1$2");
  }
}

async function uploadToCloudinary(wpUrl: string): Promise<string> {
  if (uploadImpl) return uploadImpl(wpUrl);
  ensureConfig();
  const res = await cloudinary.uploader.upload(wpUrl, {
    public_id: publicIdFor(wpUrl),
    overwrite: false,
    resource_type: "image",
  });
  return res.secure_url;
}

function isAvifUrl(wpUrl: string): boolean {
  try {
    return new URL(wpUrl).pathname.toLowerCase().endsWith(".avif");
  } catch {
    return /\.avif(?:[?#].*)?$/i.test(wpUrl);
  }
}

function isAvifBuffer(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(4, 12).toString("ascii") === "ftypavif";
}

async function uploadWebpBufferToCloudinary(buffer: Buffer, wpUrl: string): Promise<string> {
  ensureConfig();
  const dataUri = `data:image/webp;base64,${buffer.toString("base64")}`;
  const res = await cloudinary.uploader.upload(dataUri, {
    public_id: `${publicIdFor(wpUrl)}-webp`,
    overwrite: false,
    resource_type: "image",
  });
  return res.secure_url;
}

async function uploadConvertedAvifToCloudinary(wpUrl: string): Promise<string | null> {
  if (avifFallbackImpl) return avifFallbackImpl(wpUrl);
  if (!isAvifUrl(wpUrl)) return null;

  const response = await fetch(wpUrl);
  if (!response.ok) return null;

  const input = Buffer.from(await response.arrayBuffer());
  if (!isAvifBuffer(input)) return null;

  const webp = await sharp(input).webp({ quality: 88 }).toBuffer();
  return uploadWebpBufferToCloudinary(webp, wpUrl);
}

function failureReason(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown; error?: { message?: unknown } }).message
      ?? (error as { error?: { message?: unknown } }).error?.message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}

function errorHttpCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { http_code?: unknown }).http_code;
  return typeof code === "number" ? code : null;
}

function isFatalCloudinaryError(error: unknown): boolean {
  const code = errorHttpCode(error);
  if (code === 401 || code === 403 || code === 420 || code === 429) return true;
  const reason = failureReason(error).toLowerCase();
  return /credential|api key|api secret|cloud name|signature|unauthorized|forbidden|invalid config|configuration/.test(reason);
}

function recordMediaFailure(wpUrl: string, motivo: string): void {
  failedThisRun.add(wpUrl);
  mediaReport.failures.push({ wpUrl, motivo });
}

async function uploadWithFallback(wpUrl: string): Promise<string> {
  try {
    const url = await uploadToCloudinary(wpUrl);
    mediaReport.migrated += 1;
    return url;
  } catch (firstError) {
    if (isFatalCloudinaryError(firstError)) throw firstError;
    try {
      const convertedAvifUrl = await uploadConvertedAvifToCloudinary(wpUrl);
      if (convertedAvifUrl) {
        mediaReport.migrated += 1;
        return convertedAvifUrl;
      }
    } catch (avifError) {
      if (isFatalCloudinaryError(avifError)) throw avifError;
    }
    const originalUrl = stripSizeSuffix(wpUrl);
    if (originalUrl !== wpUrl) {
      try {
        const url = await uploadToCloudinary(originalUrl);
        mediaReport.migrated += 1;
        return url;
      } catch (secondError) {
        if (isFatalCloudinaryError(secondError)) throw secondError;
        recordMediaFailure(wpUrl, `upload falhou; fallback original tambem falhou: ${failureReason(secondError)}`);
        return wpUrl;
      }
    }
    recordMediaFailure(wpUrl, `upload falhou: ${failureReason(firstError)}`);
    return wpUrl;
  }
}

/** Resolve uma URL WP -> Cloudinary (com cache media_map). Dry-run devolve a própria URL WP. */
export async function resolveMediaUrl(db: Db, wpUrl: string): Promise<string> {
  if (!wpUrl) return wpUrl;
  const cached = (await db.query<{ cloudinary_url: string }>(
    "SELECT cloudinary_url FROM media_map WHERE wp_url=$1",
    [wpUrl],
  )).rows[0];
  if (cached) return cached.cloudinary_url;
  if (!mediaMigrationEnabled()) return wpUrl; // dry-run (default): mantém URL WP, boot rápido
  if (failedThisRun.has(wpUrl)) return wpUrl;
  const url = await uploadWithFallback(wpUrl);
  if (url === wpUrl) return wpUrl;
  await db.query(
    "INSERT INTO media_map (wp_url, cloudinary_url) VALUES ($1,$2) ON CONFLICT (wp_url) DO UPDATE SET cloudinary_url=EXCLUDED.cloudinary_url",
    [wpUrl, url],
  );
  return url;
}

/** Constrói o mapa WP->Cloudinary p/ uma lista de URLs (featured + inline). */
export async function buildMediaMap(db: Db, urls: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const u of [...new Set(urls)].filter(Boolean)) {
    map.set(u, await resolveMediaUrl(db, u));
  }
  return map;
}

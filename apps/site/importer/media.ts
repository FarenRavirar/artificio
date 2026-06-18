// Migração de mídia WP -> Cloudinary (D025/R8). Env-gated:
//   - CLOUDINARY_URL (ou CLOUDINARY_CLOUD_NAME+API_KEY+API_SECRET) presente => upload + rewrite.
//   - ausente => dry-run: mantém URLs do WP (zero rede, zero credencial).
// Cloudinary regenera variantes; guardamos só o secure_url do original. Idempotente via media_map.
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { tmpdir } from "node:os";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "../db/connection.js";

let configured = false;

export interface MediaFailure {
  wpUrl: string;
  motivo: string;
}

export interface MediaReport {
  migrated: number;
  failures: MediaFailure[];
  pruned: string[];
}

const mediaReport: MediaReport = {
  migrated: 0,
  failures: [],
  pruned: [],
};

const failedThisRun = new Set<string>();

let uploadImpl: ((wpUrl: string) => Promise<string>) | null = null;
let avifFallbackImpl: ((wpUrl: string) => Promise<string | null>) | null = null;
let remoteFileImpl: ((wpUrl: string) => Promise<string | null>) | null = null;
let migTmpCounter = 0;

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
  mediaReport.pruned = [];
  failedThisRun.clear();
}

export function getMediaReport(): MediaReport {
  return {
    migrated: mediaReport.migrated,
    failures: [...mediaReport.failures],
    pruned: [...mediaReport.pruned],
  };
}

/** Registra URLs WP removidas/desembrulhadas do HTML (política D074: asset não migrado morre). */
export function recordPruned(urls: string[]): void {
  for (const u of urls) if (!mediaReport.pruned.includes(u)) mediaReport.pruned.push(u);
}

export function __setUploadForTest(upload: ((wpUrl: string) => Promise<string>) | null): void {
  uploadImpl = upload;
}

export function __setAvifFallbackForTest(upload: ((wpUrl: string) => Promise<string | null>) | null): void {
  avifFallbackImpl = upload;
}

export function __setRemoteFileForTest(upload: ((wpUrl: string) => Promise<string | null>) | null): void {
  remoteFileImpl = upload;
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

const WP_UPLOADS_RE = /\/wp-content\/uploads\//;

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

/**
 * Extrai TODA referência a /wp-content/uploads/ do HTML, não só <img>: cobre
 * <a href>, <audio|video src|poster>, <source src> e enclosures embutidas (D074).
 * Pega qualquer atributo href/src/poster apontando para uploads; buildMediaMap deduplica.
 */
export function extractMediaUrls(html: string): string[] {
  const out = new Set<string>();
  const re = /\b(?:href|src|poster)="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (WP_UPLOADS_RE.test(m[1])) out.add(m[1]);
  }
  return [...out];
}

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "tiff", "tif", "ico"]);
// Cloudinary trata áudio sob resource_type "video"; agrupamos áudio+vídeo aqui.
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "ogv", "ogg", "oga", "mp3", "wav", "m4a", "flac", "aac"]);

function urlExt(u: string): string {
  let path = u;
  try {
    path = new URL(u).pathname;
  } catch {
    path = u.split(/[?#]/)[0] ?? u;
  }
  return (path.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
}

/** resource_type do Cloudinary por extensão: image / video (inclui áudio) / raw (pdf/zip/doc...). */
export function mediaResourceType(u: string): "image" | "video" | "raw" {
  const ext = urlExt(u);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return "raw";
}

/**
 * Remove do HTML qualquer elemento que ainda referencie /wp-content/uploads/ (asset não migrado;
 * a origem WP morre ~2026-06-20, D074). <a> é desembrulhado (preserva o texto); mídia é removida.
 * Garante zero wp-content/uploads no HTML servido por construção. Retorna as URLs tocadas p/ relatório.
 */
export function pruneWpAssets(html: string): { html: string; removed: string[] } {
  const removed = new Set<string>();
  const mark = (u?: string): void => {
    if (u && WP_UPLOADS_RE.test(u)) removed.add(u);
  };
  let out = html;
  // 1) Players inteiros <audio>/<video> que referenciem WP (no src/poster ou <source> interno).
  out = out.replace(/<(audio|video)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => {
    if (!WP_UPLOADS_RE.test(block)) return block;
    for (const m of block.matchAll(/\b(?:src|poster)="([^"]+)"/gi)) mark(m[1]);
    return "";
  });
  // 2) <a href="...wp...">inner</a> -> inner (desembrulha; link morto vira texto).
  out = out.replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (whole, href: string, inner: string) => {
    if (!WP_UPLOADS_RE.test(href)) return whole;
    mark(href);
    return inner;
  });
  // 3) <source> e <img> remanescentes apontando WP (inclui <img> exposto após desembrulhar <a>).
  out = out.replace(/<(?:source|img)\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/i)?.[1];
    if (src && WP_UPLOADS_RE.test(src)) {
      mark(src);
      return "";
    }
    return tag;
  });
  return { html: out, removed: [...removed] };
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
  const resourceType = mediaResourceType(wpUrl);
  const ext = urlExt(wpUrl);
  // raw mantém o arquivo cru => public_id precisa carregar a extensão p/ servir corretamente.
  const publicId = resourceType === "raw" && ext ? `${publicIdFor(wpUrl)}.${ext}` : publicIdFor(wpUrl);
  const res = await cloudinary.uploader.upload(wpUrl, {
    public_id: publicId,
    overwrite: false,
    resource_type: resourceType,
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

// Cloudinary aceita upload por data-URI base64; acima disto evitamos montar uma string
// gigante e o asset cai no caminho de falha (relatado; tratado pela política de remoção do
// HTML na finalização, já que a origem WP vai sair do ar). Capas do blog ficam muito abaixo
// — guarda só defensiva.
const MAX_WEBP_DATAURI_BYTES = 10 * 1024 * 1024;

async function uploadConvertedAvifToCloudinary(wpUrl: string): Promise<string | null> {
  if (avifFallbackImpl) return avifFallbackImpl(wpUrl);
  if (!isAvifUrl(wpUrl)) return null;

  // fetch + decode + sharp são locais (não-Cloudinary): falha aqui => não é o caminho AVIF,
  // devolve null e segue o fallback normal. O upload fica FORA deste try p/ que erro fatal
  // do Cloudinary continue propagando para isFatalCloudinaryError upstream.
  let webp: Buffer;
  try {
    const response = await fetch(wpUrl);
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    if (!isAvifBuffer(input)) return null;
    webp = await sharp(input).webp({ quality: 88 }).toBuffer();
  } catch {
    return null;
  }
  if (webp.length > MAX_WEBP_DATAURI_BYTES) return null;
  return uploadWebpBufferToCloudinary(webp, wpUrl);
}

// Limite defensivo p/ o resgate por bytes (vídeo). Os assets reais do blog ficam bem abaixo
// (webm medido ~22MB); acima disto devolvemos null e o asset cai no caminho de poda.
const MAX_REMOTE_FILE_BYTES = 100 * 1024 * 1024;

// Resgate por bytes: o WP/Hostinger serve algumas mídias com content-type errado (text/plain), o que
// faz o fetch SERVER-SIDE da Cloudinary falhar (403/"Error in loading"); MAS o nosso fetch lê os bytes
// normalmente. Baixamos local, gravamos em arquivo temporário e subimos via path com o resource_type
// correto (image/video/raw). Provado end-to-end contra o webm real (22.6MB) antes de codar (D074).
// Upload fora do try de fetch p/ que erro fatal do Cloudinary continue propagando upstream.
async function uploadRemoteFileToCloudinary(wpUrl: string): Promise<string | null> {
  if (remoteFileImpl) return remoteFileImpl(wpUrl);
  let buf: Buffer;
  try {
    const response = await fetch(wpUrl);
    if (!response.ok) return null;
    buf = Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
  if (buf.length === 0 || buf.length > MAX_REMOTE_FILE_BYTES) return null;
  ensureConfig();
  const resourceType = mediaResourceType(wpUrl);
  const ext = urlExt(wpUrl);
  const publicId = resourceType === "raw" && ext ? `${publicIdFor(wpUrl)}.${ext}` : publicIdFor(wpUrl);
  const tmpPath = join(tmpdir(), `wpmig-${process.pid}-${migTmpCounter++}${ext ? `.${ext}` : ""}`);
  try {
    await writeFile(tmpPath, buf);
    const res = await cloudinary.uploader.upload(tmpPath, {
      public_id: publicId,
      overwrite: false,
      resource_type: resourceType,
    });
    return res.secure_url;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
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
  const reason = failureReason(error).toLowerCase();
  // "Error in loading <url> - 4xx/5xx" = Cloudinary não conseguiu BUSCAR o asset remoto no WP
  // (hotlink/403, 404 etc.). É falha POR-ASSET (migra-ou-poda, D074), não credencial nossa. Tem de
  // vir ANTES dos checks de auth: o "403/Forbidden" embutido no texto do asset não pode ser confundido
  // com 403 de credencial Cloudinary, senão um único asset bloqueado mata o lote inteiro.
  if (/error in loading/.test(reason)) return false;
  const code = errorHttpCode(error);
  if (code === 401 || code === 403 || code === 420 || code === 429) return true;
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
    // Derivado 404: tenta o original (strip -NxN) via fetch server-side da Cloudinary.
    const originalUrl = stripSizeSuffix(wpUrl);
    if (originalUrl !== wpUrl) {
      try {
        const url = await uploadToCloudinary(originalUrl);
        mediaReport.migrated += 1;
        return url;
      } catch (secondError) {
        if (isFatalCloudinaryError(secondError)) throw secondError;
        // não registra falha ainda: o resgate por bytes abaixo ainda pode salvar.
      }
    }
    // Resgate por bytes (MIME errado na origem): download local + upload via arquivo. Migra vídeo/
    // áudio/PDF/imagem que a Cloudinary não consegue buscar server-side mas que está vivo p/ nós.
    try {
      const rescued = await uploadRemoteFileToCloudinary(wpUrl);
      if (rescued) {
        mediaReport.migrated += 1;
        return rescued;
      }
    } catch (rescueError) {
      if (isFatalCloudinaryError(rescueError)) throw rescueError;
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

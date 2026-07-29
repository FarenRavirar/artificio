import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import ipaddr from "ipaddr.js";

let configured = false;

export interface MediaConfig {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface UploadBufferOpts {
  folder: string;
  publicId?: string;
  uploadPreset?: string;
  resourceType?: "image" | "video" | "raw" | "auto";
  overwrite?: boolean;
  transformation?: UploadApiOptions["transformation"];
}

export interface UploadFromUrlOpts {
  folder: string;
  uploadPreset?: string;
  maxBytes?: number;
  timeout?: number;
}

export interface DownloadPublicImageOpts {
  maxBytes?: number;
  timeout?: number;
  maxRedirects?: number;
  allowedMimeTypes?: readonly string[];
  allowAnyNonSvgImage?: boolean;
  userAgent?: string;
}

export interface DownloadedPublicImage {
  buffer: Buffer;
  contentType: string;
  sourceUrl: string;
}

export interface UploadResult {
  url: string;
  public_id: string;
  width: number | null;
  height: number | null;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function isPrivateIp(address: string): boolean {
  const normalizedAddress = address.startsWith("[") && address.endsWith("]")
    ? address.slice(1, -1)
    : address;
  try {
    // Achado de review PR #228: `ipaddr.process` normaliza IPv4-mapped IPv6
    // para IPv4; `range()` classifica também dotted-quad, NAT64, loopback,
    // link-local, ULA, multicast e blocos reservados sem parser manual parcial.
    return ipaddr.process(normalizedAddress).range() !== "unicast";
  } catch {
    return false;
  }
}

async function resolvePublicAddresses(hostname: string): Promise<LookupAddress[]> {
  const normalizedHostname = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  const ipVersion = isIP(normalizedHostname);
  if (ipVersion) {
    if (isPrivateIp(normalizedHostname)) throw new Error("URL privada não é permitida.");
    return [{ address: normalizedHostname, family: ipVersion }];
  }
  const records = await dnsLookup(normalizedHostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("URL privada não é permitida.");
  }
  return records;
}

async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Use uma URL HTTP ou HTTPS válida.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("URL local não é permitida.");
  }
  await resolvePublicAddresses(hostname);
  return parsed;
}

interface PublicImageRequest {
  response: http.IncomingMessage;
  clearDeadline: () => void;
}

async function requestPublicImage(url: URL, timeout: number, userAgent: string): Promise<PublicImageRequest> {
  const [record] = await resolvePublicAddresses(url.hostname);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: record.address,
      port: url.port ? Number(url.port) : undefined,
      path: `${url.pathname}${url.search}` || "/",
      timeout,
      headers: {
        accept: DEFAULT_IMAGE_MIME_TYPES.join(","),
        host: url.host,
        "user-agent": userAgent,
      },
    };
    let response: http.IncomingMessage | undefined;
    const timeoutError = () => new Error("Tempo esgotado ao baixar a imagem.");
    const request = url.protocol === "https:"
      ? https.get({ ...options, servername: url.hostname }, onResponse)
      : http.get(options, onResponse);
    const deadline = setTimeout(() => {
      const error = timeoutError();
      response?.destroy(error);
      request.destroy(error);
    }, timeout);
    const clearDeadline = () => clearTimeout(deadline);

    function onResponse(incoming: http.IncomingMessage) {
      response = incoming;
      resolve({ response: incoming, clearDeadline });
    }

    request.on("timeout", () => {
      const error = timeoutError();
      response?.destroy(error);
      request.destroy(error);
    });
    request.on("error", (error) => {
      clearDeadline();
      reject(error);
    });
  });
}

function takeRedirectLocation(response: http.IncomingMessage): string | null {
  const statusCode = response.statusCode ?? 0;
  if (statusCode < 300 || statusCode >= 400) return null;
  const location = response.headers.location;
  response.destroy();
  if (!location) throw new Error("Redirecionamento de imagem sem destino válido.");
  return location;
}

function validatePublicImageResponse(
  response: http.IncomingMessage,
  allowedMimeTypes: ReadonlySet<string>,
  allowAnyNonSvgImage: boolean,
  maxBytes: number,
): string {
  const statusCode = response.statusCode ?? 0;
  if (statusCode < 200 || statusCode >= 300) {
    response.destroy();
    throw new Error("Não foi possível baixar a imagem desse link.");
  }
  const contentType = response.headers["content-type"]?.split(";")[0]?.toLowerCase() ?? "";
  const isAllowedMimeType = allowAnyNonSvgImage
    ? contentType.startsWith("image/") && contentType !== "image/svg+xml"
    : allowedMimeTypes.has(contentType);
  if (!isAllowedMimeType) {
    response.destroy();
    throw new Error("O link informado não aponta para uma imagem JPG, PNG ou WEBP.");
  }
  const contentLength = Number(response.headers["content-length"] ?? "0");
  if (contentLength > maxBytes) {
    response.destroy();
    throw new Error(`Imagem excede limite de ${maxBytes} bytes.`);
  }
  return contentType;
}

async function collectPublicImageBuffer(response: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) {
      response.destroy();
      throw new Error(`Imagem excede limite de ${maxBytes} bytes.`);
    }
    chunks.push(buffer);
  }
  const buffer = Buffer.concat(chunks);
  // Achado de review PR #228 (CodeRabbit): resposta 200 com corpo vazio
  // passava adiante um Buffer de 0 byte; `uploadFromUrl` já rejeita esse
  // caso, então o downloader espelha o mesmo contrato para os chamadores.
  if (buffer.byteLength === 0) throw new Error("A imagem baixada está vazia.");
  return buffer;
}

export async function downloadPublicImage(
  rawUrl: string,
  opts: DownloadPublicImageOpts = {},
): Promise<DownloadedPublicImage> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowedMimeTypes = new Set(opts.allowedMimeTypes ?? DEFAULT_IMAGE_MIME_TYPES);
  const deadlineAt = Date.now() + timeout;
  let currentUrl = await assertPublicHttpUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const remainingTimeout = deadlineAt - Date.now();
    if (remainingTimeout <= 0) throw new Error("Tempo esgotado ao baixar a imagem.");
    const { response, clearDeadline } = await requestPublicImage(
      currentUrl,
      remainingTimeout,
      opts.userAgent ?? "ArtificioRPG/1.0 image-import",
    );
    try {
      const location = takeRedirectLocation(response);
      if (location) {
        currentUrl = await assertPublicHttpUrl(new URL(location, currentUrl).toString());
        continue;
      }
      // Achado real (review PR #228, Sonar): status/MIME/tamanho e coleta
      // ficam em unidades testáveis; loop mantém somente redirects/deadline.
      const contentType = validatePublicImageResponse(
        response,
        allowedMimeTypes,
        opts.allowAnyNonSvgImage ?? false,
        maxBytes,
      );
      const buffer = await collectPublicImageBuffer(response, maxBytes);
      return { buffer, contentType, sourceUrl: currentUrl.toString() };
    } finally {
      clearDeadline();
    }
  }
  throw new Error("O link da imagem redireciona muitas vezes.");
}

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
        upload_preset: opts.uploadPreset ?? undefined,
        resource_type: opts.resourceType ?? "image",
        overwrite: opts.overwrite ?? false,
        transformation: opts.transformation,
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

  // Achado de review PR #228: este caminho também recebe URL externa. Reusar
  // downloader público mantém bloqueio de esquema, DNS privado e redirects,
  // além do limite durante streaming. A opção preserva o contrato histórico
  // de aceitar qualquer image/* exceto SVG.
  const { buffer } = await downloadPublicImage(sourceUrl, {
    maxBytes,
    timeout,
    allowAnyNonSvgImage: true,
  });

  const publicId = createHash("sha256").update(buffer).digest("hex");
  return uploadBuffer(buffer, { folder: opts.folder, publicId, uploadPreset: opts.uploadPreset });
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

/**
 * Variante de {@link deleteAsset} que reporta sucesso real.
 * @returns `true` se o asset foi destruído ou já não existe (`not found`);
 *          `false` em falha de credencial/rede/API — o chamador deve preservar
 *          o public_id p/ retry (REV-019).
 */
export async function destroyAssetResult(
  publicId: string,
  opts?: { resourceType?: "image" | "video" | "raw" },
): Promise<boolean> {
  if (!publicId) return true;
  configure();
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: opts?.resourceType ?? "image" });
    const result = (res as { result?: string })?.result;
    return result === "ok" || result === "not found";
  } catch (err) {
    console.error("[@artificio/media] destroyAssetResult falhou:", publicId, String(err));
    return false;
  }
}

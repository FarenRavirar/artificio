// Migração de mídia WP -> Cloudinary (D025/R8). Env-gated:
//   - CLOUDINARY_URL (ou CLOUDINARY_CLOUD_NAME+API_KEY+API_SECRET) presente => upload + rewrite.
//   - ausente => dry-run: mantém URLs do WP (zero rede, zero credencial).
// Cloudinary regenera variantes; guardamos só o secure_url do original. Idempotente via media_map.
import { v2 as cloudinary } from "cloudinary";
import type { Db } from "../db/connection.js";

let configured = false;

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

async function uploadToCloudinary(wpUrl: string): Promise<string> {
  ensureConfig();
  const res = await cloudinary.uploader.upload(wpUrl, {
    public_id: publicIdFor(wpUrl),
    overwrite: false,
    resource_type: "image",
  });
  return res.secure_url;
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
  const url = await uploadToCloudinary(wpUrl);
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

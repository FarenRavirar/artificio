// Validação de convite WhatsApp + extração de og:image (logo do grupo/canal).
// Superfície hostil (input da comunidade): host allowlist estrita, timeout, sem seguir p/ outros hosts.
import type { GroupKind } from "../../db/types.js";

export interface ParsedInvite {
  url: string;
  kind: GroupKind;
}

/**
 * Aceita só convites oficiais do WhatsApp:
 *   - https://chat.whatsapp.com/<code>            → group
 *   - https://whatsapp.com/channel/<code>         → channel
 *   - https://www.whatsapp.com/channel/<code>     → channel
 * Devolve null se o host/forma não casar (rejeita qualquer outro destino).
 */
export function parseInviteUrl(raw: string): ParsedInvite | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();

  if (host === "chat.whatsapp.com") {
    const code = u.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    if (!/^[A-Za-z0-9]{8,40}$/.test(code)) return null;
    return { url: `https://chat.whatsapp.com/${code}`, kind: "group" };
  }
  if (host === "whatsapp.com" || host === "www.whatsapp.com") {
    const [seg, code = ""] = u.pathname.replace(/^\/+/, "").split("/");
    if (seg !== "channel" || !/^[A-Za-z0-9]{8,40}$/.test(code)) return null;
    return { url: `https://whatsapp.com/channel/${code}`, kind: "channel" };
  }
  return null;
}

const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i;
const OG_IMAGE_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i;

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Busca a página de convite e extrai a og:image. Convites do WhatsApp servem
 * og:image assinado/efêmero — por isso baixamos e subimos ao Cloudinary (não hotlink).
 * Devolve null se não achar (logo vira placeholder).
 */
export async function fetchOgImage(inviteUrl: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(inviteUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; ArtificioLinksBot/1.0)" },
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  // Defesa em profundidade: URL final pós-redirects deve continuar em host WhatsApp.
  // parseInviteUrl() já valida a URL de entrada (allowlist estrita), mas redirects
  // podem levar a outros destinos (ex.: servidor WhatsApp comprometido).
  try {
    const finalHost = new URL(res.url).hostname;
    if (!["chat.whatsapp.com", "whatsapp.com", "www.whatsapp.com"].includes(finalHost)) return null;
  } catch {
    return null;
  }
  const html = await res.text();
  const m = OG_IMAGE_RE.exec(html) ?? OG_IMAGE_RE_ALT.exec(html);
  const raw = m?.[1];
  if (!raw) return null;
  const url = decodeHtmlEntities(raw);
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

// Validação/sanitização de input da comunidade (superfície hostil). zod + sanitize-html.
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { parseInviteUrl } from "./og.js";

/** Remove TODO markup; mantém só texto. Colapsa espaços e corta tamanho. */
export function cleanText(raw: string, max: number): string {
  const stripped = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
  return stripped.replace(/\s+/g, " ").trim().slice(0, max);
}

export const SuggestSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().default(""),
  invite_url: z.string().min(10).max(200),
});

export interface ValidSuggestion {
  name: string;
  description: string | null;
  invite_url: string;
  kind: "group" | "channel";
}

/** Valida + sanitiza. Devolve erro legível (PT) ou o payload tipado. */
export function parseSuggestion(body: unknown):
  | { ok: false; error: string }
  | { ok: true; value: ValidSuggestion } {
  const parsed = SuggestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos. Informe nome (2–80) e um link de convite válido." };
  }
  const invite = parseInviteUrl(parsed.data.invite_url);
  if (!invite) {
    return { ok: false, error: "Link inválido. Use um convite chat.whatsapp.com ou whatsapp.com/channel." };
  }
  const name = cleanText(parsed.data.name, 80);
  if (name.length < 2) return { ok: false, error: "Nome inválido após sanitização." };
  const description = cleanText(parsed.data.description ?? "", 500);
  return {
    ok: true,
    value: { name, description: description || null, invite_url: invite.url, kind: invite.kind },
  };
}

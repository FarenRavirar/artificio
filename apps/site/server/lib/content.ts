// Helpers de autoria: slugify PT, slug único, excerpt. Reusa sanitize/toc do importador.
import { stripTags, withToc, readingTime } from "../../importer/sanitize.js";
import { cleanHtml } from "./sanitize-html.js";

export { stripTags, withToc, readingTime, cleanHtml };

/** Slugify PT-aware: acentos→ASCII, minúsculas, não-alfanumérico→`-`. */
export function slugify(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

/** Garante slug único: se `exists(base)`, tenta base-2, base-3... (ignora `exceptId` no caller). */
export async function uniqueSlug(base: string, exists: (s: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let n = 2; n < 1000; n++) {
    const cand = `${root}-${n}`;
    if (!(await exists(cand))) return cand;
  }
  return `${root}-${Date.now()}`;
}

/** Excerpt a partir do HTML: texto puro, corta em limite de palavra. */
export function excerptFromHtml(html: string, max = 160): string {
  const text = stripTags(html || "");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

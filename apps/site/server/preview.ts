// Preview de rascunho (D053): renderiza conteúdo no shell do artigo + CSS do design system.
// Dois modos: por id (lê do store) e STATELESS (renderiza o buffer atual do editor sem persistir —
// evita que "pré-visualizar" publique/rebuilde mudanças, achado de revisão).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { getPost } from "../db/repo/posts.js";
import { getPage } from "../db/repo/pages.js";
import { cleanHtml, withToc } from "./lib/content.js";

const require = createRequire(import.meta.url);

let cssCache: string | null = null;
function designCss(): string {
  if (cssCache != null) return cssCache;
  try { cssCache = readFileSync(require.resolve("@artificio/ui/styles.css"), "utf8"); }
  catch { cssCache = ""; }
  return cssCache;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Monta a página de preview (shell + CSS) a partir de título/status/HTML já confiável. */
export function renderPreviewShell(title: string, status: string, bodyHtml: string): string {
  const body = bodyHtml || "<p><em>(sem conteúdo)</em></p>";
  return `<!doctype html>
<html lang="pt-br" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>[PREVIEW] ${esc(title)}</title>
<style>${designCss()}</style>
<style>
  body { margin:0; }
  .preview-banner { background:#020740; color:#fff; padding:8px 16px; font:600 13px/1.4 system-ui,sans-serif; position:sticky; top:0; z-index:10; }
  .preview-banner b { color:var(--artificio-brand); }
  .preview-article { max-width:72ch; margin:0 auto; padding:32px 20px 80px; }
  .preview-article h1 { font-size:2rem; line-height:1.2; margin:0 0 24px; }
  .preview-article img { max-width:100%; height:auto; }
  .preview-article :is(h2,h3) { margin-top:1.6em; }
  .preview-article p, .preview-article li { line-height:1.7; }
  .preview-article pre { overflow:auto; padding:16px; border-radius:8px; background:#0f1014; color:#eee; }
</style>
</head>
<body>
  <div class="preview-banner">PREVIEW — <b>${esc(status)}</b> · não publicado · não indexável</div>
  <article class="preview-article"><h1>${esc(title)}</h1>${body}</article>
</body>
</html>`;
}

/** Preview a partir do store (por id). */
export async function renderPreview(type: "post" | "page", id: number): Promise<string | null> {
  const row = type === "page" ? await getPage(id) : await getPost(id);
  if (!row) return null;
  const r = row as { title: string; status: string; content_html: string };
  return renderPreviewShell(r.title, r.status, r.content_html);
}

/** Preview STATELESS: sanitiza o HTML do editor e renderiza sem tocar no store. */
export function renderPreviewFromContent(title: string, status: string, rawHtml: string): string {
  const { html } = withToc(cleanHtml(rawHtml || ""));
  return renderPreviewShell(title || "Sem título", status || "rascunho", html);
}

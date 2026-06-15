// Prep DEV: normaliza fixtures reais do WP (REST) -> src/data/posts.json (slim).
// Fonte temporária = protótipo (site-proto). No build real, isto vira o Content Layer
// loader que lê o store Postgres (D005/D048). Rodar: pnpm --filter @artificio/site prep
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.WP_FIXTURES || "C:/projetos/site-proto/fixtures.json";
const OUT = resolve(__dirname, "../src/data/posts.json");

const decode = (s = "") =>
  s
    .replace(/&amp;/g, "&").replace(/&#038;/g, "&").replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘").replace(/&#8220;/g, "“").replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–").replace(/&#8212;/g, "—").replace(/&#8230;/g, "…")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8594;/g, "→");

function sanitize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "")
    .replace(/ on[a-z]+='[^']*'/gi, "")
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "<!-- iframe removido (allowlist) -->");
}

const stripTags = (h) => decode(h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const readingTime = (h) => Math.max(1, Math.round(stripTags(h).split(" ").length / 200));
const fmtDate = (iso) => {
  const d = new Date(iso.includes("/") ? iso.replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2") : iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

function withToc(html) {
  const toc = [];
  let i = 0;
  const out = html.replace(/<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    const text = stripTags(inner);
    const id = "sec-" + (i++) + "-" + text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    toc.push({ id, text, level: tag === "h2" ? 2 : 3 });
    return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
  });
  return { html: out, toc };
}

function terms(p) {
  const groups = p._embedded?.["wp:term"] || [];
  const cats = [], tags = [];
  for (const g of groups) for (const t of g || []) {
    if (t.taxonomy === "category" && t.slug !== "blog") cats.push({ name: decode(t.name), slug: t.slug });
    if (t.taxonomy === "post_tag") tags.push({ name: decode(t.name), slug: t.slug });
  }
  return { cats, tags };
}
const featured = (p) => p._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "";

const raw = JSON.parse(readFileSync(SRC, "utf8"));
const posts = raw.map((p) => {
  const { cats, tags } = terms(p);
  const { html, toc } = withToc(sanitize(p.content.rendered));
  return {
    id: p.id,
    slug: p.slug,
    title: decode(p.title.rendered),
    excerpt: stripTags(p.excerpt.rendered).slice(0, 200),
    contentHtml: html,
    toc,
    date: p.date,
    dateFmt: fmtDate(p.date),
    readingTime: readingTime(p.content.rendered),
    image: featured(p),
    cats,
    tags,
    seo: { description: p.yoast_head_json?.description || stripTags(p.excerpt.rendered).slice(0, 160) },
  };
}).sort((a, b) => new Date(b.date) - new Date(a.date));

mkdirSync(resolve(__dirname, "../src/data"), { recursive: true });
writeFileSync(OUT, JSON.stringify(posts, null, 2));
console.log(`wrote ${posts.length} posts -> ${OUT}`);

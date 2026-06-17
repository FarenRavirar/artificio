// Inventario read-only das imagens usadas pelo site. Nao toca DB, Cloudinary ou WP write.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchAll } from "./wp";
import { extractImageUrls, stripSizeSuffix } from "./media";
import { PAGES_ALLOW } from "./pages";
import { sanitize } from "./sanitize";

interface WpRendered {
  rendered: string;
}

interface WpMedia {
  source_url: string;
}

interface WpPost {
  id: number;
  slug: string;
  content: WpRendered;
  _embedded?: { "wp:featuredmedia"?: WpMedia[] };
}

interface WpPage {
  id: number;
  slug: string;
  content: WpRendered;
}

interface InventorySource {
  kind: "post" | "page";
  id: number;
  slug: string;
  field: "featured" | "content";
}

interface StatusResult {
  status: number | null;
  method: "HEAD" | "GET" | "ERROR";
  ok: boolean;
  error?: string;
}

interface InventoryItem {
  url: string;
  status: number | null;
  method: StatusResult["method"];
  ok: boolean;
  error?: string;
  isDerivado: boolean;
  urlOriginal: string;
  originalStatus?: number | null;
  originalOk?: boolean;
  sources: InventorySource[];
}

const DERIVED_RE = /-\d+x\d+\.[a-z0-9]+$/i;

function isDerived(url: string): boolean {
  try {
    return DERIVED_RE.test(new URL(url).pathname);
  } catch {
    return DERIVED_RE.test(url.split("?")[0] ?? url);
  }
}

async function checkUrl(url: string): Promise<StatusResult> {
  try {
    const head = await fetchWithTimeout(url, "HEAD");
    if (head.ok) return { status: head.status, method: "HEAD", ok: true };
    const get = await fetchWithTimeout(url, "GET");
    return { status: get.status, method: "GET", ok: get.ok };
  } catch (error) {
    return {
      status: null,
      method: "ERROR",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchWithTimeout(url: string, method: "HEAD" | "GET"): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { method, redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function addUrl(map: Map<string, InventorySource[]>, url: string | null | undefined, source: InventorySource): void {
  if (!url || !/\/wp-content\//.test(url)) return;
  const sources = map.get(url) ?? [];
  sources.push(source);
  map.set(url, sources);
}

async function main(): Promise<void> {
  const urls = new Map<string, InventorySource[]>();
  const posts = await fetchAll<WpPost>(
    "posts?_embed=wp:featuredmedia&_fields=id,slug,content,_embedded,_links",
  );
  if (!Array.isArray(posts)) throw new Error("WP posts payload invalido");
  for (const post of posts) {
    addUrl(urls, post._embedded?.["wp:featuredmedia"]?.[0]?.source_url, {
      kind: "post",
      id: post.id,
      slug: post.slug,
      field: "featured",
    });
    const html = post.content?.rendered;
    if (typeof html === "string") {
      for (const url of extractImageUrls(sanitize(html))) {
        addUrl(urls, url, { kind: "post", id: post.id, slug: post.slug, field: "content" });
      }
    }
  }

  const pages = await fetchAll<WpPage>("pages?_fields=id,slug,content&per_page=100");
  if (!Array.isArray(pages)) throw new Error("WP pages payload invalido");
  for (const page of pages) {
    if (typeof page.slug !== "string" || !PAGES_ALLOW.has(page.slug)) continue;
    const html = page.content?.rendered;
    if (typeof html === "string") {
      for (const url of extractImageUrls(sanitize(html))) {
        addUrl(urls, url, { kind: "page", id: page.id, slug: page.slug, field: "content" });
      }
    }
  }

  const items: InventoryItem[] = [];
  let index = 0;
  for (const [url, sources] of urls) {
    index += 1;
    const status = await checkUrl(url);
    const urlOriginal = stripSizeSuffix(url);
    const item: InventoryItem = {
      url,
      status: status.status,
      method: status.method,
      ok: status.ok,
      error: status.error,
      isDerivado: isDerived(url),
      urlOriginal,
      sources,
    };
    if (item.status === 404 && item.isDerivado && urlOriginal !== url) {
      const original = await checkUrl(urlOriginal);
      item.originalStatus = original.status;
      item.originalOk = original.ok;
    }
    items.push(item);
    if (index % 25 === 0) {
      console.log(`[inventory] ${index}/${urls.size}`);
    }
  }

  const summary = {
    total: items.length,
    status200: items.filter((item) => item.status === 200).length,
    status404: items.filter((item) => item.status === 404).length,
    outros: items.filter((item) => item.status !== 200 && item.status !== 404).length,
    derivados404ComOriginal200: items.filter((item) => item.status === 404 && item.originalStatus === 200).length,
  };
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "WP REST read-only",
    summary,
    items,
  };
  const dir = join(process.cwd(), "..", "..", "artifacts", "cloudinary");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `inventory-${stamp}.json`);
  await writeFile(file, JSON.stringify(payload, null, 2), "utf8");

  console.log("\n=== INVENTARIO CLOUDINARY ===");
  console.log(`total=${summary.total}`);
  console.log(`status200=${summary.status200}`);
  console.log(`status404=${summary.status404}`);
  console.log(`outros=${summary.outros}`);
  console.log(`derivados404ComOriginal200=${summary.derivados404ComOriginal200}`);
  console.log(`artifact=${file}`);
  console.log("=============================\n");
}

main().catch((error) => {
  console.error("[inventory] ERRO:", error);
  process.exit(1);
});

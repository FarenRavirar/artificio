import type { APIContext } from "astro";
import { robotsTxt } from "@artificio/content";
import { BRAND_ORIGIN } from "@artificio/ui/static";

export function GET(context: APIContext) {
  const sitemap = new URL("/sitemap-index.xml", context.site ?? BRAND_ORIGIN).href;
  return new Response(robotsTxt({ sitemap }), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

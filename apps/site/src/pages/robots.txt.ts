import type { APIContext } from "astro";
import { robotsTxt } from "@artificio/content";

// robots.txt servido no host vivo (beta agora). Sitemap aponta p/ o sitemap-index do @astrojs/sitemap.
export function GET(context: APIContext) {
  const sitemap = new URL("/sitemap-index.xml", context.site ?? "https://beta.artificiorpg.com").href;
  return new Response(robotsTxt({ sitemap }), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

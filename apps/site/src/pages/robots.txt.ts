import type { APIContext } from "astro";
import { robotsTxt } from "@artificio/content";
import { BRAND_ORIGIN } from "@artificio/ui/static";

export function GET(context: APIContext) {
  // Ambiente não-público (beta) não distribui SEO (achado do mantenedor, PR #271).
  //
  // `SITE_NOINDEX` já existia, mas só ligava o header `X-Robots-Tag` em runtime
  // (`server/server.ts:53`). O header impede a indexação do beta; ele NÃO impede que o beta
  // publique um `robots.txt` com `Allow: /` e um `Sitemap:` apontando para o próprio domínio,
  // que é convite explícito a rastrear. Um crawler que ignore o header ainda encontra o mapa
  // completo do site — e conteúdo duplicado entre beta e produção é regressão de SEO, que o
  // AGENTS.md trata como inegociável.
  //
  // Lido em build-time porque este endpoint é pré-renderizado no SSG: o valor precisa estar no
  // ambiente do `docker build` (ver `ARG SITE_NOINDEX` no Dockerfile), não só no `environment`
  // do compose, que é runtime e não alcança o build.
  if (import.meta.env.SITE_NOINDEX === "true") {
    return new Response(robotsTxt({ disallow: ["/"] }), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const sitemap = new URL("/sitemap-index.xml", context.site ?? BRAND_ORIGIN).href;
  return new Response(robotsTxt({ sitemap }), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

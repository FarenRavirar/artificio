// @ts-check
import { readFileSync } from "node:fs";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { buildLastmodIndex, serializeWithLastmod } from "./src/lib/sitemap-lastmod.ts";

// Site público (blog) — SSG. Domínio via PUBLIC_SITE_URL (env) p/ beta/prod distintos (spec 030 R11).

// Ambiente não-público não gera sitemap (achado do mantenedor, PR #271).
//
// `SITE_NOINDEX` cobria só o header `X-Robots-Tag` em runtime, e o `robots.txt` passou a emitir
// `Disallow: /` na mesma PR. Faltava o próprio arquivo: o sitemap continuava sendo GERADO e ficava
// acessível em `/sitemap-0.xml` mesmo sem estar referenciado, listando as URLs de beta para quem
// (ou o que) fosse direto nele. Um sitemap é um convite explícito a rastrear; beta não emite.
const noindex = process.env.SITE_NOINDEX === "true";

// <lastmod> a partir da data REAL de edicao do post (posts.updated_at -> posts.json), nunca da
// data do build (spec 102 T3.4). URL sem data propria — home, /blog/, taxonomias — fica sem o
// campo: lastmod inventado ou uniforme e ignorado pelo Google, e queima a confianca no sitemap.
// Le o snapshot direto, sem passar por src/lib/content.ts: aquele modulo importa assets
// (@artificio/ui/static -> _logo.png) e o astro.config roda FORA do pipeline do Vite, onde .png
// nao tem loader — medido: "Unable to load your Astro config / Unknown file extension .png".
const posts = JSON.parse(readFileSync(new URL("./src/data/posts.json", import.meta.url), "utf8"));
const lastmodIndex = buildLastmodIndex(posts);

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://artificiorpg.com",
  trailingSlash: "always",
  integrations: noindex
    ? [react()]
    : [sitemap({ serialize: (item) => serializeWithLastmod(item, lastmodIndex) }), react()],
  // Site sem markdown — desabilita syntax highlighting (remove warning CSP/Shiki)
  markdown: { syntaxHighlight: false },
  vite: {
    plugins: [tailwindcss()],
    build: {
      assetsInlineLimit: 0,
    },
  },
  security: {
    csp: {
      // Astro 6 CSP nativa: gera hashes SHA-256 p/ <script is:inline> + <style>.
      // Emite <meta http-equiv="content-security-policy"> no <head> de cada pagina.
      // Funciona em SSG (static) sem adapter — o meta tag vai no HTML gerado.
      directives: [
        "default-src 'self'",
        // *.googleusercontent.com: avatar do usuário logado via SSO Google (ex.: lh3.googleusercontent.com).
        "img-src 'self' data: https://res.cloudinary.com https://*.googleusercontent.com",
        "media-src 'self' https://res.cloudinary.com",
        // cloudflareinsights.com: beacon do Cloudflare Web Analytics (RUM) envia métricas via fetch.
        "connect-src 'self' https://accounts.artificiorpg.com https://www.google-analytics.com https://cloudflareinsights.com",
      ],
      scriptDirective: {
        // 'wasm-unsafe-eval': Pagefind (busca do nav) compila WebAssembly; sem isso o CSP bloqueia o WASM e a busca não funciona.
        // static.cloudflareinsights.com: loader do beacon (Cloudflare Web Analytics) injetado na borda.
        resources: ["'self'", "'wasm-unsafe-eval'", "https://www.googletagmanager.com", "https://static.cloudflareinsights.com"],
        // Astro 6 CSP só hasheia scripts que ele bundla (ver config.d.ts §securitycsp); `<script is:inline>` NÃO é hasheado.
        // Scripts que PRECISAM rodar inline no <head> (anti-FOUC + captura cedo de console/rede) ficam is:inline e
        // entram aqui manualmente. ATENÇÃO: se o conteúdo do script mudar, recalcular o hash (build + sha256 do inline) ou o CSP bloqueia.
        hashes: [
          "sha256-XPzs67qDe4wfXBJOkiFab5K9HDAPbNuLZRmMl1tKUho=", // Base.astro: tema (anti-FOUC, lê cookie/localStorage)
          "sha256-mySq/x1/tQ7F3zrM6N4ZGUNWaqt/Tsbz5v1uDvSJRUs=", // Base.astro: diagnóstico do feedback (Spec 021, captura cedo)
        ],
      },
      styleDirective: {
        resources: ["'self'"],
      },
    },
  },
});

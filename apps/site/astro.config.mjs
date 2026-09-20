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
    : [
        sitemap({
          // `/busca/` fora do sitemap (T7.7, spec 102). Busca interna não é conteúdo, e a
          // doc do Google manda mantê-la fora do índice. A página leva `noindex`
          // (`pages/busca/index.astro`); sem tirá-la daqui o site emitiria sinal
          // contraditório — o sitemap convidando a rastrear o que a meta nega.
          //
          // `filter` e não remoção da página: a busca continua existindo e alcançável
          // pela lupa do header e pela home (T7.6). O que sai é o convite ao crawler.
          //
          // Compara com `URL.pathname`, não `includes("/busca/")`: um post cujo slug
          // contivesse esse trecho (`/blog/como-fazer-busca/`) sairia junto, calado.
          filter: (page) => new URL(page).pathname !== "/busca/",
          serialize: (item) => serializeWithLastmod(item, lastmodIndex),
        }),
        react(),
      ],
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
        // artificiorpg.com: as capas do acervo são URLs ABSOLUTAS do domínio de produção
        // (legado WordPress, `/wp-content/uploads/...`). Em prod `'self'` cobriria por acaso,
        // mas em `beta.` a origem é outra e a imagem é bloqueada — medido no preview com a
        // busca em `show-images`: 14 violações de `img-src`, uma por capa de resultado.
        // O `<img>` do corpo do post não expunha isso porque ninguém media o console da busca.
        //
        // ⚠️ A CSP libera o host, mas o ARQUIVO não existe: medido em 2026-09-19 com
        // cache-buster, 3 capas de `/wp-content/uploads/` devolvem 404 em produção, com o
        // HTML do post em 200. Não há `wp-content` no `dist` nem em `public/` — o WordPress
        // foi desligado e os arquivos não vieram. Liberar o host aqui é necessário e NÃO é
        // suficiente; não reinvestigar a CSP quando a capa não aparecer. Rastreado na
        // T2.5 da spec 103, bloqueada em decisão de produto (onde as capas passam a morar).
        "img-src 'self' data: https://artificiorpg.com https://res.cloudinary.com https://*.googleusercontent.com",
        "media-src 'self' https://res.cloudinary.com",
        // cloudflareinsights.com: beacon do Cloudflare Web Analytics (RUM) envia métricas via fetch.
        // analytics.google.com e www.google.com: o GA4 NÃO usa só `www.google-analytics.com`.
        // Ele espelha cada hit em `/g/collect` nesses dois hosts (medido em beta 2026-09-16:
        // 6 requisições recusadas no console, entre elas `en=page_view`, `en=view_search_results`
        // e `en=scroll`). Sem os três, o evento morre em silêncio: a página não quebra, nada
        // avisa, e o dado simplesmente não chega ao GA4 — em TODA rota, não só na busca.
        "connect-src 'self' https://accounts.artificiorpg.com https://www.google-analytics.com https://analytics.google.com https://www.google.com https://cloudflareinsights.com",
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

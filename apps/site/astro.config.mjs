// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Site público (blog) — SSG. Domínio via PUBLIC_SITE_URL (env) p/ beta/prod distintos (spec 030 R11).
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://artificiorpg.com",
  trailingSlash: "always",
  integrations: [sitemap(), react()],
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

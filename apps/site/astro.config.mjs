// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Site público (blog) — SSG. Domínio via PUBLIC_SITE_URL (env) p/ beta/prod distintos (spec 030 R11).
// Etapa 1: zero-JS (Header/Footer .astro reusando CSS @artificio/ui). Etapa 2: island React p/ session.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://artificiorpg.com",
  trailingSlash: "always", // preserva permalink WP `/blog/<slug>/` (D047)
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  security: {
    csp: {
      // Astro 6 CSP nativa: gera hashes SHA-256 p/ <script is:inline> + <style>.
      // Emite <meta http-equiv="content-security-policy"> no <head> de cada pagina.
      // Funciona em SSG (static) sem adapter — o meta tag vai no HTML gerado.
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://res.cloudinary.com",
        "connect-src 'self' https://accounts.artificiorpg.com https://www.google-analytics.com",
      ],
      scriptDirective: {
        resources: ["'self'", "https://www.googletagmanager.com"],
      },
    },
  },
});

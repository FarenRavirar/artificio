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
});

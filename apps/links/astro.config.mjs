// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// links.artificiorpg.com — hub de grupos de WhatsApp do Artifício RPG.
// SSG + ilhas React (lista comunitária / form / painel). Logos vêm do Cloudinary;
// ilhas chamam a API na mesma origem.
export default defineConfig({
  site: process.env.PUBLIC_LINKS_URL || "https://links.artificiorpg.com",
  trailingSlash: "ignore",
  // sitemap exclui /admin (noindex). Regex ancora /admin como segmento — não exclui /grupo/admin-rpg.
  integrations: [react(), sitemap({ filter: (page) => !/\/admin(?:\/|$)/.test(page) })],
  markdown: { syntaxHighlight: false },
  vite: {
    plugins: [tailwindcss()],
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        // logos dos grupos = Cloudinary (secure_url) + data: (placeholders inline)
        "img-src 'self' data: https://res.cloudinary.com",
        // ilhas falam com a própria API (mesma origem) + SSO (accounts.artificiorpg.com)
        "connect-src 'self' https://accounts.artificiorpg.com",
      ],
      styleDirective: {
        resources: ["'self'"],
      },
    },
  },
});

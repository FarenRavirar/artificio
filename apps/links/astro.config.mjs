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
    build: {
      assetsInlineLimit: 0,
    },
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
      scriptDirective: {
        resources: ["'self'"],
        // Astro 6 CSP só hasheia o que ele BUNDLA; `<script is:inline>` nunca entra.
        // Medido em produção em 2026-09-21: 5 scripts inline recusados, e com eles o
        // anti-FOUC do tema, o toggle da sidebar mobile, o banner de onboarding, o
        // gate +18 e o botão de voltar ao topo. Os quatro últimos deixaram de ser
        // inline; só o anti-FOUC precisa rodar antes da pintura, então entra por hash.
        hashes: [
          "sha256-0gPq+Lu9XIQYtJy3WkJ113qHqpjRCqOGgEA0Jgr7e9M=", // Base.astro: tema (anti-FOUC, lê cookie/localStorage)
        ],
      },
      styleDirective: {
        resources: ["'self'"],
      },
    },
  },
});

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
        // ilhas falam com a própria API (mesma origem) + SSO (accounts.artificiorpg.com).
        // cloudflareinsights.com: o beacon do Cloudflare Web Analytics envia as métricas
        // por fetch para lá — mesma regra do `site` (apps/site/astro.config.mjs).
        "connect-src 'self' https://accounts.artificiorpg.com https://cloudflareinsights.com",
      ],
      scriptDirective: {
        // static.cloudflareinsights.com: loader do beacon que a Cloudflare injeta na
        // borda (Web Analytics com `auto_install: true` na zona, medido via API em
        // 2026-09-23). Sem isto a CSP o barrava e o console de produção trazia a
        // violação (spec 103 T7.13); liberado por decisão do mantenedor.
        resources: ["'self'", "https://static.cloudflareinsights.com"],
        // Astro 6 CSP só hasheia o que ele BUNDLA; `<script is:inline>` nunca entra.
        // Medido em produção em 2026-09-21: 5 scripts inline recusados, e com eles o
        // anti-FOUC do tema, o toggle da sidebar mobile, o banner de onboarding, o
        // gate +18 e o botão de voltar ao topo. Os quatro últimos deixaram de ser
        // inline; só o anti-FOUC precisa rodar antes da pintura, então entra por hash.
        //
        // `resources: ["'self'"]` basta para os outros quatro, e isso foi MEDIDO no
        // `dist`, não deduzido: os quatro saem como arquivo externo em `_astro/*.js`
        // (`Base.astro_astro_type_script_index_{0,1}`, `Sidebar.astro_…`,
        // `index.astro_…`), que `'self'` cobre. A revisão da PR #330 levantou o risco
        // de o Astro inlinar algum deles e a CSP bloquear; varrido o `dist` inteiro,
        // há 53 scripts inline e ZERO sem hash — quando o Astro inlina algo que ele
        // bundlou, ele também gera o hash. O que fica de fora é só `is:inline`.
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

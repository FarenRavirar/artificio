// Ativos de marca Artifício RPG servidos como arquivos estáticos cacheáveis.
// Os PNGs ficam em src/ (junto a este módulo) e são copiados para dist/ no build.
// Cada app consumidor (Vite/Astro) resolve o import e gera URL com hash no nome.
// Fonte: midias/cropped-logo-header-site-azul.png e midias/_logo_neg.png (D038).

import { BRAND_NAME } from "@artificio/config";

import brandLogoNavyPng from "./_logo.png?url";
import brandLogoNegPng from "./_logo_neg.png?url";
import faviconV2Png from "./faviconV2.png?url";

export const brandLogoNavy = {
  // Wordmark "ARTIFÍCIO RPG" em navy — usar sobre superfícies claras.
  src: brandLogoNavyPng,
  width: 300,
  height: 100,
  alt: BRAND_NAME,
} as const;

// Favicon Artifício RPG (faviconV2 — ícone hexágono 16x16, 421 bytes).
// Fonte histórica: apps/mesas/frontend/public/faviconV2.png.
export const faviconV2 = {
  src: faviconV2Png,
  type: "image/png",
  width: 16,
  height: 16,
} as const;

// Upsert do <link rel="icon"> a partir da fonte única. Para apps SPA (Vite) que
// não renderizam o <head> via build: chamar no boot (main.tsx). Idempotente.
export function applyFavicon(doc: Document = document): void {
  let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = doc.createElement("link");
    link.rel = "icon";
    doc.head.appendChild(link);
  }
  link.type = faviconV2.type;
  link.href = faviconV2.src;
}

export const brandLogoNeg = {
  // Wordmark "ARTIFÍCIO RPG" negativo (branco) — usar sobre superfícies escuras
  // (header/footer dark, hero navy). Fonte: midias/_logo_neg.png (300x100).
  src: brandLogoNegPng,
  width: 300,
  height: 100,
  alt: BRAND_NAME,
} as const;

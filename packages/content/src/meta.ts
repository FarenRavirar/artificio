import type { MetaTag, SeoInput } from "./types.js";
import { SITE } from "./site.js";

/** Descritores de <meta> (name/property + content). O app mapeia p/ tags no <head>.
 *  Não inclui <title> nem <link rel="canonical"> — o app renderiza esses diretamente. */
export function buildMeta(input: SeoInput): MetaTag[] {
  const siteName = input.siteName ?? SITE.name;
  const locale = input.locale ?? SITE.locale;
  const ogTitle = input.ogTitle ?? input.title;
  const ogDesc = input.ogDescription ?? input.description;
  const tags: MetaTag[] = [
    { name: "description", content: input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: ogDesc },
    { property: "og:url", content: input.canonical },
    { property: "og:site_name", content: siteName },
    { property: "og:locale", content: locale.replace("-", "_") },
    { name: "twitter:card", content: input.twitterCard ?? (input.image ? "summary_large_image" : "summary") },
    { name: "twitter:title", content: ogTitle },
    { name: "twitter:description", content: ogDesc },
  ];
  if (input.noindex) tags.push({ name: "robots", content: "noindex,nofollow" });
  if (SITE.twitter) tags.push({ name: "twitter:site", content: SITE.twitter });
  if (input.image) {
    tags.push({ property: "og:image", content: input.image });
    tags.push({ name: "twitter:image", content: input.image });
  }
  return tags;
}

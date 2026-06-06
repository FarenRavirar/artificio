// @artificio/content — SEO técnico reusável (meta, JSON-LD, sitemap, robots). TS puro, zero deps.
export type { MetaTag, SeoInput, BreadcrumbItem, SitemapEntry, ArticleInput } from "./types.js";
export { SITE, canonicalUrl } from "./site.js";
export { buildMeta } from "./meta.js";
export { renderJsonLd, organizationLd, websiteLd, articleLd, breadcrumbLd } from "./jsonld.js";
export { sitemapXml } from "./sitemap.js";
export { robotsTxt, type RobotsOptions } from "./robots.js";

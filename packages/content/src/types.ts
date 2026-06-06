// Tipos do pacote de SEO (framework-agnóstico). Consumido por Astro (site) e React/Vite (mesas/glossário).

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface SeoInput {
  title: string;
  description: string;
  /** URL canônica absoluta (domínio final). */
  canonical: string;
  type?: "website" | "article";
  /** Imagem absoluta p/ OG/Twitter. */
  image?: string;
  siteName?: string;
  /** BCP-47, ex.: "pt-BR". */
  locale?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export interface ArticleInput {
  headline: string;
  url: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  authorName?: string;
  section?: string;
}

import type { ArticleInput, BreadcrumbItem } from "./types.js";
import { SITE } from "./site.js";

const CTX = "https://schema.org";

/** Serializa um objeto JSON-LD p/ o conteúdo de <script type="application/ld+json">. */
export function renderJsonLd(obj: object): string {
  return JSON.stringify(obj);
}

export function organizationLd(): object {
  return {
    "@context": CTX,
    "@type": "Organization",
    name: SITE.name,
    url: SITE.origin,
    logo: SITE.logo,
  };
}

export function websiteLd(searchUrlTemplate?: string): object {
  const base: Record<string, unknown> = {
    "@context": CTX,
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.origin,
    inLanguage: SITE.locale,
  };
  if (searchUrlTemplate) {
    base.potentialAction = {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: searchUrlTemplate },
      "query-input": "required name=search_term_string",
    };
  }
  return base;
}

export function articleLd(input: ArticleInput): object {
  return {
    "@context": CTX,
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    image: input.image ? [input.image] : undefined,
    author: { "@type": "Organization", name: input.authorName ?? SITE.name },
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: SITE.logo } },
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    articleSection: input.section,
  };
}

export function breadcrumbLd(items: BreadcrumbItem[]): object {
  return {
    "@context": CTX,
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

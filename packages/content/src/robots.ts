export interface RobotsOptions {
  /** URL absoluta do sitemap (ou sitemap-index). */
  sitemap?: string;
  /** Caminhos a bloquear (ex.: ["/admin", "/api"]). */
  disallow?: string[];
}

/** Gera robots.txt. Por padrão libera tudo + aponta o sitemap. */
export function robotsTxt(opts: RobotsOptions = {}): string {
  const lines = ["User-agent: *"];
  const disallow = opts.disallow ?? [];
  if (disallow.length === 0) {
    lines.push("Allow: /");
  } else {
    for (const d of disallow) lines.push(`Disallow: ${d}`);
  }
  if (opts.sitemap) {
    lines.push("");
    lines.push(`Sitemap: ${opts.sitemap}`);
  }
  return lines.join("\n") + "\n";
}

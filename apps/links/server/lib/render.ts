// SSR mínimo da página /grupo/<slug> para grupos recém-aprovados que ainda não
// existem no dist (pré-rebuild). SEO completo: title/description/canonical/OG/JSON-LD.
// Estilo mínimo inline para legibilidade; o CSS completo do Astro carrega no próximo rebuild.
import type { Group } from "../../db/types.js";

const SITE = process.env.PUBLIC_LINKS_URL || "https://links.artificiorpg.com";
const GSC = process.env.PUBLIC_GSC_VERIFICATION || "";

const h = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmt = (d: Date | string | null) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export function renderGroupPage(g: Group): string {
  const slug = g.slug ?? "";
  const title = `${g.name} · Grupo de WhatsApp · Artifício RPG`;
  const desc =
    g.description ??
    `Entre no grupo de WhatsApp ${g.name} da comunidade Artifício RPG.`;
  const canonical = `${SITE}/grupo/${slug}`;
  const ogImg = g.logo_url ?? `${SITE}/og-default.png`;
  const enviado = fmt(g.created_at);
  const aprovado = fmt(g.approved_at);
  const tagLabels = (g.tags ?? []).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: g.name,
    description: desc,
    ...(g.logo_url ? { logo: g.logo_url, image: g.logo_url } : {}),
    url: canonical,
    sameAs: [g.invite_url],
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(title)}</title>
<meta name="description" content="${h(desc)}">
<link rel="canonical" href="${h(canonical)}">
${GSC ? `<meta name="google-site-verification" content="${h(GSC)}">` : ""}
<meta property="og:site_name" content="Artifício RPG">
<meta property="og:title" content="${h(title)}">
<meta property="og:description" content="${h(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${h(canonical)}">
<meta property="og:image" content="${h(ogImg)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 1.5rem; background: #F4F6FB; color: #0B1220; }
  .breadcrumb { font-size: .875rem; color: #6B7280; margin-bottom: 1.5rem; }
  .breadcrumb a { color: #FF5722; text-decoration: none; }
  .group-head { display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 1rem; }
  .logo-lg { width: 128px; height: 128px; border-radius: 8px; object-fit: cover; background: #E5E7EB; }
  h1 { margin: 0 0 .5rem; font-size: 1.75rem; }
  .chips { display: flex; gap: .4rem; flex-wrap: wrap; margin-bottom: .75rem; }
  .chip { display: inline-block; padding: .15rem .6rem; border-radius: 6px; font-size: .8rem; background: #E5E7EB; }
  .chip-adult { background: #FEE2E2; color: #991B1B; font-weight: 600; }
  .cta-join { display: inline-block; padding: .6rem 1.5rem; background: #FF5722; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: .5rem; }
  .group-desc { line-height: 1.7; margin: 1rem 0; }
  .group-rules { margin: 1.5rem 0; padding: 1rem; background: #fff; border-radius: 8px; border: 1px solid #E5E7EB; }
  .group-rules h2 { font-size: 1.1rem; margin: 0 0 .5rem; }
  .group-meta { font-size: .8rem; color: #6B7280; margin-top: 1.5rem; display: flex; gap: 1.5rem; }
</style>
</head>
<body>
<nav class="breadcrumb">
  <a href="/">Início</a> ›
  <a href="/#cat-${h(g.category)}">Grupos</a> ›
  <span>${h(g.name)}</span>
</nav>
<article>
  <header class="group-head">
    <img class="logo-lg" src="${h(g.logo_url ?? "/placeholder.svg")}" alt="Logo do grupo ${h(g.name)}" width="128" height="128" loading="eager">
    <div>
      <h1>${h(g.name)}</h1>
      ${tagLabels.length > 0 || g.is_adult ? `<p class="chips">${g.is_adult ? '<span class="chip chip-adult">+18</span>' : ""}${tagLabels.map((t) => `<span class="chip">${h(t)}</span>`).join("")}</p>` : ""}
      <a class="cta-join" href="${h(g.invite_url)}" target="_blank" rel="noopener noreferrer">${g.kind === "channel" ? "Seguir canal" : "Entrar no grupo"}</a>
    </div>
  </header>
  ${g.description ? `<p class="group-desc">${h(g.description)}</p>` : ""}
  ${g.rules ? `<section class="group-rules"><h2>Regras do grupo</h2><p>${h(g.rules)}</p></section>` : ""}
  ${enviado || aprovado ? `<footer class="group-meta">${enviado ? `<span>Enviado em ${enviado}</span>` : ""}${aprovado ? `<span>Aprovado em ${aprovado}</span>` : ""}</footer>` : ""}
</article>
</body>
</html>`;
}

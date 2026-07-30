import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { Router, type Request, type Response } from 'express';
import { buildMeta, type MetaTag } from '@artificio/content';
import { findPublishedMaterialBySlug, type PublicMaterial } from '../services/publicMaterial';

const router = Router();
const SITE_NAME = 'Artifício Downloads';
const SITE_ORIGIN = process.env.PUBLIC_SITE_URL || 'https://downloads.artificiorpg.com';
const INDEX_HTML_PATH = process.env.INDEX_HTML_PATH || '/app/frontend-dist/index.html';
const INDEX_CACHE_TTL_MS = 60_000;
const SHELL_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

interface CachedIndex {
  html: string;
  loadedAt: number;
  mtimeMs: number;
}

let cachedIndex: CachedIndex | null = null;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeDescription(value: string | null | undefined, fallback: string): string {
  const normalized = value?.replace(/\s+/g, ' ').trim() || fallback;
  return normalized.length <= 200 ? normalized : `${normalized.slice(0, 199).trimEnd()}…`;
}

function publicHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

async function loadIndexHtml(): Promise<CachedIndex> {
  const now = Date.now();
  if (cachedIndex && now - cachedIndex.loadedAt < INDEX_CACHE_TTL_MS) return cachedIndex;

  const [html, fileStat] = await Promise.all([
    readFile(INDEX_HTML_PATH, 'utf8'),
    stat(INDEX_HTML_PATH),
  ]);
  cachedIndex = { html, loadedAt: now, mtimeMs: fileStat.mtimeMs };
  return cachedIndex;
}

function renderMetaTag(tag: MetaTag): string {
  const key = tag.name ? `name="${escapeHtml(tag.name)}"` : `property="${escapeHtml(tag.property || '')}"`;
  return `<meta ${key} content="${escapeHtml(tag.content)}">`;
}

function stripSingularSeoTags(html: string): string {
  return html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bname=["'](?:description|robots|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>/gi, '');
}

function injectHead(html: string, block: string): string {
  const stripped = stripSingularSeoTags(html);
  if (!/<\/head>/i.test(stripped)) throw new Error('frontend_index_missing_head');
  return stripped.replace(/<\/head>/i, `${block}\n  </head>`);
}

function buildMaterialHead(material: PublicMaterial): { block: string; isFallbackImage: boolean } {
  const canonical = `${SITE_ORIGIN}/materiais/${encodeURIComponent(material.slug)}`;
  const title = `${material.title} | ${SITE_NAME}`;
  const description = normalizeDescription(
    material.summary,
    `Material gratuito de RPG em português: ${material.title}.`,
  );
  const cover = publicHttpUrl(material.cover_image_url);
  const image = cover || `${SITE_ORIGIN}/og-default.png`;
  const imageAlt = `${material.title} — capa do material`;
  const tags = buildMeta({
    title,
    description,
    canonical,
    type: 'website',
    image,
    siteName: SITE_NAME,
    locale: 'pt-BR',
    noindex: process.env.APP_ENV === 'beta',
  });
  const extraTags = [
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">`,
    ...(cover ? [] : [
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
    ]),
  ];
  const block = [
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    ...tags.map(renderMetaTag),
    ...extraTags,
  ].map((line) => `    ${line}`).join('\n');
  return { block, isFallbackImage: !cover };
}

function buildErrorHead(title: string, canonical: string): string {
  const tags = buildMeta({
    title,
    description: 'Conteúdo indisponível.',
    canonical,
    type: 'website',
    siteName: SITE_NAME,
    locale: 'pt-BR',
    noindex: true,
  });
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    ...tags.map(renderMetaTag),
  ].map((line) => `    ${line}`).join('\n');
}

function responseModifiedAt(material: PublicMaterial, indexMtimeMs: number): Date {
  const materialMs = new Date(material.updated_at).getTime();
  return new Date(Math.max(Number.isFinite(materialMs) ? materialMs : 0, indexMtimeMs));
}

async function materialShell(req: Request, res: Response): Promise<Response | void> {
  const canonical = `${SITE_ORIGIN}/materiais/${encodeURIComponent(req.params.slug)}`;
  try {
    const [index, material] = await Promise.all([
      loadIndexHtml(),
      findPublishedMaterialBySlug(req.params.slug),
    ]);

    if (!material) {
      const html = injectHead(index.html, buildErrorHead(`Material não encontrado | ${SITE_NAME}`, canonical));
      return res.status(404)
        .set('Cache-Control', 'no-store')
        .set('X-Robots-Tag', 'noindex, nofollow')
        .type('html')
        .send(html);
    }

    const { block } = buildMaterialHead(material);
    const html = injectHead(index.html, block);
    const etag = `"${createHash('sha256').update(html).digest('base64url')}"`;
    const modifiedAt = responseModifiedAt(material, index.mtimeMs);

    res.set('Cache-Control', SHELL_CACHE_CONTROL)
      .set('ETag', etag)
      .set('Last-Modified', modifiedAt.toUTCString());

    if (req.header('if-none-match') === etag) return res.status(304).end();
    return res.status(200).type('html').send(html);
  } catch (error: unknown) {
    console.error('[public-shell] falha ao renderizar material', { slug: req.params.slug }, error);
    res.status(503)
      .set('Retry-After', '60')
      .set('Cache-Control', 'no-store')
      .set('X-Robots-Tag', 'noindex, nofollow');
    try {
      const index = await loadIndexHtml();
      const html = injectHead(index.html, buildErrorHead(`Serviço indisponível | ${SITE_NAME}`, canonical));
      return res.type('html').send(html);
    } catch {
      return res.type('text').send('Serviço temporariamente indisponível.');
    }
  }
}

router.get('/materiais/:slug', materialShell);

export default router;
export const publicShellInternals = {
  buildMaterialHead,
  injectHead,
  stripSingularSeoTags,
};

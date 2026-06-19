import { Router, Request, Response } from 'express';
import { readFile } from 'fs/promises';
import { sql } from 'kysely';
import { db } from '../db';
import { upgradeGoogleImageQuality } from '../utils/urlValidation';

const router = Router();

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mesas.artificiorpg.com';
const SITE_NAME = 'Artifício Mesas';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
const INDEX_HTML_PATH = process.env.INDEX_HTML_PATH || '/app/frontend-dist/index.html';

let cachedIndexHtml: string | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

async function loadIndexHtml(): Promise<string> {
  const now = Date.now();
  if (cachedIndexHtml && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedIndexHtml;
  }

  const raw = await readFile(INDEX_HTML_PATH, 'utf-8');
  cachedIndexHtml = raw;
  cacheLoadedAt = now;
  return raw;
}

function escapeHtml(input: string | null | undefined): string {
  if (!input) return '';

  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(input: string | null | undefined, max: number): string {
  if (!input) return '';

  const cleaned = input.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

interface MetaFields {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
  ogType: 'website' | 'profile';
  extraProfile?: Record<string, string>;
}

function injectMetaTags(html: string, meta: MetaFields): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const imageUrl = escapeHtml(meta.imageUrl);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);

  let profileExtra = '';
  if (meta.extraProfile) {
    for (const [key, value] of Object.entries(meta.extraProfile)) {
      profileExtra += `\n    <meta property="${escapeHtml(key)}" content="${escapeHtml(value)}">`;
    }
  }

  const metaBlock = `
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="${meta.ogType}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
    <meta property="og:locale" content="pt_BR">${profileExtra}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
  `.trim();

  // Remove meta tags OG/Twitter duplicadas do index.html
  let output = html
    .replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?\s*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?\s*>/gi, '')
    .replace(/<!--\s*Open Graph fallback[\s\S]*?-->/gi, '')
    .replace(/<!--\s*Twitter Card fallback[\s\S]*?-->/gi, '');

  // Substitui o <title> pelas novas meta tags
  output = output.replace(/<title>[\s\S]*?<\/title>/i, metaBlock);

  if (output === html) {
    output = html.replace('</head>', `${metaBlock}\n  </head>`);
  }

  return output;
}

function getFallbackMeta(pathname = '/'): MetaFields {
  return {
    title: 'Artifício Mesas — Encontre sua próxima aventura de RPG',
    description:
      'Plataforma gratuita para encontrar mesas de RPG. Descubra mestres e aventuras de D&D, Pathfinder e outros sistemas.',
    imageUrl: DEFAULT_OG_IMAGE,
    canonicalUrl: `${SITE_URL}${pathname}`,
    ogType: 'website',
  };
}

router.get('/:type/:slug', async (req: Request, res: Response) => {
  const { type, slug } = req.params;

  try {
    const html = await loadIndexHtml();

    // Switch para diferentes tipos de entidades
    switch (type) {
      case 'mestre': {
        const gm = await db
          .selectFrom('gm_profiles as gm')
          .innerJoin('users as u', 'u.id', 'gm.user_id')
          .innerJoin('profiles as p', 'p.user_id', 'u.id')
          .select([
            sql<string>`COALESCE(gm.nickname, p.display_name)`.as('display_name'),
            'gm.bio_long',
            'gm.tagline',
            sql<string>`COALESCE(gm.avatar_url, p.avatar_url)`.as('avatar_url'),
            'gm.banner_url',
            'gm.slug',
          ])
          .where('gm.slug', '=', slug)
          .executeTakeFirst();

        if (!gm) {
          const htmlNotFound = injectMetaTags(html, {
            ...getFallbackMeta(`/mestre/${slug}`),
            title: 'Mestre não encontrado — Artifício Mesas',
          });

          return res.status(200).type('html').send(htmlNotFound);
        }

        const displayName = gm.display_name || 'Mestre de RPG';
        const title = `${displayName} — Mestre de RPG | ${SITE_NAME}`;
        const description = truncate(
          gm.tagline ||
            gm.bio_long ||
            `Conheça o perfil do mestre ${displayName} e descubra suas mesas ativas no ${SITE_NAME}.`,
          200
        );
        
        // Aumenta tamanho de imagens do Google para atender requisitos do Facebook (mínimo 200x200)
        let imageUrl = gm.avatar_url || gm.banner_url || DEFAULT_OG_IMAGE;
        imageUrl = upgradeGoogleImageQuality(imageUrl, 400);

        const output = injectMetaTags(html, {
          title,
          description,
          imageUrl,
          canonicalUrl: `${SITE_URL}/mestre/${encodeURIComponent(gm.slug)}`,
          ogType: 'profile',
          extraProfile: {
            'profile:username': gm.slug,
          },
        });

        return res.status(200).type('html').send(output);
      }

      // Futuros tipos podem ser adicionados aqui:
      // case 'mesa': { ... }
      // case 'evento': { ... }

      default: {
        // Tipo não suportado - retorna fallback
        const htmlFallback = injectMetaTags(html, getFallbackMeta(`/${type}/${slug}`));
        return res.status(200).type('html').send(htmlFallback);
      }
    }
  } catch (error: any) {
    console.error('[GET /og/:type/:slug]', { type, slug }, error);

    try {
      const html = await loadIndexHtml();
      const output = injectMetaTags(html, getFallbackMeta(`/${type}/${slug}`));
      return res.status(200).type('html').send(output);
    } catch {
      return res.status(500).send('Internal error');
    }
  }
});

router.get('/{*splat}', async (req: Request, res: Response) => {
  try {
    const html = await loadIndexHtml();
    const output = injectMetaTags(html, getFallbackMeta(req.path));
    return res.status(200).type('html').send(output);
  } catch {
    return res.status(500).send('Internal error');
  }
});

export default router;

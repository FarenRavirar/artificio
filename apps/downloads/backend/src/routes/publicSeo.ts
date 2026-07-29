import { Router } from 'express';
import { robotsTxt, sitemapXml } from '@artificio/content';
import { db } from '../db';

const router = Router();
const SITE_ORIGIN = process.env.PUBLIC_SITE_URL || 'https://downloads.artificiorpg.com';
const FACET_ROBOTS_RULES = [
  '/*?*q=',
  '/*?*material_type=',
  '/*?*system_id=',
  '/*?*edition_id=',
  '/*?*access_kind=',
  '/*?*publisher=',
  '/*?*author=',
  '/*?*sort=',
  '/*?*page=',
];

router.get('/robots.txt', (_req, res) => {
  const isBeta = process.env.APP_ENV === 'beta';
  const body = isBeta
    ? robotsTxt({ disallow: ['/'] })
    : robotsTxt({ disallow: FACET_ROBOTS_RULES, sitemap: `${SITE_ORIGIN}/sitemap.xml` });

  return res.type('text/plain')
    .set('Cache-Control', 'public, max-age=300, no-transform')
    .send(body);
});

router.get('/sitemap.xml', async (_req, res) => {
  if (process.env.APP_ENV === 'beta') {
    return res.status(404)
      .set('Cache-Control', 'no-store')
      .set('X-Robots-Tag', 'noindex, nofollow')
      .type('text')
      .send('Not found');
  }

  try {
    const rows = await db.selectFrom('download_material')
      .select(['slug', 'updated_at'])
      .where('editorial_state', '=', 'published')
      .orderBy('slug', 'asc')
      .execute();
    const entries = [
      { url: `${SITE_ORIGIN}/catalogo`, priority: 1 },
      ...rows.map((row) => ({
        url: `${SITE_ORIGIN}/materiais/${encodeURIComponent(row.slug)}`,
        lastmod: row.updated_at.toISOString(),
      })),
    ];
    return res.type('application/xml')
      .set('Cache-Control', 'public, max-age=300, no-transform')
      .send(sitemapXml(entries));
  } catch (error: unknown) {
    console.error('[sitemap] falha ao gerar sitemap', error);
    return res.status(503)
      .set('Retry-After', '60')
      .set('Cache-Control', 'no-store')
      .type('text')
      .send('Service unavailable');
  }
});

export default router;

import { Router } from 'express';
import { sitemapXml } from '@artificio/content';
import { db } from '../db/index.js';

const router = Router();
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mesas.artificiorpg.com';

router.get('/sitemap.xml', async (_req, res) => {
  const rows = await db.selectFrom('tables').select(['slug', 'updated_at'])
    .where('status', '=', 'active').where('archived_at', 'is', null).execute();
  const entries = [
    { url: SITE_URL, priority: 1 },
    ...rows.map((row) => ({ url: `${SITE_URL}/mesas/${encodeURIComponent(row.slug)}`, lastmod: row.updated_at?.toISOString() })),
  ];
  res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(sitemapXml(entries));
});

export default router;

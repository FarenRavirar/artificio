import { Router } from 'express';
import { sitemapXml } from '@artificio/content';
import { db } from '../config/database.js';

const router = Router();
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://glossario.artificiorpg.com';

router.get('/sitemap.xml', async (_req, res) => {
  const { rows } = await db.query(`SELECT id, GREATEST(created_at, reviewed_at) AS updated_at FROM terms WHERE status = 'verificado' ORDER BY id`);
  const entries = [{ url: SITE_URL, priority: 1 }, ...rows.map((row) => ({
    url: `${SITE_URL}/termo/${encodeURIComponent(row.id)}`,
    lastmod: row.updated_at instanceof Date ? row.updated_at.toISOString() : undefined,
  }))];
  res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(sitemapXml(entries));
});

export default router;

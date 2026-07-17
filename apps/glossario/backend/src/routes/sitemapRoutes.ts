import { Router } from 'express';
import { sitemapXml } from '@artificio/content';

const router = Router();
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://glossario.artificiorpg.com';

router.get('/sitemap.xml', (_req, res) => {
  // Não listar verbetes até que /termo/:id tenha página pública para usuários.
  const entries = [{ url: SITE_URL, priority: 1 }];
  res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(sitemapXml(entries));
});

export default router;

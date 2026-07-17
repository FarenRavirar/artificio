import { Router } from 'express';
import { db } from '../config/database.js';

const router = Router();
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://glossario.artificiorpg.com';
const IMAGE = `${SITE_URL}/og-default.png`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function socialHtml(title: string, description: string, canonical: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${IMAGE}"><meta property="og:url" content="${canonical}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${IMAGE}"></head><body></body></html>`;
}

router.get('/termo/:id', async (req, res) => {
  const { rows } = await db.query(`SELECT id, name_en, name_pt, additional_info FROM terms WHERE id = $1 AND status = 'verificado'`, [req.params.id]);
  const term = rows[0];
  const title = term ? `${term.name_en} — ${term.name_pt} | Grande Glossário de RPG` : 'Grande Glossário de RPG · Artifício RPG';
  const description = term?.additional_info || (term ? `Tradução de ${term.name_en}: ${term.name_pt}.` : 'Glossário colaborativo de tradução para RPG de mesa.');
  const canonical = term ? `${SITE_URL}/termo/${encodeURIComponent(term.id)}` : SITE_URL;
  res.type('html').set('Cache-Control', 'public, max-age=300').send(socialHtml(title, description, canonical));
});

export default router;

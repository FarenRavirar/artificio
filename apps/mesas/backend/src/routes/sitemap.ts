import { Router } from 'express';
import { sitemapXml } from '@artificio/content';
import { db } from '../db/index.js';
import { importedTableIsCurrentSql } from '../utils/tableVisibility.js';

const router = Router();
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mesas.artificiorpg.com';

router.get('/sitemap.xml', async (_req, res) => {
  // O sitemap precisa aplicar a MESMA regra de visibilidade do detalhe e do OG.
  // Achado do mantenedor 2026-09-11 (spec 102): filtrando só `status`/`archived_at`,
  // ele anunciava ao Google 51 das 57 mesas importadas que `og.ts` já tratava como
  // inexistentes — o crawler recebia "Mesa não encontrada" com HTTP 200, o padrão
  // que produz "Rastreada, mas não indexada" (medido: 51 expiradas no banco = 51
  // soft-404 entre as 92 URLs do sitemap).
  //
  // A expiração de importada em 5 dias está correta e é deliberada: mesa fecha as
  // vagas em 2-3 dias e o mestre esquece de arquivar, então a saída é automática.
  // O erro era só o sitemap não conhecer essa regra.
  //
  // `importedTableIsCurrentSql` é reusada, não reescrita: esta regra já divergiu
  // entre detalhe e OG antes (achado CodeRabbit, spec 059/060) e é o motivo de
  // `tableVisibility.ts` existir. O sitemap era o terceiro leitor, nunca ligado.
  const rows = await db.selectFrom('tables').select(['slug', 'updated_at'])
    .where('status', '=', 'active').where('archived_at', 'is', null)
    .where(importedTableIsCurrentSql('tables')).execute();
  const entries = [
    { url: SITE_URL, priority: 1 },
    ...rows.map((row) => ({ url: `${SITE_URL}/mesas/${encodeURIComponent(row.slug)}`, lastmod: row.updated_at?.toISOString() })),
  ];
  res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(sitemapXml(entries));
});

export default router;

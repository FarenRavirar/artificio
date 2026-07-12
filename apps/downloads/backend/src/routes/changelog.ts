import { Router, type Request, type Response } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeChangelogEntries, CHANGELOG_CACHE_TTL, type ChangelogEntry } from '@artificio/changelog';

// Changelog do downloads no mesmo padrao mesas/glossario (D041): JSON estatico
// em apps/downloads/database/changelogs.json, cache em memoria, contrato
// { data: ChangelogEntry[] } via @artificio/changelog (compartilhado).

const router = Router();

let changelogsCache: ChangelogEntry[] | null = null;
let cacheTimestamp = 0;

router.get('/', async (_req: Request, res: Response) => {
  try {
    const now = Date.now();

    if (changelogsCache && now - cacheTimestamp < CHANGELOG_CACHE_TTL) {
      return res.json({ data: changelogsCache });
    }

    const changelogsPath = join(__dirname, '../..', 'database', 'changelogs.json');
    const changelogsData = await readFile(changelogsPath, 'utf-8');

    let changelogs: unknown[] = [];
    try {
      const parsed: unknown = JSON.parse(changelogsData);
      if (!Array.isArray(parsed)) {
        throw new Error('Changelogs deve ser um array');
      }
      changelogs = parsed;
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      console.error('[GET /changelog] JSON inválido:', message);
      return res.status(500).json({ error: 'Erro ao processar atualizações.' });
    }

    const published = normalizeChangelogEntries(changelogs, 50);

    changelogsCache = published;
    cacheTimestamp = now;

    return res.json({ data: published });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GET /changelog] Erro:', message);
    return res.status(500).json({ error: 'Erro ao buscar atualizações.' });
  }
});

export default router;

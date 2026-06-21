import { Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeChangelogEntries, CHANGELOG_CACHE_TTL, type ChangelogEntry } from '@artificio/ui/changelog';

let changelogsCache: ChangelogEntry[] | null = null;
let cacheTimestamp = 0;

export const getChangelogs = async (_req: Request, res: Response) => {
  try {
    const now = Date.now();

    if (changelogsCache && (now - cacheTimestamp) < CHANGELOG_CACHE_TTL) {
      return res.json({ data: changelogsCache });
    }

    const changelogsPath = join(__dirname, '../../../database/changelogs.json');
    const raw = await readFile(changelogsPath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[GET /changelog] JSON invalido em changelogs.json');
      return res.status(500).json({ error: 'Erro ao processar atualizacoes.' });
    }

    if (!Array.isArray(parsed)) {
      console.error('[GET /changelog] changelogs.json nao e um array');
      return res.status(500).json({ error: 'Erro ao processar atualizacoes.' });
    }

    const published = normalizeChangelogEntries(parsed, 50);

    changelogsCache = published;
    cacheTimestamp = now;

    res.json({ data: published });
  } catch (error) {
    console.error('[GET /changelog] Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

import { Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  type: 'app' | 'dados';
  published: boolean;
  created_at: string;
}

let changelogsCache: ChangelogEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;

export const getChangelogs = async (_req: Request, res: Response) => {
  try {
    const now = Date.now();

    if (changelogsCache && (now - cacheTimestamp) < CACHE_TTL) {
      return res.json(changelogsCache);
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

    const published = (parsed as ChangelogEntry[])
      .filter((entry) => entry.published === true && entry.id && entry.title && entry.body && entry.created_at && !isNaN(new Date(entry.created_at).getTime()) && (entry.type === 'app' || entry.type === 'dados'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    changelogsCache = published;
    cacheTimestamp = now;

    res.json(published);
  } catch (error) {
    console.error('[GET /changelog] Erro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

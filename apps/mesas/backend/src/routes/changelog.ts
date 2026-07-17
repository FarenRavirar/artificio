import { Router, Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeChangelogEntries, CHANGELOG_CACHE_TTL, type ChangelogEntry } from '@artificio/changelog';

const router = Router();

// CORREÇÃO BE-01: Cache em memória para evitar leitura repetida do disco
let changelogsCache: ChangelogEntry[] | null = null;
let cacheTimestamp = 0;

router.get('/', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    
    // Usar cache se ainda válido
    if (changelogsCache && (now - cacheTimestamp) < CHANGELOG_CACHE_TTL) {
      return res.json({ data: changelogsCache });
    }

    // CORREÇÃO INT-02: Path relativo mais robusto
    const changelogsPath = join(fileURLToPath(new URL('.', import.meta.url)), '../..', 'database', 'changelogs.json');
    const changelogsData = await readFile(changelogsPath, 'utf-8');
    
    // CORREÇÃO BE-02: Validar JSON antes de parsear
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

    // Atualizar cache
    changelogsCache = published;
    cacheTimestamp = now;

    res.json({ data: published });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[GET /changelog] Erro:', {
      message,
      stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ error: 'Erro ao buscar atualizações.' });
  }
});

export default router;

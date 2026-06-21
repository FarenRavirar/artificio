import { Router, Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeChangelogEntries, CHANGELOG_CACHE_TTL, type ChangelogEntry } from '@artificio/ui/changelog';

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
    const changelogsPath = join(__dirname, '../..', 'database', 'changelogs.json');
    const changelogsData = await readFile(changelogsPath, 'utf-8');
    
    // CORREÇÃO BE-02: Validar JSON antes de parsear
    let changelogs: unknown[] = [];
    try {
      const parsed: unknown = JSON.parse(changelogsData);
      if (!Array.isArray(parsed)) {
        throw new Error('Changelogs deve ser um array');
      }
      changelogs = parsed;
    } catch (parseError: any) {
      console.error('[GET /changelog] JSON inválido:', parseError.message);
      return res.status(500).json({ error: 'Erro ao processar atualizações.' });
    }
    
    const published = normalizeChangelogEntries(changelogs, 50);

    // Atualizar cache
    changelogsCache = published;
    cacheTimestamp = now;

    res.json({ data: published });
  } catch (error: any) {
    console.error('[GET /changelog] Erro:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ error: 'Erro ao buscar atualizações.' });
  }
});

export default router;
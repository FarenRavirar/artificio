import { Router, Request, Response } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';

const router = Router();

// CORREÇÃO BE-01: Cache em memória para evitar leitura repetida do disco
let changelogsCache: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minuto

router.get('/', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    
    // Usar cache se ainda válido
    if (changelogsCache && (now - cacheTimestamp) < CACHE_TTL) {
      return res.json({ data: changelogsCache });
    }

    // CORREÇÃO INT-02: Path relativo mais robusto
    const changelogsPath = join(__dirname, '../..', 'database', 'changelogs.json');
    const changelogsData = await readFile(changelogsPath, 'utf-8');
    
    // CORREÇÃO BE-02: Validar JSON antes de parsear
    let changelogs;
    try {
      changelogs = JSON.parse(changelogsData);
      if (!Array.isArray(changelogs)) {
        throw new Error('Changelogs deve ser um array');
      }
    } catch (parseError: any) {
      console.error('[GET /changelog] JSON inválido:', parseError.message);
      return res.status(500).json({ error: 'Erro ao processar atualizações.' });
    }
    
    // Filtrar apenas publicados e ordenar por data
    const published = changelogs
      .filter((log: any) => log.published && log.id && log.title && log.body)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

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
import { fetchSimple, looksBlocked } from './httpFetch';
import { PatchrightEngine } from '../headlessEngine/patchrightClient';
import { CamoufoxEngine } from '../headlessEngine/camoufoxClient';
import { ScraperRateLimiter } from '../scraperRateLimiter';
import { failingAsyncIterable } from './failingAsyncIterable';
import type { ScraperAdapter, ScrapedItem } from './types';

// T3.3 (spec 084) — DMs Guild: mesma plataforma OneBookShelf do DriveThruRPG,
// mesmo WAF confirmado bloqueando Modo 1 e Modo 2a nesta implementacao (ver
// driveThruRpgScraper.ts). Conteudo aqui tem regime de IP mais restrito
// (revenue-share com WotC) — reforca que so linkar (nunca copiar) e o unico
// modo aceitavel. Cron nunca inclui esta fonte (D119/spec — so disparo
// manual, ver Fase 5). Mesmo comportamento defensivo do DriveThruRPG: sem
// parser de listagem implementado (nunca vimos resposta desbloqueada real) —
// se algum modo retornar sem bloqueio, lanca erro explicito em vez de
// silenciosamente nao criar nada.
const LISTING_URL = 'https://www.dmsguild.com/browse?filters=100000&price=0';

async function attemptAllModesAndFail(rateLimiter: ScraperRateLimiter): Promise<never> {
  const simple = await fetchSimple(LISTING_URL);
  if (!looksBlocked(simple)) {
    throw new Error(
      'DMs Guild respondeu sem bloqueio (Modo 1) mas nenhum parser de listagem foi implementado ainda — WAF pode ter mudado de comportamento; requer implementação de parsing antes de confiar no resultado.',
    );
  }

  await rateLimiter.wait();
  const patchright = await new PatchrightEngine().fetchRendered(LISTING_URL);
  if (patchright.status < 400) {
    throw new Error(
      'DMs Guild respondeu sem bloqueio via Modo 2a (patchright) mas nenhum parser de listagem foi implementado ainda — requer implementação de parsing antes de confiar no resultado.',
    );
  }

  await rateLimiter.wait();
  const camoufox = await new CamoufoxEngine().fetchRendered(LISTING_URL);
  if (camoufox.status < 400) {
    throw new Error(
      'DMs Guild respondeu sem bloqueio via Modo 2b (Camoufox) mas nenhum parser de listagem foi implementado ainda — requer implementação de parsing antes de confiar no resultado.',
    );
  }

  throw new Error(
    `DMs Guild bloqueou todos os modos de acesso (fetch=${simple.status}, patchright=${patchright.status}, camoufox=${camoufox.status}) — sem material criado, ver download_scraper_run.error_detail.`,
  );
}

export class DmsGuildScraper implements ScraperAdapter {
  sourcePlatform = 'dms_guild';

  private readonly rateLimiter = new ScraperRateLimiter();

  discoverItems(): AsyncIterable<ScrapedItem> {
    return failingAsyncIterable<ScrapedItem>(() => attemptAllModesAndFail(this.rateLimiter));
  }
}

import { fetchSimple, looksBlocked } from './httpFetch';
import { PatchrightEngine } from '../headlessEngine/patchrightClient';
import { CamoufoxEngine } from '../headlessEngine/camoufoxClient';
import { ScraperRateLimiter } from '../scraperRateLimiter';
import { failingAsyncIterable } from './failingAsyncIterable';
import type { ScraperAdapter, ScrapedItem } from './types';

// Achado de review PR #193 (codeRabbit, nitpick): DriveThruRPG e DMs Guild
// (mesma plataforma OneBookShelf, mesmo WAF confirmado bloqueando Modo 1 e
// 2a nesta implementacao) tinham o mesmo attemptAllModesAndFail duplicado
// arquivo a arquivo. Extraido aqui, parametrizado por label/URL — nenhum
// parser de listagem foi escrito ainda pra nenhuma das 2 fontes (nunca vimos
// resposta desbloqueada real); se algum modo retornar sem bloqueio, lanca
// erro explicito em vez de silenciosamente nao criar nada ("parece ter
// funcionado mas nao criou material" seria um caminho feliz escondido).
async function attemptAllModesAndFail(sourceLabel: string, listingUrl: string, rateLimiter: ScraperRateLimiter): Promise<never> {
  const simple = await fetchSimple(listingUrl);
  if (!looksBlocked(simple)) {
    throw new Error(
      `${sourceLabel} respondeu sem bloqueio (Modo 1) mas nenhum parser de listagem foi implementado ainda — WAF pode ter mudado de comportamento; requer implementação de parsing antes de confiar no resultado.`,
    );
  }

  await rateLimiter.wait();
  const patchright = await new PatchrightEngine().fetchRendered(listingUrl);
  if (patchright.status < 400) {
    throw new Error(
      `${sourceLabel} respondeu sem bloqueio via Modo 2a (patchright) mas nenhum parser de listagem foi implementado ainda — requer implementação de parsing antes de confiar no resultado.`,
    );
  }

  await rateLimiter.wait();
  const camoufox = await new CamoufoxEngine().fetchRendered(listingUrl);
  if (camoufox.status < 400) {
    throw new Error(
      `${sourceLabel} respondeu sem bloqueio via Modo 2b (Camoufox) mas nenhum parser de listagem foi implementado ainda — requer implementação de parsing antes de confiar no resultado.`,
    );
  }

  throw new Error(
    `${sourceLabel} bloqueou todos os modos de acesso (fetch=${simple.status}, patchright=${patchright.status}, camoufox=${camoufox.status}) — sem material criado, ver download_scraper_run.error_detail.`,
  );
}

export function createBlockedSourceScraper(sourcePlatform: string, sourceLabel: string, listingUrl: string): ScraperAdapter {
  const rateLimiter = new ScraperRateLimiter();
  return {
    sourcePlatform,
    discoverItems(): AsyncIterable<ScrapedItem> {
      return failingAsyncIterable<ScrapedItem>(() => attemptAllModesAndFail(sourceLabel, listingUrl, rateLimiter));
    },
  };
}

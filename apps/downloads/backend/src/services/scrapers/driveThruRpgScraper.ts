import { fetchSimple, looksBlocked } from './httpFetch';
import { PatchrightEngine } from '../headlessEngine/patchrightClient';
import { CamoufoxEngine } from '../headlessEngine/camoufoxClient';
import { ScraperRateLimiter } from '../scraperRateLimiter';
import { failingAsyncIterable } from './failingAsyncIterable';
import type { ScraperAdapter, ScrapedItem } from './types';

// T3.3 (spec 084) — DriveThruRPG: 403 confirmado em Modo 1 (fetch simples) E
// Modo 2a (patchright headless Chromium) durante esta implementacao —
// `Cf-Mitigated: challenge` presente mesmo apos render completo, confirmando
// o achado da spec (WAF bloqueia qualquer requisicao automatizada conhecida,
// nao so fetch cru). Modo 2b (Camoufox) e tentado por ultimo — pode falhar
// tambem (cenario ja esperado pelo criterio de aceite 3 da spec: falha total
// registra download_scraper_run.status=failed com error_detail claro,
// NUNCA cria material sem confirmar preco). Cron nunca inclui esta fonte
// (D119/spec — so disparo manual, ver Fase 5).
//
// IMPORTANTE: nenhum parser de listagem foi escrito ainda — nunca vimos uma
// resposta desbloqueada real desta fonte pra confirmar estrutura de HTML.
// Se algum modo retornar status < 400 no futuro (WAF mudou de
// comportamento), lanca erro explicito em vez de silenciosamente nao criar
// nada — "parece ter funcionado mas nao criou material" seria um caminho
// feliz escondido e enganoso.
const LISTING_URL = 'https://www.drivethrurpg.com/en/browse?filters=100000&price=0';

async function attemptAllModesAndFail(rateLimiter: ScraperRateLimiter): Promise<never> {
  const simple = await fetchSimple(LISTING_URL);
  if (!looksBlocked(simple)) {
    throw new Error(
      'DriveThruRPG respondeu sem bloqueio (Modo 1) mas nenhum parser de listagem foi implementado ainda — WAF pode ter mudado de comportamento; requer implementação de parsing antes de confiar no resultado.',
    );
  }

  await rateLimiter.wait();
  const patchright = await new PatchrightEngine().fetchRendered(LISTING_URL);
  if (patchright.status < 400) {
    throw new Error(
      'DriveThruRPG respondeu sem bloqueio via Modo 2a (patchright) mas nenhum parser de listagem foi implementado ainda — requer implementação de parsing antes de confiar no resultado.',
    );
  }

  await rateLimiter.wait();
  const camoufox = await new CamoufoxEngine().fetchRendered(LISTING_URL);
  if (camoufox.status < 400) {
    throw new Error(
      'DriveThruRPG respondeu sem bloqueio via Modo 2b (Camoufox) mas nenhum parser de listagem foi implementado ainda — requer implementação de parsing antes de confiar no resultado.',
    );
  }

  throw new Error(
    `DriveThruRPG bloqueou todos os modos de acesso (fetch=${simple.status}, patchright=${patchright.status}, camoufox=${camoufox.status}) — sem material criado, ver download_scraper_run.error_detail.`,
  );
}

export class DriveThruRpgScraper implements ScraperAdapter {
  sourcePlatform = 'drivethrurpg';

  private readonly rateLimiter = new ScraperRateLimiter();

  discoverItems(): AsyncIterable<ScrapedItem> {
    return failingAsyncIterable<ScrapedItem>(() => attemptAllModesAndFail(this.rateLimiter));
  }
}

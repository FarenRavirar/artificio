import { discoverItchGames } from './itchIoParser';
import { ScraperRateLimiter } from '../scraperRateLimiter';
import type { ScraperAdapter, ScrapedItem } from './types';

// T3.2 (spec 084) — Grimórios & Dados: storefront de dev dentro do dominio
// itch.io (grimorios-e-dados.itch.io), mesma politica de acesso/robots.txt
// do itch.io geral. Reusa parser compartilhado (itchIoParser.ts) — so muda
// listingUrl. Diferente da fonte itch.io geral: essa pagina NAO tem filtro
// nativo de idioma na URL (e o storefront inteiro de um dev, nao uma busca
// filtrada) — spec.md registra "maioria pt-BR confirmado", nao garantia por
// item, entao sourceLanguageHint fica null (languageDetector decide, Fase 4).
const LISTING_URL = 'https://grimorios-e-dados.itch.io';

export class GrimoriosEDadosScraper implements ScraperAdapter {
  sourcePlatform = 'grimorios_e_dados';

  private readonly rateLimiter = new ScraperRateLimiter();

  discoverItems(): AsyncIterable<ScrapedItem> {
    return discoverItchGames(LISTING_URL, this.rateLimiter, null);
  }
}

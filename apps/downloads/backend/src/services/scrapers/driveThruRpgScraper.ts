import { createBlockedSourceScraper } from './blockedSourceScraper';
import type { ScraperAdapter, ScrapedItem } from './types';

// T3.3 (spec 084) — DriveThruRPG: 403 confirmado em Modo 1 (fetch simples) E
// Modo 2a (patchright headless Chromium) durante esta implementacao —
// `Cf-Mitigated: challenge` presente mesmo apos render completo, confirmando
// o achado da spec (WAF bloqueia qualquer requisicao automatizada conhecida,
// nao so fetch cru). Modo 2b (Camoufox) e tentado por ultimo — pode falhar
// tambem (cenario ja esperado pelo criterio de aceite 3 da spec: falha total
// registra download_scraper_run.status=failed com error_detail claro,
// NUNCA cria material sem confirmar preco). Cron nunca inclui esta fonte
// (D119/spec — so disparo manual, ver Fase 5). Logica de cascata/erro
// compartilhada com DMs Guild em blockedSourceScraper.ts (achado de review
// PR #193 — duplicacao arquivo a arquivo).
const LISTING_URL = 'https://www.drivethrurpg.com/en/browse?filters=100000&price=0';

export class DriveThruRpgScraper implements ScraperAdapter {
  sourcePlatform = 'drivethrurpg';

  private readonly delegate = createBlockedSourceScraper('drivethrurpg', 'DriveThruRPG', LISTING_URL);

  discoverItems(): AsyncIterable<ScrapedItem> {
    return this.delegate.discoverItems();
  }
}

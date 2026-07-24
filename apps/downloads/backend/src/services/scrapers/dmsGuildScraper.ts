import { createBlockedSourceScraper } from './blockedSourceScraper';
import type { ScraperAdapter, ScrapedItem } from './types';

// T3.3 (spec 084) — DMs Guild: mesma plataforma OneBookShelf do DriveThruRPG,
// mesmo WAF confirmado bloqueando Modo 1 e Modo 2a nesta implementacao (ver
// driveThruRpgScraper.ts). Conteudo aqui tem regime de IP mais restrito
// (revenue-share com WotC) — reforca que so linkar (nunca copiar) e o unico
// modo aceitavel. Cron nunca inclui esta fonte (D119/spec — so disparo
// manual, ver Fase 5). Logica de cascata/erro compartilhada com DriveThruRPG
// em blockedSourceScraper.ts (achado de review PR #193 — duplicacao arquivo
// a arquivo).
const LISTING_URL = 'https://www.dmsguild.com/browse?filters=100000&price=0';

export class DmsGuildScraper implements ScraperAdapter {
  sourcePlatform = 'dms_guild';

  private readonly delegate = createBlockedSourceScraper('dms_guild', 'DMs Guild', LISTING_URL);

  discoverItems(): AsyncIterable<ScrapedItem> {
    return this.delegate.discoverItems();
  }
}

import { discoverItchGames } from './itchIoParser';
import { ScraperRateLimiter } from '../scraperRateLimiter';
import type { ScraperAdapter, ScrapedItem } from './types';

// T3.1 (spec 084) — itch.io: usa filtro nativo de genero+idioma na URL de
// descoberta (`genre-rpg/lang-pt-BR`) — nao combina com `free` no mesmo path
// porque essa combinacao tripla aciona Cloudflare Turnstile (achado real,
// confirmado nesta implementacao: `/games/free/genre-rpg/lang-pt-BR` -> 403
// com `Cf-Mitigated: challenge`, mesmo a spec original dizendo "sem bloqueio
// observado" pra itch.io em geral). Busca lista sem `free`, confirma
// preco/PWYW por item na propria pagina do jogo (sinal real confirmado:
// `<span class="sub">Name your own price</span>` ou preco fixo em
// `bundle_row`/`header_buy_row` — qualquer coisa que nao seja "grátis"
// inequivoco fica ambigua e e pulada, nunca assumida).
const LISTING_URL = 'https://itch.io/games/genre-rpg/lang-pt-BR';

export class ItchIoScraper implements ScraperAdapter {
  sourcePlatform = 'itch_io';

  private readonly rateLimiter = new ScraperRateLimiter();

  discoverItems(): AsyncIterable<ScrapedItem> {
    // Filtro nativo da propria URL de descoberta ja confirma pt-BR — fonte
    // primaria de decisao de idioma pra esta fonte (spec.md).
    return discoverItchGames(LISTING_URL, this.rateLimiter, 'pt');
  }
}

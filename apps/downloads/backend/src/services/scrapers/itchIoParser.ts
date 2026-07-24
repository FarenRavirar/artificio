import { fetchSimple, looksBlocked } from './httpFetch';
import { PatchrightEngine } from '../headlessEngine/patchrightClient';
import { CamoufoxEngine } from '../headlessEngine/camoufoxClient';
import { ScraperRateLimiter } from '../scraperRateLimiter';
import type { ScrapedItem } from './types';

// Parsing compartilhado entre ItchIoScraper (T3.1) e GrimoriosEDadosScraper
// (T3.2, storefront de dev dentro do mesmo dominio itch.io) — mesmo motor de
// paginas, so muda a URL de listagem e o sourceLanguageHint (itch.io geral
// confirma pt-BR via filtro nativo da URL; storefront de dev individual nao
// tem esse filtro, sourceLanguageHint fica null pro languageDetector decidir).

// Ordem dos atributos href/class varia entre paginas itch.io (listagem geral
// tem href antes de class; storefront de dev individual tem class antes de
// href — confirmado via fetch real durante esta implementacao). Regex
// aceita as 2 ordens em vez de depender de uma so.
const GAME_LINK_RE = /<a (?:href="(https:\/\/[a-z0-9.-]+\.itch\.io\/[a-z0-9-]+)"[^>]*class="title game_link"|class="title game_link"[^>]*href="(https:\/\/[a-z0-9.-]+\.itch\.io\/[a-z0-9-]+)")[^>]*>([^<]*)</g;
const OG_IMAGE_RE = /content="([^"]+)"\s*property="og:image"/;
const OG_DESCRIPTION_RE = /content="([^"]*)"\s*property="og:description"/;
const AUTHOR_LINK_RE = /<a href="https:\/\/[a-z0-9.-]+\.itch\.io"[^>]*>([^<]*)</;
const NAME_YOUR_PRICE_RE = /Name your own price/;
const BUNDLE_ROW_RE = /class="bundle_row"/;
const HEADER_BUY_ROW_RE = /class="header_buy_row"/;

export async function fetchItchPageHtml(url: string, rateLimiter: ScraperRateLimiter): Promise<string> {
  const simple = await fetchSimple(url);
  if (!looksBlocked(simple)) {
    return simple.html;
  }

  await rateLimiter.wait();
  const patchright = await new PatchrightEngine().fetchRendered(url);
  if (patchright.status < 400) {
    return patchright.html;
  }

  await rateLimiter.wait();
  const camoufox = await new CamoufoxEngine().fetchRendered(url);
  return camoufox.html;
}

export interface DiscoveredGame {
  url: string;
  title: string;
}

export function parseItchListing(html: string): DiscoveredGame[] {
  const games: DiscoveredGame[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(GAME_LINK_RE);
  while ((match = regex.exec(html)) !== null) {
    const url = match[1] ?? match[2];
    games.push({ url, title: match[3] });
  }
  return games;
}

// Confirma preco real na pagina do jogo — a listagem nao expoe preco
// diretamente. Retorna null quando o sinal e ambiguo (nao assume gratis por
// omissao de dado).
export function parseItchIsFreeOrPwyw(gameHtml: string): boolean | null {
  if (NAME_YOUR_PRICE_RE.test(gameHtml)) return true;
  if (BUNDLE_ROW_RE.test(gameHtml)) return false; // preco fixo em bundle = pago
  if (!HEADER_BUY_ROW_RE.test(gameHtml)) return null;
  return null;
}

export function parseItchGameDetail(gameHtml: string): { description: string | null; coverImageUrl: string | null; publisherName: string | null } {
  const description = OG_DESCRIPTION_RE.exec(gameHtml)?.[1] ?? null;
  const coverImageUrl = OG_IMAGE_RE.exec(gameHtml)?.[1] ?? null;
  const publisherName = AUTHOR_LINK_RE.exec(gameHtml)?.[1]?.trim() ?? null;
  return { description, coverImageUrl, publisherName };
}

export async function* discoverItchGames(
  listingUrl: string,
  rateLimiter: ScraperRateLimiter,
  sourceLanguageHint: ScrapedItem['sourceLanguageHint'],
): AsyncIterable<ScrapedItem> {
  const listingHtml = await fetchItchPageHtml(listingUrl, rateLimiter);
  const games = parseItchListing(listingHtml);

  for (const game of games) {
    await rateLimiter.wait();
    const gamePage = await fetchSimple(game.url);
    if (looksBlocked(gamePage)) {
      continue;
    }

    const isFreeOrPwyw = parseItchIsFreeOrPwyw(gamePage.html);
    if (isFreeOrPwyw !== true) {
      continue;
    }

    const detail = parseItchGameDetail(gamePage.html);

    yield {
      sourceUrl: game.url,
      title: game.title,
      description: detail.description,
      isFreeOrPwyw: true,
      coverImageUrl: detail.coverImageUrl,
      publisherName: detail.publisherName,
      sourceLanguageHint,
    };
  }
}

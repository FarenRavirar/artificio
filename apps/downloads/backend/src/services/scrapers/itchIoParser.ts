import { fetchSimple, looksBlocked } from './httpFetch';
import { PatchrightEngine } from '../headlessEngine/patchrightClient';
import { CamoufoxEngine } from '../headlessEngine/camoufoxClient';
import { ScraperRateLimiter } from '../scraperRateLimiter';
import type { ScrapedItem } from './types';
import { decodeHtml5PlainText, normalizeScrapedItemPlainText } from './plainTextPolicy';

// Parsing compartilhado entre ItchIoScraper (T3.1) e GrimoriosEDadosScraper
// (T3.2, storefront de dev dentro do mesmo dominio itch.io) — mesmo motor de
// paginas, so muda a URL de listagem e a sourceLanguageEvidence (itch.io geral
// confirma pt-BR via filtro nativo da URL; storefront de dev individual nao
// tem esse filtro, sourceLanguageEvidence fica null pro languageDetector decidir).

// Ordem dos atributos href/class varia entre paginas itch.io (listagem geral
// tem href antes de class; storefront de dev individual tem class antes de
// href — confirmado via fetch real durante esta implementacao). Regex
// aceita as 2 ordens em vez de depender de uma so.
// Achado de review SonarQube (PR #193): a regex combinada excedia o limite
// de complexidade (23 > 20) e alternava 2 grupos [^>]* aninhados na mesma
// alternancia. Dividida em 2 passos — 1a isola cada bloco <a ...>Titulo</a>
// com class="title game_link" (sem se importar com a ordem do atributo
// dentro do proprio bloco isolado), 2a extrai href/titulo de dentro do
// bloco ja isolado (entrada curta, sem exposicao a HTML arbitrario).
const GAME_LINK_BLOCK_RE = /<a [^>]*class="title game_link"[^>]*>[^<]*</g;
const GAME_HREF_RE = /href="(https:\/\/[a-z0-9.-]+\.itch\.io\/[a-z0-9-]+)"/;
const GAME_TITLE_RE = />([^<]*)<$/;
const OG_IMAGE_RE = /content="([^"]+)"\s*property="og:image"/;
const OG_DESCRIPTION_RE = /content="([^"]*)"\s*property="og:description"/;
const AUTHOR_LINK_RE = /<a href="https:\/\/[a-z0-9.-]+\.itch\.io"[^>]*>([^<]*)</;
const NAME_YOUR_PRICE_RE = /Name your own price/;
const BUNDLE_ROW_RE = /class="bundle_row"/;
const HEADER_BUY_ROW_RE = /class="header_buy_row"/;
const GAME_INFO_TABLE_RE = /<div[^>]*class="[^"]*\bgame_info_panel_widget\b[^"]*"[^>]*>\s*<table[^>]*>([\s\S]*?)<\/table>/i;
const INFO_ROW_RE = /<tr[^>]*>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gis;
const INFO_LINK_TEXT_RE = /<a[^>]*>([^<]*)<\/a>/gi;

// Spec 089 T3.3 — allowlists pequenas, baseadas nos valores observados em
// DOM real. OSR/PbtA/TTRPG são estilos/categorias, não sistemas. `One-shot`
// é gameplay, não tipo de material. Sinal fora da lista fica `null`.
const SYSTEM_TAG_HINTS = new Map([
  ['dungeons & dragons', 'Dungeons & Dragons'],
  ['cairn', 'Cairn'],
]);
const MATERIAL_TYPE_TAG_HINTS = new Map([
  ['supplement', 'Suplemento'],
]);

export async function fetchItchPageHtml(url: string, rateLimiter: ScraperRateLimiter): Promise<string> {
  const simple = await fetchSimple(url);
  if (!looksBlocked(simple)) {
    return simple.html;
  }

  await rateLimiter.wait();
  // Achado de review PR #193 (codex) — PatchrightEngine.fetchRendered pode
  // REJEITAR (timeout de navegacao, browser ausente, falha de subprocess),
  // nao so retornar status>=400. Sem o try/catch, a excecao subia direto e
  // nunca escalonava pro Modo 2b (Camoufox), justamente no cenario em que o
  // fallback mais importa (anti-bot bloqueando o Modo 2a).
  try {
    const patchright = await new PatchrightEngine().fetchRendered(url);
    if (patchright.status < 400) {
      return patchright.html;
    }
  } catch {
    // cai pro Camoufox abaixo
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
  let blockMatch: RegExpExecArray | null;
  const blockRegex = new RegExp(GAME_LINK_BLOCK_RE);
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[0];
    const url = GAME_HREF_RE.exec(block)?.[1];
    const title = GAME_TITLE_RE.exec(block)?.[1];
    if (!url || title === undefined) continue;
    games.push({ url, title });
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

// Spec 089 T0.1a/T0.1e — o endpoint físico ainda mistura cards, wargames e
// outros projetos. Só a URL da listagem não basta: cada produto precisa
// declarar Category=Physical game e um sinal inequívoco de RPG de mesa.
// Ausência/ambiguidade falha fechado; não inferimos pelo título/descrição.
export function parseItchIsTabletopRpg(gameHtml: string): boolean {
  const rows = parseInformationRows(gameHtml);
  const category = rows.get('category') ?? [];
  const genre = rows.get('genre') ?? [];
  const tags = rows.get('tags') ?? [];
  const normalize = (value: string) => decodeHtml5PlainText(value).trim().toLocaleLowerCase('en-US');
  const isPhysicalGame = category.some((value) => normalize(value) === 'physical game');
  const hasTabletopRpgSignal = genre.some((value) => normalize(value) === 'role playing')
    || tags.some((value) => ['tabletop role-playing game', 'ttrpg', 'rpg-de-mesa'].includes(normalize(value)));
  return isPhysicalGame && hasTabletopRpgSignal;
}

// Spec 088 (requisito 40) — o itch.io expõe UM nome só: a conta que hospeda
// o jogo (`<a href="https://<dev>.itch.io">Nome</a>`). Diferente do OPERA RPG
// (que escreve "por Fulano", autoria explícita) e do OneBookShelf (que tem
// linhas separadas de `authors`, `artists` e `Editor/a`), aqui a página não
// distingue quem escreveu de quem publicou — no modelo do itch.io, o próprio
// dev/studio é a conta publicadora.
//
// Por isso o nome vai para `publisherName` e `authorsCredits` fica `null`:
// duplicar o mesmo valor nos dois campos faria a ficha exibir o nome duas
// vezes, uma sob "Editora" e outra sob "Por", sem acrescentar informação — e
// afirmaria autoria que a fonte não declara (requisito 38). Quando a página
// não expõe um papel, o campo é `null` explícito, não uma cópia do outro.
function parseInformationRows(gameHtml: string): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  const infoTable = GAME_INFO_TABLE_RE.exec(gameHtml)?.[1];
  if (!infoTable) return rows;
  for (const match of infoTable.matchAll(INFO_ROW_RE)) {
    const label = decodeHtml5PlainText(match[1]).trim().toLocaleLowerCase('en-US');
    // Mantém o valor cru para a fronteira única de decode na saída do
    // parser. A classificação abaixo usa uma cópia decodificada.
    const values = [...match[2].matchAll(INFO_LINK_TEXT_RE)]
      .map((link) => link[1].trim())
      .filter(Boolean);
    rows.set(label, values);
  }
  return rows;
}

function selectSingleMappedHint(values: string[], hints: Map<string, string>): string | null {
  const candidates = new Set(
    values
      .map((value) => hints.get(decodeHtml5PlainText(value).toLocaleLowerCase('en-US')))
      .filter((value): value is string => value !== undefined),
  );
  return candidates.size === 1 ? [...candidates][0] : null;
}

export function parseItchTaxonomyHints(gameHtml: string): {
  systemHint: string | null;
  materialTypeHint: string | null;
  tags: string[];
} {
  const tags = parseInformationRows(gameHtml).get('tags') ?? [];
  return {
    systemHint: selectSingleMappedHint(tags, SYSTEM_TAG_HINTS),
    materialTypeHint: selectSingleMappedHint(tags, MATERIAL_TYPE_TAG_HINTS),
    tags,
  };
}

export function parseItchGameDetail(gameHtml: string): {
  description: string | null;
  coverImageUrl: string | null;
  publisherName: string | null;
  systemHint: string | null;
  materialTypeHint: string | null;
  tags: string[];
} {
  const description = OG_DESCRIPTION_RE.exec(gameHtml)?.[1] ?? null;
  const coverImageUrl = OG_IMAGE_RE.exec(gameHtml)?.[1] ?? null;
  const publisherName = AUTHOR_LINK_RE.exec(gameHtml)?.[1]?.trim() ?? null;
  return { description, coverImageUrl, publisherName, ...parseItchTaxonomyHints(gameHtml) };
}

export async function* discoverItchGames(
  listingUrl: string,
  rateLimiter: ScraperRateLimiter,
  sourceLanguageEvidence: ScrapedItem['sourceLanguageEvidence'],
): AsyncIterable<ScrapedItem> {
  const listingHtml = await fetchItchPageHtml(listingUrl, rateLimiter);
  const games = parseItchListing(listingHtml);

  for (const game of games) {
    await rateLimiter.wait();
    // Achado de review PR #193 (codeRabbit): reusa o mesmo fallback
    // fetch->patchright->camoufox da listagem — antes, pagina de jogo
    // bloqueada so dava `continue` sem tentar Modo 2a/2b, perdendo item
    // real justamente quando o item individual esta sob anti-bot.
    let gameHtml: string;
    try {
      gameHtml = await fetchItchPageHtml(game.url, rateLimiter);
    } catch {
      continue;
    }

    const isFreeOrPwyw = parseItchIsFreeOrPwyw(gameHtml);
    if (isFreeOrPwyw !== true || !parseItchIsTabletopRpg(gameHtml)) {
      continue;
    }

    const detail = parseItchGameDetail(gameHtml);

    yield normalizeScrapedItemPlainText({
      sourceUrl: game.url,
      title: game.title,
      description: detail.description,
      isFreeOrPwyw: true,
      coverImageUrl: detail.coverImageUrl,
      publisherName: detail.publisherName,
      // `null` explícito, não campo omitido: a página do itch.io não declara
      // autoria nem arte separadas da conta publicadora, e ausência declarada
      // é o contrato (requisito 38). Omitir deixaria `undefined`, que lê como
      // "não extraído ainda" em vez de "a fonte não afirma isso".
      authorsCredits: null,
      artistsCredits: null,
      sourceLanguageEvidence,
      tags: detail.tags,
      systemHint: detail.systemHint,
      materialTypeHint: detail.materialTypeHint,
    });
  }
}

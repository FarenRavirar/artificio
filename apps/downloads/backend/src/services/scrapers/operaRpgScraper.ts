import { fetchSimple, looksBlocked } from './httpFetch';
import { ScraperRateLimiter } from '../scraperRateLimiter';
import type { ScraperAdapter, ScrapedItem } from './types';

// T3.2 (spec 084) — OPERA RPG: dominio proprio pequeno, PDFs hospedados em
// arquivos.operarpg.com.br (subdominio proprio, nao Google Drive/Mediafire),
// varias secoes de /downloads/* (aventuras/cenarios/personagens/outros).
// Estrutura confirmada via fetch real durante implementacao: cada item e um
// <a class="download-item" href="...pdf"><span><b>Titulo</b><br/><small>por
// Autor · Descricao</small></span></a> — formato regular e parseavel.
// Diferente de RPG Gratis/Newton Rocha (D-084-06/08): links sao diretos ao
// arquivo, sem indirecao/encurtador, dominio proprio confiavel. Sem licenca/
// gratuidade explicita na pagina (spec.md registra isso) — trata como
// "descoberta" de qualquer forma: filtro de idioma + preco continuam
// obrigatorios no pipeline (Fase 4), nunca assume gratuito so pela ausencia
// de preco visivel (aqui a ausencia de mecanismo de cobranca no proprio
// dominio E o sinal, ao contrario de itch.io onde precisa confirmar
// "Name your own price" explicito).
const BASE_URL = 'https://operarpg.com.br';
const SECTIONS = ['/downloads/aventuras', '/downloads/cenarios', '/downloads/personagens', '/downloads/personagens-digitais', '/downloads/regras-e-fichas', '/downloads/outros'];

const DOWNLOAD_ITEM_RE = /<a class="download-item" href="([^"]+)"[^>]*><span><b>([^<]*)<\/b><br\/><small>([^<]*)<\/small>/g;

interface ParsedDownloadItem {
  url: string;
  title: string;
  authorAndDescription: string;
}

function parseSection(html: string): ParsedDownloadItem[] {
  const items: ParsedDownloadItem[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(DOWNLOAD_ITEM_RE);
  while ((match = regex.exec(html)) !== null) {
    items.push({ url: match[1], title: match[2], authorAndDescription: match[3] });
  }
  return items;
}

// Formato confirmado: "por Autor · Descrição" ou "por Autor · Descrição · mais texto".
function splitAuthorAndDescription(raw: string): { publisherName: string | null; description: string | null } {
  const authorMatch = /^por\s+([^·]+)·?\s*(.*)$/.exec(raw.trim());
  if (!authorMatch) {
    return { publisherName: null, description: raw.trim() || null };
  }
  const publisherName = authorMatch[1].trim() || null;
  const description = authorMatch[2].trim() || null;
  return { publisherName, description };
}

export class OperaRpgScraper implements ScraperAdapter {
  sourcePlatform = 'opera_rpg';

  private readonly rateLimiter = new ScraperRateLimiter();

  async *discoverItems(): AsyncIterable<ScrapedItem> {
    const seenUrls = new Set<string>();

    for (const section of SECTIONS) {
      await this.rateLimiter.wait();
      const response = await fetchSimple(`${BASE_URL}${section}`);
      if (looksBlocked(response)) {
        continue;
      }

      for (const item of parseSection(response.html)) {
        if (seenUrls.has(item.url)) continue;
        seenUrls.add(item.url);

        const { publisherName, description } = splitAuthorAndDescription(item.authorAndDescription);

        yield {
          sourceUrl: item.url,
          title: item.title.trim(),
          description,
          // Dominio proprio sem mecanismo de cobranca visivel nesta secao —
          // sinal de gratuidade indireto (ausencia de paywall/checkout),
          // diferente de itch.io onde precisa de confirmacao positiva
          // explicita. Pipeline (Fase 4) ainda valida antes de publicar.
          isFreeOrPwyw: true,
          coverImageUrl: null,
          publisherName,
          // Site 100% pt-BR confirmado na pesquisa (spec.md), mas sem
          // metadado nativo por item — deixa null pro languageDetector
          // decidir por titulo/descricao (Fase 4), nao assume cegamente.
          sourceLanguageHint: null,
        };
      }
    }
  }
}

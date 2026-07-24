// Spec 084 (Fase 3) — contratos comuns a todos os adapters, pra o pipeline
// de criacao/dedupe (Fase 4, scraperIngest.ts) ser unico e nao replicado por
// fonte. Cada adapter conhece o parsing especifico do seu site; o pipeline
// so conhece este shape de saida.

export interface ScrapedItem {
  sourceUrl: string;
  title: string;
  description: string | null;
  isFreeOrPwyw: boolean;
  coverImageUrl: string | null;
  publisherName: string | null;
  // Sinal de idioma proprio da fonte, quando existir (ex.: itch.io tem
  // filtro nativo lang-pt-BR na URL de descoberta — ja resolve aqui, sem
  // precisar do fallback franc-min/DeepSeek da Fase 4). null quando a fonte
  // nao oferece nenhum sinal proprio — languageDetector decide sozinho.
  sourceLanguageHint: 'pt' | 'not_pt' | null;
}

export interface ScraperAdapter {
  sourcePlatform: string;
  discoverItems(): AsyncIterable<ScrapedItem>;
}

// Adapters de descoberta+indireção (RPG Grátis/Catarse/Newton Rocha): a
// pagina indexada e so um hub que aponta pra fonte real (itch.io, blog
// proprio etc.) — segue o link de saida antes de confirmar preco/idioma,
// nunca confia no hub como fonte final de metadado.
export interface DiscoveryAdapter extends ScraperAdapter {
  resolveOutboundUrl(hubUrl: string): Promise<string | null>;
}

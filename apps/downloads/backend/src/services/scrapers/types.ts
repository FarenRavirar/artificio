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
  scenario?: string | null;
  // Achado real (spec 086, Fase 4): onebookshelf.ts mapeava details.get('ruleSystem')
  // (texto bruto de SISTEMA/regra, ex. "D&D 5e") para 'scenario' — campo errado,
  // so notado agora que a Fase 4 precisa desse valor pra resolver taxonomia contra
  // o catalogo (scraperIngest.ts) e alimentar download_material.raw_system_hint
  // quando nao casa. 'scenario' continua so cenario de ambientacao (ex. "Forgotten
  // Realms"), nunca mais recebe sistema.
  systemHint?: string | null;
  authorsCredits?: string | null;
  artistsCredits?: string | null;
  creationMethod?: string | null;
  sourceFilters?: SourceFilter[];
  tags?: string[];
  fileSizeText?: string | null;
  format?: string | null;
  pageCount?: number | null;
  sourceCategory?: string | null;
  descriptionHtml?: string | null;
}

export interface SourceFilter {
  facet: string;
  path: string[];
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

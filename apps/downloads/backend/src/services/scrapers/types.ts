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
  // Evidência de idioma declarada pela fonte. Nunca é decisão positiva:
  // `not_pt` rejeita cedo; `pt` e `null` ainda passam pelo detector textual.
  sourceLanguageEvidence: 'pt' | 'not_pt' | null;
  scenario?: string | null;
  // Achado real (spec 086, Fase 4): onebookshelf.ts mapeava details.get('ruleSystem')
  // (texto bruto de SISTEMA/regra, ex. "D&D 5e") para 'scenario' — campo errado,
  // so notado agora que a Fase 4 precisa desse valor pra resolver taxonomia contra
  // o catalogo (scraperIngest.ts) e alimentar download_material.raw_system_hint
  // quando nao casa. 'scenario' continua so cenario de ambientacao (ex. "Forgotten
  // Realms"), nunca mais recebe sistema.
  // Spec 089 (T0.5): obrigatório no contrato interno. `null` afirma que a
  // fonte foi avaliada e não expõe um sinal inequívoco; omissão significa
  // adapter incompleto e deve falhar em compilação.
  systemHint: string | null;
  // Spec 088 (T2.9b, requisito 50) — hint de TIPO de material, mesmo desenho
  // do systemHint: obrigatório, `null` explicito quando a fonte nao expoe.
  // Antes deste campo a classificacao nunca existiu: `ScrapedItem` nao tinha
  // como carregar tipo, e o ingest resolvia DEFAULT_MATERIAL_TYPE_SLUG uma
  // vez por execucao e aplicava a todos os itens — 103 materiais rotulados
  // "Aventura" sem ninguem ter classificado nenhum. Nao e regressao: e
  // lacuna desde a origem do pipeline.
  // Valor bruto da fonte, no vocabulario dela ("Core Rulebooks", "Regras
  // basicas"); quem resolve contra a taxonomia central e o ingest.
  materialTypeHint: string | null;
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

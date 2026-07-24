// Spec 084 (Fase 3) — interface comum aos 2 engines headless (patchright
// Modo 2a, Camoufox Modo 2b). Parser de HTML resultante e codigo unico nos
// adapters — so o motor de renderizacao muda entre os dois.

export interface RenderedPage {
  html: string;
  status: number;
}

export interface HeadlessEngine {
  fetchRendered(url: string): Promise<RenderedPage>;
}

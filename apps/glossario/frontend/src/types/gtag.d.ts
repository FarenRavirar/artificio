// Declaração global para o Google Analytics GA4 (gtag.js)
// Necessário para TypeScript reconhecer window.gtag sem erros de compilação

interface Window {
  dataLayer: unknown[];
  gtag?: (...args: unknown[]) => void;
}

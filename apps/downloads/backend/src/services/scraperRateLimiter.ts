// T3.4 (spec 084) — rate-limit de SAIDA (protege o proprio Artificio de ser
// bloqueado/banido pelo terceiro), nao de entrada — nao reusa
// writeRateLimiter (esse e middleware Express contra abuso de quem chama a
// API do Artificio, direcao oposta). Delay simples entre itens da mesma run;
// cada adapter chama antes de cada request contra o terceiro.

const DEFAULT_DELAY_MS = 1500;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ScraperRateLimiter {
  constructor(private readonly delayMs: number = DEFAULT_DELAY_MS) {}

  async wait(): Promise<void> {
    await sleep(this.delayMs);
  }
}

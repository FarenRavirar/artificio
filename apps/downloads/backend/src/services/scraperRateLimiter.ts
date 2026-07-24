// T3.4 (spec 084) — rate-limit de SAIDA (protege o proprio Artificio de ser
// bloqueado/banido pelo terceiro), nao de entrada — nao reusa
// writeRateLimiter (esse e middleware Express contra abuso de quem chama a
// API do Artificio, direcao oposta). Delay simples entre itens da mesma run;
// cada adapter chama antes de cada request contra o terceiro.

const DEFAULT_DELAY_MS = 1500;
// Achado de review PR #193 (codeRabbit, nitpick): jitter evita padrao de
// delay perfeitamente constante entre requests (sinal facil de fingerprint
// por WAF) — soma ate 50% do delay base, sempre nao-negativo.
const JITTER_RATIO = 0.5;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ScraperRateLimiter {
  constructor(private readonly delayMs: number = DEFAULT_DELAY_MS) {}

  async wait(): Promise<void> {
    const jitter = Math.random() * this.delayMs * JITTER_RATIO;
    await sleep(this.delayMs + jitter);
  }
}

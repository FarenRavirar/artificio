import { chromium } from 'patchright';
import type { HeadlessEngine, RenderedPage } from './types';

// T3.3 (spec 084) — Modo 2a: headless Chromium via patchright (fork ativo
// do Playwright sem os leaks de automacao do Playwright puro — ver pesquisa
// dedicada em spec.md). Tentado antes do Camoufox (Modo 2b) por ser mais
// rapido; escalona pro Camoufox so se este falhar.
const NAVIGATION_TIMEOUT_MS = 30_000;

export class PatchrightEngine implements HeadlessEngine {
  async fetchRendered(url: string): Promise<RenderedPage> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
      const html = await page.content();
      return { html, status: response?.status() ?? 0 };
    } finally {
      await browser.close();
    }
  }
}

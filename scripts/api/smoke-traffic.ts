#!/usr/bin/env tsx
/**
 * Gera HAR de smoke com Playwright quando disponível.
 *
 * Configuração opcional: docs/api/api-smoke-routes.json
 * {
 *   "routes": [{ "url": "http://localhost:4321/", "waitUntil": "networkidle" }]
 * }
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CONFIG_PATH = resolve(REPO_ROOT, 'docs/api/api-smoke-routes.json');
const OUTPUT_HAR = resolve(REPO_ROOT, 'docs/api/api-traffic-smoke.har');

interface SmokeRoute {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

interface SmokeConfig {
  routes: SmokeRoute[];
}

async function loadPlaywright(): Promise<typeof import('playwright')> {
  try {
    return await import('playwright');
  } catch {
    console.error('Playwright não está instalado neste workspace. Instale quando for ativar smoke HAR automático: pnpm add -D -w playwright');
    process.exit(1);
  }
}

function loadConfig(): SmokeConfig {
  if (!existsSync(CONFIG_PATH)) {
    return { routes: [] };
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as SmokeConfig;
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.routes.length === 0) {
    console.log(`Nenhuma rota de smoke configurada em ${CONFIG_PATH}. HAR não gerado.`);
    return;
  }

  mkdirSync(resolve(REPO_ROOT, 'docs/api'), { recursive: true });
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ recordHar: { path: OUTPUT_HAR, content: 'omit' } });
  const page = await context.newPage();

  for (const route of config.routes) {
    console.log(`▶ smoke ${route.url}`);
    await page.goto(route.url, { waitUntil: route.waitUntil ?? 'networkidle', timeout: 30_000 });
  }

  await context.close();
  await browser.close();
  console.log(`✅ HAR gerado: ${OUTPUT_HAR}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

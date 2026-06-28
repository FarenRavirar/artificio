#!/usr/bin/env tsx
/**
 * scripts/api/build-docs.ts
 * api:docs — Gera documentação visual HTML a partir dos OpenAPI YAMLs.
 *
 * Usa Redocly CLI (já instalado: @redocly/cli) para gerar HTML self-contained
 * para cada API definida no redocly.yaml.
 *
 * Uso:
 *   pnpm api:docs                         # docs de todos os apps
 *   pnpm api:docs --app accounts          # docs de um app específico
 *
 * Saída:
 *   docs/api/generated/{app}-api-docs.html
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ═══════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════

const APPS = ['accounts', 'mesas', 'glossario', 'links'] as const;
const APP_SET = new Set<string>(APPS);
const OPENAPI_DIR = resolve(import.meta.dirname, '../../docs/api/openapi');
const OUTPUT_DIR = resolve(import.meta.dirname, '../../docs/api/generated');
const REPO_ROOT = resolve(import.meta.dirname, '../..');

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════

const APP_TITLES: Record<string, string> = {
  accounts: 'Accounts API — Artifício RPG',
  mesas: 'Mesas API — Artifício RPG',
  glossario: 'Glossário API — Artifício RPG',
  links: 'Links API — Artifício RPG',
};

function buildDocs(app: string): void {
  const yamlPath = join(OPENAPI_DIR, `${app}.openapi.yaml`);
  const outputPath = join(OUTPUT_DIR, `${app}-api-docs.html`);

  if (!existsSync(yamlPath)) {
    console.warn(`  ⚠️  ${app}: arquivo não encontrado (${yamlPath})`);
    return;
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const title = APP_TITLES[app] || `${app} API — Artifício RPG`;

  try {
    const pnpmExecPath = process.env.npm_execpath;
    const command = pnpmExecPath?.endsWith('.mjs') ? process.execPath : (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
    const commandArgs = [
      ...(pnpmExecPath?.endsWith('.mjs') ? [pnpmExecPath] : []),
      'exec',
      'redocly',
      'build-docs',
      yamlPath,
      '-o',
      outputPath,
      `--title=${title}`,
      '--disableGoogleFont',
    ];
    execFileSync(command, commandArgs, {
      encoding: 'utf-8',
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        REDOCLY_TELEMETRY: 'off',
        REDOCLY_SUPPRESS_UPDATE_NOTICE: 'true',
      },
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    console.log(`   ✅ ${app}: ${outputPath}`);
  } catch (err: any) {
    console.error(`   ❌ ${app}: erro ao gerar docs: ${err.message}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════════

function parseArgs(): { app: string | null } {
  const args = process.argv.slice(2);
  let app: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--app' && i + 1 < args.length) app = args[++i];
  }
  return { app };
}

function main(): void {
  const { app } = parseArgs();

  console.log(`\n📖 api:docs — Documentação visual OpenAPI\n`);

  if (app && !APP_SET.has(app)) {
    console.error(`   ❌ App inválido: ${app}`);
    console.error(`   Apps válidos: ${APPS.join(', ')}`);
    process.exit(1);
  }

  const appsToBuild = app ? [app] : APPS;

  for (const appName of appsToBuild) {
    buildDocs(appName);
  }

  console.log(`\n   Para visualizar, abra os arquivos HTML no browser.\n`);
}

main();

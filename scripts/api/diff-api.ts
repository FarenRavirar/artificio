#!/usr/bin/env tsx
/**
 * scripts/api/diff-api.ts
 * api:diff — Detecta breaking changes entre versões do OpenAPI.
 *
 * Compara a versão atual de cada YAML contra a versão no branch base (git),
 * usando openapi-diff para classificar mudanças como breaking / non-breaking / unclassified.
 *
 * Uso:
 *   pnpm api:diff                         # diff de todos apps vs dev
 *   pnpm api:diff --app accounts          # diff de um app específico
 *   pnpm api:diff --base main             # diff vs branch específico
 *   pnpm api:diff --old a.yaml --new b.yaml  # diff de arquivos arbitrários
 *
 * Exit code:
 *   0 = sem breaking changes
 *   1 = breaking changes detectados (não bloqueia CI no modo inicial)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

// ═══════════════════════════════════════════════
//  TIPOS
// ═══════════════════════════════════════════════

interface DiffChange {
  type: 'breaking' | 'non-breaking' | 'unclassified';
  action: string;
  code: string;
  entity: string;
  destinationSpecEntityDetails?: Array<{
    location: string;
  }>;
  sourceSpecEntityDetails?: Array<{
    location: string;
  }>;
}

interface DiffResult {
  summary: {
    breaking: number;
    'non-breaking': number;
    unclassified: number;
  };
  differences: DiffChange[];
}

interface AppDiff {
  app: string;
  breaking: number;
  nonBreaking: number;
  unclassified: number;
  changes: DiffChange[];
}

// ═══════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════

const APPS = ['accounts', 'mesas', 'glossario', 'links'];
const OPENAPI_DIR = resolve(import.meta.dirname, '../../docs/api/openapi');
const OUTPUT_DIR = resolve(import.meta.dirname, '../../docs/api/generated');
const DEFAULT_BASE = process.env.GITHUB_BASE_REF || 'dev';

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════

function getBaseVersion(filePath: string, baseBranch: string): string | null {
  const relativePath = filePath.replace(/\\/g, '/');
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' })
    .trim()
    .replace(/\\/g, '/');
  const repoRelative = relativePath.startsWith(repoRoot)
    ? relativePath.slice(repoRoot.length + 1)
    : relativePath;

  const refs = baseBranch.includes('/') ? [baseBranch] : [baseBranch, `origin/${baseBranch}`];
  for (const ref of refs) {
    try {
      return execFileSync('git', ['show', `${ref}:${repoRelative}`], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch {
      // Tenta próximo ref. Se nenhum existir, o arquivo é novo no branch base.
    }
  }
  return null;
}

function runOpenapiDiff(oldFile: string, newFile: string): DiffResult {
  const pnpmExecPath = process.env.npm_execpath;
  const command = pnpmExecPath?.endsWith('.mjs') ? process.execPath : (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const commandArgs = [
    ...(pnpmExecPath?.endsWith('.mjs') ? [pnpmExecPath] : []),
    'exec',
    'openapi-diff',
    oldFile,
    newFile,
  ];
  const stdout = execFileSync(command, commandArgs, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore'],
  }).trim();

  const jsonStart = stdout.indexOf('{');
  if (jsonStart < 0) {
    throw new Error(`openapi-diff não retornou JSON parseável. Saída: ${stdout.slice(0, 500)}`);
  }

  try {
    return JSON.parse(stdout.slice(jsonStart)) as DiffResult;
  } catch (error) {
    throw new Error(
      `Falha ao parsear saída JSON do openapi-diff: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function writeTempFile(content: string, suffix: string): string {
  const tmpDir = resolve(import.meta.dirname, '../../.tmp');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `openapi-diff-${suffix}.yaml`);
  writeFileSync(tmpPath, content, 'utf-8');
  return tmpPath;
}

// ═══════════════════════════════════════════════
//  REPORT GENERATION
// ═══════════════════════════════════════════════

function generateReport(appDiffs: AppDiff[], baseBranch: string): string {
  const now = new Date().toISOString();
  const totalBreaking = appDiffs.reduce((s, d) => s + d.breaking, 0);
  const totalNonBreaking = appDiffs.reduce((s, d) => s + d.nonBreaking, 0);
  const totalUnclassified = appDiffs.reduce((s, d) => s + d.unclassified, 0);

  let md = `# Relatório de Breaking Changes — api:diff\n\n`;
  md += `**Gerado em:** ${now}\n`;
  md += `**Base:** ${baseBranch}\n`;
  md += `**Modo:** inicial (não bloqueante)\n\n`;
  md += `---\n\n`;

  if (totalBreaking === 0 && totalNonBreaking === 0 && totalUnclassified === 0) {
    md += `✅ **Nenhuma mudança detectada entre a versão atual e ${baseBranch}.**\n\n`;
    return md;
  }

  // Summary
  md += `## Sumário\n\n`;
  md += `| App | Breaking | Non-breaking | Unclassified |\n`;
  md += `|-----|:--------:|:------------:|:------------:|\n`;
  for (const d of appDiffs) {
    if (d.breaking > 0 || d.nonBreaking > 0 || d.unclassified > 0) {
      const breakingIcon = d.breaking > 0 ? '❌' : '✅';
      md += `| ${d.app} | ${breakingIcon} ${d.breaking} | ✅ ${d.nonBreaking} | ⚪ ${d.unclassified} |\n`;
    }
  }
  md += '\n';

  // Details per app
  for (const d of appDiffs) {
    if (d.changes.length === 0) continue;

    md += `---\n\n### ${d.app}\n\n`;

    const breaking = d.changes.filter(c => c.type === 'breaking');
    const nonBreaking = d.changes.filter(c => c.type === 'non-breaking');
    const unclassified = d.changes.filter(c => c.type === 'unclassified');

    if (breaking.length > 0) {
      md += `#### ❌ Breaking Changes (${breaking.length})\n\n`;
      md += `| Path | Method | Ação | Código |\n`;
      md += `|------|--------|------|--------|\n`;
      for (const c of breaking) {
        const location = extractLocation(c);
        md += `| \`${location.path}\` | ${location.method} | ${c.action} | \`${c.code}\` |\n`;
      }
      md += '\n';
    }

    if (nonBreaking.length > 0) {
      md += `#### ✅ Non-breaking (${nonBreaking.length})\n\n`;
      md += `| Path | Method | Ação |\n`;
      md += `|------|--------|------|\n`;
      // Only show first 20 non-breaking to avoid huge report
      const shown = nonBreaking.slice(0, 20);
      for (const c of shown) {
        const location = extractLocation(c);
        md += `| \`${location.path}\` | ${location.method} | ${c.action} |\n`;
      }
      if (nonBreaking.length > 20) {
        md += `| ... | ... | +${nonBreaking.length - 20} mais |\n`;
      }
      md += '\n';
    }

    if (unclassified.length > 0) {
      md += `#### ⚪ Unclassified (${unclassified.length})\n\n`;
      md += `| Path | Method | Ação |\n`;
      md += `|------|--------|------|\n`;
      for (const c of unclassified) {
        const location = extractLocation(c);
        md += `| \`${location.path}\` | ${location.method} | ${c.action} |\n`;
      }
      md += '\n';
    }
  }

  return md;
}

function extractLocation(change: DiffChange): { path: string; method: string } {
  let path = '';
  let method = '';

  // Try destination first, then source
  const details = change.destinationSpecEntityDetails?.[0] || change.sourceSpecEntityDetails?.[0];
  if (details?.location) {
    // Location format: "paths./api/v1/tables.{slug}.get.operationId"
    const loc = details.location;
    const methodMatch = loc.match(/\.(get|post|put|patch|delete|head|options)(?:\.|$)/);
    if (methodMatch) {
      method = methodMatch[1].toUpperCase();
    }
    const pathPrefix = 'paths.';
    const pathStart = loc.indexOf(pathPrefix);
    if (pathStart >= 0 && methodMatch?.index !== undefined) {
      const rawPath = loc.slice(pathStart + pathPrefix.length, methodMatch.index);
      path = rawPath.replace(/\./g, '/').replace(/\{([^}]+)\}/g, ':$1');
    }
  }

  return { path, method };
}

// ═══════════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════════

function parseArgs(): {
  app: string | null;
  base: string;
  oldFile: string | null;
  newFile: string | null;
} {
  const args = process.argv.slice(2);
  let app: string | null = null;
  let base = DEFAULT_BASE;
  let oldFile: string | null = null;
  let newFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--app' && i + 1 < args.length) app = args[++i];
    else if (args[i] === '--base' && i + 1 < args.length) base = args[++i];
    else if (args[i] === '--old' && i + 1 < args.length) oldFile = args[++i];
    else if (args[i] === '--new' && i + 1 < args.length) newFile = args[++i];
  }

  return { app, base, oldFile, newFile };
}

function main(): void {
  const { app, base, oldFile, newFile } = parseArgs();

  console.log(`\n🔍 api:diff — Breaking changes OpenAPI\n`);
  console.log(`   Base: ${base}`);

  // ── Modo de comparação de arquivos arbitrários ──
  if (oldFile && newFile) {
    const resolvedOld = resolve(oldFile);
    const resolvedNew = resolve(newFile);
    if (!existsSync(resolvedOld)) { console.error(`  ❌ Arquivo não encontrado: ${resolvedOld}`); process.exit(1); }
    if (!existsSync(resolvedNew)) { console.error(`  ❌ Arquivo não encontrado: ${resolvedNew}`); process.exit(1); }

    console.log(`   Comparando: ${basename(resolvedOld)} vs ${basename(resolvedNew)}`);
    const result = runOpenapiDiff(resolvedOld, resolvedNew);
    console.log(`   📊 Breaking: ${result.summary.breaking} | Non-breaking: ${result.summary['non-breaking']} | Unclassified: ${result.summary.unclassified}`);
    process.exit(result.summary.breaking > 0 ? 1 : 0);
  }

  // ── Modo normal: diff de YAMLs vs git base ──
  const appsToDiff = app ? [app] : APPS;
  const appDiffs: AppDiff[] = [];

  for (const appName of appsToDiff) {
    const yamlPath = join(OPENAPI_DIR, `${appName}.openapi.yaml`);

    if (!existsSync(yamlPath)) {
      console.warn(`  ⚠️  ${appName}: arquivo não encontrado (${yamlPath})`);
      continue;
    }

    // Obter versão base do git
    const baseContent = getBaseVersion(yamlPath, base);

    if (!baseContent) {
      console.log(`   ℹ️  ${appName}: arquivo novo (não existe em ${base}) — todas as rotas são adições`);
      appDiffs.push({ app: appName, breaking: 0, nonBreaking: 0, unclassified: 0, changes: [] });
      continue;
    }

    // Escrever versão base em temp file
    const tmpOld = writeTempFile(baseContent, `${appName}-base`);
    const result = runOpenapiDiff(tmpOld, yamlPath);

    appDiffs.push({
      app: appName,
      breaking: result.summary.breaking,
      nonBreaking: result.summary['non-breaking'],
      unclassified: result.summary.unclassified,
      changes: result.differences || [],
    });

    console.log(`   ${appName}: breaking=${result.summary.breaking} non-breaking=${result.summary['non-breaking']} unclassified=${result.summary.unclassified}`);
  }

  // ── Gerar relatório ──
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportPath = join(OUTPUT_DIR, 'api-diff.generated.md');
  const report = generateReport(appDiffs, base);
  writeFileSync(reportPath, report, 'utf-8');

  console.log(`   📝 Relatório: ${reportPath}`);

  // Exit code: 0 no modo inicial (breaking changes só geram relatório, não bloqueiam)
  const hasBreaking = appDiffs.some(d => d.breaking > 0);
  if (hasBreaking) {
    console.log(`   ⚠️  Breaking changes detectados (modo inicial — relatório apenas)`);
  }
  console.log(`   🏁 Exit code: 0\n`);
}

main();

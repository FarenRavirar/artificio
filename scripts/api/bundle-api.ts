#!/usr/bin/env tsx
/**
 * api:bundle — Consolida os OpenAPI por-app num artefato único descobrível por
 * agentes de IA (DEB-055-24).
 *
 * Entradas: docs/api/openapi/*.openapi.yaml (contratos por app, com x-artificio-*).
 * Saídas (determinísticas, sem timestamp volátil):
 *   - docs/api/generated/artificio-api.bundle.json  — índice machine-readable único
 *   - docs/api/generated/api-index.generated.md      — tabela navegável app×método×path
 *
 * Uso: pnpm api:bundle
 *
 * Regra para agentes: ESTE bundle é a fonte primária de descoberta de API.
 * Não usar memória de chat nem mapas manuais como fonte de verdade.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const OPENAPI_DIR = path.join(REPO_ROOT, 'docs/api/openapi');
const OUT_DIR = path.join(REPO_ROOT, 'docs/api/generated');
const GENERATED_AT = process.env.API_GENERATED_AT || '1970-01-01T00:00:00.000Z';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

interface Operation {
  app: string;
  method: string;
  path: string;
  summary: string;
  owner: string;
  scope: string;
  status: string;
  auth: string;
  consumers: string[];
  operationId: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function collectOperations(): Operation[] {
  if (!fs.existsSync(OPENAPI_DIR)) return [];
  const files = fs.readdirSync(OPENAPI_DIR)
    .filter((f) => f.endsWith('.openapi.yaml') || f.endsWith('.openapi.yml'))
    .sort();

  const ops: Operation[] = [];

  for (const file of files) {
    const app = file.replace(/\.openapi\.(yaml|yml)$/, '');
    let doc: unknown;
    try {
      doc = yamlLoad(fs.readFileSync(path.join(OPENAPI_DIR, file), 'utf-8'));
    } catch (err) {
      console.error(`  ❌ Erro ao parsear ${file}: ${(err as Error).message}`);
      continue;
    }
    if (!doc || typeof doc !== 'object') continue;
    const paths = (doc as Record<string, unknown>).paths;
    if (!paths || typeof paths !== 'object') continue;

    for (const [routePath, methodsRaw] of Object.entries(paths as Record<string, unknown>)) {
      if (!methodsRaw || typeof methodsRaw !== 'object') continue;
      const methods = methodsRaw as Record<string, unknown>;
      for (const method of HTTP_METHODS) {
        const opRaw = methods[method];
        if (!opRaw || typeof opRaw !== 'object') continue;
        const op = opRaw as Record<string, unknown>;
        ops.push({
          app,
          method: method.toUpperCase(),
          path: routePath,
          summary: str(op.summary),
          owner: str(op['x-artificio-owner']),
          scope: str(op['x-artificio-scope']),
          status: str(op['x-artificio-status']),
          auth: str(op['x-artificio-auth']),
          consumers: asStringArray(op['x-artificio-consumers']),
          operationId: str(op.operationId),
        });
      }
    }
  }

  // Ordenação estável: app, path, método
  ops.sort((a, b) =>
    a.app.localeCompare(b.app) ||
    a.path.localeCompare(b.path) ||
    a.method.localeCompare(b.method));

  return ops;
}

function writeBundle(ops: Operation[]): void {
  const byApp = new Map<string, number>();
  for (const op of ops) byApp.set(op.app, (byApp.get(op.app) || 0) + 1);

  const bundle = {
    $schema: 'https://artificiorpg.com/schemas/api-bundle.v1.json',
    _description:
      'Índice único e machine-readable de todas as APIs do Artifício RPG. ' +
      'Fonte primária de descoberta para agentes de IA. Gerado por scripts/api/bundle-api.ts ' +
      'a partir dos contratos OpenAPI por-app. Não editar à mão.',
    generatedAt: GENERATED_AT,
    apps: Object.fromEntries([...byApp.entries()].sort()),
    total: ops.length,
    operations: ops,
  };

  const outPath = path.join(OUT_DIR, 'artificio-api.bundle.json');
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
  console.log(`✅ Bundle: ${path.relative(REPO_ROOT, outPath)} (${ops.length} operações, ${byApp.size} apps)`);
}

function writeIndexMarkdown(ops: Operation[]): void {
  let md = `# Índice de API — Artifício RPG (gerado)\n\n`;
  md += `> **Fonte primária de descoberta de API para agentes de IA.** Gerado por \`scripts/api/bundle-api.ts\`.\n`;
  md += `> Bundle machine-readable: \`docs/api/generated/artificio-api.bundle.json\`.\n`;
  md += `> Não editar à mão. Regenerar com \`pnpm api:bundle\` (faz parte de \`pnpm verify:api\`).\n\n`;
  md += `Total: **${ops.length} operações**.\n\n`;

  const apps = [...new Set(ops.map((o) => o.app))].sort();
  for (const app of apps) {
    const appOps = ops.filter((o) => o.app === app);
    md += `## ${app} (${appOps.length})\n\n`;
    md += `| Método | Path | Scope | Auth | Status | Consumidores | Resumo |\n`;
    md += `|--------|------|-------|------|--------|--------------|--------|\n`;
    for (const o of appOps) {
      const cons = o.consumers.length ? o.consumers.join(', ') : '—';
      md += `| ${o.method} | \`${o.path}\` | ${o.scope || '—'} | ${o.auth || '—'} | ${o.status || '—'} | ${cons} | ${o.summary || '—'} |\n`;
    }
    md += `\n`;
  }

  const outPath = path.join(OUT_DIR, 'api-index.generated.md');
  fs.writeFileSync(outPath, md, 'utf-8');
  console.log(`✅ Índice: ${path.relative(REPO_ROOT, outPath)}`);
}

function main(): void {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const ops = collectOperations();
  if (ops.length === 0) {
    console.error('  ⚠️  Nenhuma operação OpenAPI encontrada. Rode pnpm api:generate-openapi antes.');
    process.exit(1);
  }
  writeBundle(ops);
  writeIndexMarkdown(ops);
  console.log(`\n✅ api:bundle concluído`);
}

main();

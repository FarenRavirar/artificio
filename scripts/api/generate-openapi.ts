/**
 * scripts/api/generate-openapi.ts
 * Gera OpenAPI 3.0.3 YAMLs mínimos para cada app a partir do inventory.json.
 * Usa heurísticas de path para classificar x-artificio-*.
 *
 * Uso: npx tsx scripts/api/generate-openapi.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const INVENTORY_PATH = join(REPO_ROOT, 'docs/api/generated/api-inventory.generated.json');
const OUTPUT_DIR = join(REPO_ROOT, 'docs/api/openapi');

// ── Classificação heurística ──

interface Classification {
  owner: string;
  scope: string;
  status: string;
  auth: string;
  consumers: string[];
}

function classifyRoute(method: string, path: string, app: string): Classification {
  const p = path.toLowerCase();

  // Health checks → internal
  if (/(^|\/)(health|healthz)$/.test(p)) {
    return { owner: app, scope: 'internal', status: 'active', auth: 'none', consumers: [] };
  }

  // Admin paths
  if (/(^|\/)admin(\/|$)/.test(p)) {
    return { owner: app, scope: 'admin', status: 'active', auth: 'admin', consumers: [] };
  }

  // Accounts auth (cross-app — consumed by other frontends)
  if (app === 'accounts' && p.includes('/api/auth/')) {
    if (p.includes('/me') || p.includes('/refresh') || p.includes('/logout')) {
      return { owner: app, scope: 'cross-app', status: 'active', auth: 'user', consumers: ['mesas-frontend', 'glossario-frontend', 'links-frontend', 'site-admin'] };
    }
    // Google OAuth redirects — public (user not yet authenticated)
    if (p.includes('/google')) {
      return { owner: app, scope: 'public', status: 'active', auth: 'none', consumers: [] };
    }
    return { owner: app, scope: 'public', status: 'active', auth: 'none', consumers: [] };
  }

  // Accounts secrets (admin)
  if (app === 'accounts' && p.includes('/admin/secrets')) {
    return { owner: app, scope: 'admin', status: 'active', auth: 'admin', consumers: [] };
  }

  // Accounts SPA routes
  if (app === 'accounts' && (p === '/' || p === '/login' || p === '/conta')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'none', consumers: [] };
  }

  // Auth routes in mesas/glossario (authenticated)
  if (p.includes('/auth/')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
  }

  // GM routes (mesas)
  if (p.includes('/gm/') || p.includes('/vtt-platforms') || p.includes('/communication-platforms')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
  }

  // Profile/Me routes
  if (p.includes('/profile') || /(^|\/)me(\/|$)/.test(p)) {
    return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
  }

  // Notifications
  if (p.includes('/notifications')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
  }

  // Dev feedback
  if (p.includes('/dev-feedback')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
  }

  // Settings
  if (p.includes('/settings') || p.includes('/suggest')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
  }

  // Upload
  if (p.includes('/upload')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
  }

  // OG tags (SSR)
  if (p.includes('/og/')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'none', consumers: [] };
  }

  // Changelog
  if (p.includes('/changelog')) {
    return { owner: app, scope: 'public', status: 'active', auth: 'none', consumers: [] };
  }

  // Data routes (GET = public read, POST/PUT/PATCH/DELETE = user write)
  if (method === 'GET') {
    return { owner: app, scope: 'public', status: 'active', auth: 'none', consumers: [] };
  }

  // POST/PUT/PATCH/DELETE on data routes → authenticated user
  return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
}

// ── Converter Express path para OpenAPI path ──

function expressToOpenApiPath(path: string): string {
  return path
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
    .replace(/\{\*([a-zA-Z_][a-zA-Z0-9_]*)\}/g, '{$1}');
}

/** Skip catch-all Express 5 patterns ({*splat}) — not API routes */
function isCatchAllRoute(path: string): boolean {
  return path.includes('{*') || path.includes('/*');
}

// ── Gerar YAML ──

interface RouteEntry {
  app: string;
  method: string;
  path: string;
  sourceFile: string;
  line?: number;
  confidence: string;
  kind: string;
}

const KNOWN_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function generateOpenApi(appName: string, routes: RouteEntry[]): string {
  // Servers por app
  const servers: { url: string; description: string }[] = [];
  if (appName === 'accounts') {
    servers.push(
      { url: 'https://accounts.artificiorpg.com', description: 'Produção' },
      { url: 'http://localhost:4000', description: 'Desenvolvimento' }
    );
  } else if (appName === 'mesas') {
    servers.push(
      { url: 'https://mesas.artificiorpg.com', description: 'Produção' },
      { url: 'http://localhost:4000', description: 'Desenvolvimento' }
    );
  } else if (appName === 'glossario') {
    servers.push(
      { url: 'https://glossario.artificiorpg.com', description: 'Produção' },
      { url: 'http://localhost:3000', description: 'Desenvolvimento' }
    );
  } else if (appName === 'links') {
    servers.push(
      { url: 'https://links.artificiorpg.com', description: 'Produção' },
      { url: 'http://localhost:3001', description: 'Desenvolvimento' }
    );
  }

  const appTitle = appName.charAt(0).toUpperCase() + appName.slice(1);

  let yaml = `# Gerado automaticamente por scripts/api/generate-openapi.ts
# A partir do inventário: docs/api/generated/api-inventory.generated.json
openapi: "3.0.3"
info:
  title: "${appTitle} API — Artifício RPG"
  description: "API do módulo ${appTitle}. Metadados x-artificio-* definidos por heurística de path."
  version: "0.1.0"
servers:
`;

  for (const s of servers) {
    yaml += `  - url: ${s.url}\n    description: ${s.description}\n`;
  }

  yaml += 'security: []\n';
  yaml += 'paths:\n';

  // Agrupar por path, depois por método
  const pathMap = new Map<string, RouteEntry[]>();
  for (const r of routes) {
    if (r.kind === 'mount' || r.method === 'USE') continue; // Ignorar USE/mount no OpenAPI
    if (isCatchAllRoute(r.path)) continue; // Ignorar catch-all ({*splat})
    const oaPath = expressToOpenApiPath(r.path);
    if (!pathMap.has(oaPath)) pathMap.set(oaPath, []);
    pathMap.get(oaPath)!.push(r);
  }

  // Ordenar paths
  const sortedPaths = [...pathMap.keys()].sort();

  for (const oaPath of sortedPaths) {
    const entries = pathMap.get(oaPath)!;
    yaml += `  ${oaPath}:\n`;

    for (const entry of entries) {
      const method = entry.method.toLowerCase();
      if (!KNOWN_METHODS.includes(method)) continue;

      const cls = classifyRoute(entry.method, entry.path, entry.app);
      const opId = `${method}${oaPath.replace(/[\/{}]/g, '_').replace(/_{2,}/g, '_').replace(/^_/, '').replace(/_$/, '').replace(/_(\d+)/g, '_$1')}`.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '') || method;

      yaml += `    ${method}:\n`;
      yaml += `      operationId: ${opId}\n`;
      yaml += `      x-artificio-owner: ${cls.owner}\n`;
      yaml += `      x-artificio-scope: ${cls.scope}\n`;
      yaml += `      x-artificio-status: ${cls.status}\n`;
      yaml += `      x-artificio-auth: ${cls.auth}\n`;
      if (cls.consumers.length > 0) {
        yaml += `      x-artificio-consumers:\n`;
        for (const c of cls.consumers) {
          yaml += `        - ${c}\n`;
        }
      }
      if (oaPath.includes('{')) {
        // Extract param names from path template
        const paramNames = [...oaPath.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
        if (paramNames.length > 0) {
          yaml += `      parameters:\n`;
          for (const pname of paramNames) {
            yaml += `        - name: ${pname}\n`;
            yaml += `          in: path\n`;
            yaml += `          required: true\n`;
            yaml += `          schema:\n`;
            yaml += `            type: string\n`;
          }
        }
      }
      yaml += `      responses:\n`;
      yaml += `        "200":\n`;
      yaml += `          description: OK\n`;
    }
  }

  return yaml;
}

// ── Main ──

function main() {
  if (!existsSync(INVENTORY_PATH)) {
    console.error(`❌ Inventory não encontrado: ${INVENTORY_PATH}`);
    console.error('   Execute pnpm api:inventory primeiro.');
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(INVENTORY_PATH, 'utf-8'));
  const allRoutes: RouteEntry[] = data.routes || data;

  if (!Array.isArray(allRoutes)) {
    console.error('❌ Inventory JSON não contém array de rotas.');
    process.exit(1);
  }

  // Agrupar por app
  const byApp = new Map<string, RouteEntry[]>();
  for (const r of allRoutes) {
    if (!byApp.has(r.app)) byApp.set(r.app, []);
    byApp.get(r.app)!.push(r);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const [appName, routes] of byApp) {
    const yaml = generateOpenApi(appName, routes);
    const filePath = join(OUTPUT_DIR, `${appName}.openapi.yaml`);
    writeFileSync(filePath, yaml, 'utf-8');
    console.log(`✅ ${filePath} — ${routes.filter(r => r.method !== 'USE').length} rotas HTTP`);
  }

  console.log('\n📊 Gerado para: ' + [...byApp.keys()].join(', '));
}

main();

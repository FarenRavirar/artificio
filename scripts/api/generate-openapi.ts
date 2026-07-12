/**
 * scripts/api/generate-openapi.ts
 * Gera OpenAPI 3.0.3 YAMLs mínimos para cada app a partir do inventory.json.
 * Usa heurísticas de path para classificar x-artificio-*.
 *
 * Uso: npx tsx scripts/api/generate-openapi.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { byLocale, byEntryKey } from './sort-utils';
import { moduleOrigin } from '../../packages/config/src/brand';

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
      return { owner: app, scope: 'external', status: 'active', auth: 'none', consumers: [] };
    }
    return { owner: app, scope: 'public', status: 'active', auth: 'none', consumers: [] };
  }

  // Accounts secrets (admin)
  if (app === 'accounts' && p.includes('/admin/secrets')) {
    return { owner: app, scope: 'admin', status: 'active', auth: 'admin', consumers: [] };
  }

  // Accounts SPA routes
  if (app === 'accounts' && (p === '/' || p === '/login' || p === '/conta')) {
    return { owner: app, scope: 'public-page', status: 'active', auth: 'none', consumers: [] };
  }

  // Auth routes in mesas/glossario (authenticated)
  if (p.includes('/auth/')) {
    if (p.includes('/google') || p.includes('/discord/connect') || p.includes('/discord/callback')) {
      return { owner: app, scope: 'external', status: 'active', auth: 'none', consumers: [] };
    }
    if (p.includes('/logout') || p.includes('/verify-covil')) {
      return { owner: app, scope: 'self-service', status: 'active', auth: 'user', consumers: [] };
    }
    if (app === 'glossario' && (p.includes('/login') || p.includes('/register'))) {
      return { owner: app, scope: 'legacy', status: 'legacy', auth: 'none', consumers: [] };
    }
    return { owner: app, scope: 'public', status: 'active', auth: 'user', consumers: [] };
  }

  // SSR/pages and browser navigation endpoints are not consumed by JS API clients.
  if (p === '/' || p === '/login' || p === '/conta' || p.startsWith('/grupo/')) {
    return { owner: app, scope: 'public-page', status: 'active', auth: 'none', consumers: [] };
  }

  // User self-service APIs may be reached from conditional UI flows or future panels.
  if (
    p.includes('/mine') ||
    p.includes('/suggest') ||
    p.includes('/suggestions') ||
    p.includes('/connect/discord') ||
    p.includes('/profile/me/discord')
  ) {
    return { owner: app, scope: 'self-service', status: 'active', auth: 'user', consumers: [] };
  }

  // Engagement/analytics endpoints are triggered by UI events and keepalive calls.
  if (p.endsWith('/click') || p.endsWith('/contact') || p.endsWith('/favorite') || p.endsWith('/view')) {
    return { owner: app, scope: 'telemetry', status: 'active', auth: 'none', consumers: [] };
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
    return { owner: app, scope: 'media', status: 'active', auth: 'none', consumers: [] };
  }

  // Links detail API feeds the SSR/detail page and may not appear as a frontend fetch.
  if (app === 'links' && p.startsWith('/api/groups/') && method === 'GET') {
    return { owner: app, scope: 'public-page', status: 'active', auth: 'none', consumers: [] };
  }

  // Glossário taxonomy writes are guarded by auth/admin middleware in route files.
  if (
    app === 'glossario' &&
    (method === 'PUT' || method === 'DELETE') &&
    (p.startsWith('/api/categories') || p.startsWith('/api/scenarios') || p.startsWith('/api/systems'))
  ) {
    return { owner: app, scope: 'admin', status: 'active', auth: 'admin', consumers: [] };
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

function operationIdFor(method: string, path: string, usedOperationIds: Set<string>): string {
  const base =
    `${method}${path.replace(/[\/{}]/g, '_').replace(/_{2,}/g, '_').replace(/^_/, '').replace(/_$/, '').replace(/_(\d+)/g, '_$1')}`
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '') || method;

  let candidate = base;
  let suffix = 2;
  while (usedOperationIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }

  usedOperationIds.add(candidate);
  return candidate;
}

function summaryFor(method: string, path: string): string {
  const verb: Record<string, string> = {
    get: 'Consulta',
    post: 'Cria ou executa',
    put: 'Substitui',
    patch: 'Atualiza',
    delete: 'Remove',
    head: 'Consulta metadados de',
    options: 'Lista opções de',
  };
  const normalized = path
    .replace(/[{}]/g, '')
    .replace(/\/+/g, ' ')
    .replace(/_/g, ' ')
    .trim();
  return `${verb[method] ?? method.toUpperCase()} ${normalized || 'raiz'}`;
}

function shouldHaveRequestBody(method: string, path?: string): boolean {
  return method === 'post' || method === 'put' || method === 'patch' || (method === 'delete' && path === '/api/account');
}

function appendIndented(lines: string[], indent: string, values: string[]): void {
  for (const value of values) lines.push(`${indent}${value}`);
}

function appendRequestBody(
  lines: string[],
  required: boolean,
  property?: { name: string; lines: string[] },
): void {
  appendIndented(lines, ``, [
    `      requestBody:`,
    `        required: ${required ? 'true' : 'false'}`,
    `        content:`,
    `          application/json:`,
    `            schema:`,
    `              type: object`,
  ]);
  if (!property) {
    lines.push(`              additionalProperties: true`);
    return;
  }
  appendIndented(lines, ``, [
    `              required: [${property.name}]`,
    `              properties:`,
    `                ${property.name}:`,
  ]);
  appendIndented(lines, `                  `, property.lines);
}

function appendGenericRequestBody(lines: string[]): void {
  appendRequestBody(lines, false);
}

function appendRequiredJsonBody(lines: string[], property: string, propertyLines: string[]): void {
  appendRequestBody(lines, true, { name: property, lines: propertyLines });
}

function appendAccountRequestBody(lines: string[], method: string, path: string): boolean {
  if (method === 'delete' && path === '/api/account') {
    appendRequiredJsonBody(lines, "confirm", ["type: string", "format: email"]);
    return true;
  }
  if (method === 'patch' && path === '/api/account/avatar') {
    appendRequiredJsonBody(lines, "dataUrl", ["type: string", "description: Data URL base64 PNG, JPEG ou WebP ate 2MB"]);
    return true;
  }
  return false;
}

function appendGenericResponses(lines: string[]): void {
  lines.push(`      responses:`);
  appendResponse(lines, "200", "OK", true);
  appendResponse(lines, "400", "Requisição inválida", true);
  appendResponse(lines, "401", "Não autenticado");
  appendResponse(lines, "403", "Sem permissão");
  appendResponse(lines, "500", "Erro interno");
}

function appendJsonObjectContent(lines: string[]): void {
  appendIndented(lines, ``, [
    `          content:`,
    `            application/json:`,
    `              schema:`,
    `                type: object`,
    `                additionalProperties: true`,
  ]);
}

function appendResponse(lines: string[], status: string, description: string, jsonObject = false): void {
  lines.push(`        "${status}":`);
  lines.push(`          description: ${description}`);
  if (jsonObject) appendJsonObjectContent(lines);
}

function appendResponses(
  lines: string[],
  responses: Array<{ status: string; description: string; jsonObject?: boolean }>,
): void {
  lines.push(`      responses:`);
  for (const response of responses) {
    appendResponse(lines, response.status, response.description, response.jsonObject);
  }
}

function appendAccountResponses(lines: string[], method: string, path: string): boolean {
  if (method === 'delete' && path === '/api/account') {
    appendResponses(lines, [
      { status: "204", description: "Conta removida e sessao limpa" },
      { status: "400", description: "Confirmacao invalida", jsonObject: true },
      { status: "401", description: "Não autenticado", jsonObject: true },
      { status: "403", description: "Sem permissão", jsonObject: true },
      { status: "500", description: "Erro interno", jsonObject: true },
    ]);
    return true;
  }
  if (method === 'patch' && path === '/api/account/avatar') {
    appendResponses(lines, [
      { status: "200", description: "Avatar atualizado", jsonObject: true },
      { status: "400", description: "Avatar invalido", jsonObject: true },
      { status: "401", description: "Não autenticado", jsonObject: true },
      { status: "403", description: "Sem permissão", jsonObject: true },
      { status: "503", description: "Armazenamento de midia indisponivel", jsonObject: true },
      { status: "500", description: "Erro interno", jsonObject: true },
    ]);
    return true;
  }
  return false;
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

function generateOpenApi(appName: string, routes: RouteEntry[], overlayPath?: string): string {
  // Servers por app — origin público canônico vem de @artificio/config (fonte única;
  // não hardcodar URL de subdomínio). Importado do source p/ não exigir build no CI.
  const SERVER_CONFIG: Record<string, { prod: string; prodLabel: string; devPort: number }> = {
    accounts:  { prod: moduleOrigin('accounts'),  prodLabel: 'Produção',        devPort: 4000 },
    downloads: { prod: moduleOrigin('downloads'), prodLabel: 'Produção',        devPort: 3004 },
    mesas:     { prod: moduleOrigin('mesas'),     prodLabel: 'Produção',        devPort: 4000 },
    glossario: { prod: moduleOrigin('glossario'), prodLabel: 'Produção',        devPort: 3000 },
    links:     { prod: moduleOrigin('links'),     prodLabel: 'Produção',        devPort: 3001 },
    site:      { prod: moduleOrigin('beta'),      prodLabel: 'Produção (beta)', devPort: 4322 },
  };
  const servers: { url: string; description: string }[] = [];
  const sc = SERVER_CONFIG[appName];
  if (sc) {
    servers.push(
      { url: sc.prod, description: sc.prodLabel },
      { url: `http://localhost:${sc.devPort}`, description: 'Desenvolvimento' }
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

  const usedOperationIds = new Set<string>();

  // Estrutura por path → método (linhas YAML), permitindo merge por operação com o
  // overlay manual sem gerar chave de path duplicada (DEB-055-12).
  interface PathBlock { pathLevel: string[]; methods: Map<string, string[]> }
  const byPath = new Map<string, PathBlock>();

  for (const oaPath of [...pathMap.keys()].sort(byLocale)) {
    const entriesByMethod = new Map<string, RouteEntry>();
    for (const entry of pathMap.get(oaPath)!) {
      const method = entry.method.toLowerCase();
      if (!KNOWN_METHODS.includes(method) || entriesByMethod.has(method)) continue;
      entriesByMethod.set(method, entry);
    }
    const block: PathBlock = { pathLevel: [], methods: new Map() };
    for (const [method, entry] of [...entriesByMethod.entries()].sort(byEntryKey)) {
      const cls = classifyRoute(entry.method, entry.path, entry.app);
      const opId = operationIdFor(method, oaPath, usedOperationIds);
      const lines: string[] = [];
      lines.push(`    ${method}:`);
      lines.push(`      operationId: ${opId}`);
      lines.push(`      summary: "${summaryFor(method, oaPath)}"`);
      lines.push(`      x-artificio-owner: ${cls.owner}`);
      lines.push(`      x-artificio-scope: ${cls.scope}`);
      lines.push(`      x-artificio-status: ${cls.status}`);
      lines.push(`      x-artificio-auth: ${cls.auth}`);
      if (cls.consumers.length > 0) {
        lines.push(`      x-artificio-consumers:`);
        for (const c of cls.consumers) lines.push(`        - ${c}`);
      }
      if (oaPath.includes('{')) {
        const paramNames = [...oaPath.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
        if (paramNames.length > 0) {
          lines.push(`      parameters:`);
          for (const pname of paramNames) {
            lines.push(`        - name: ${pname}`);
            lines.push(`          in: path`);
            lines.push(`          required: true`);
            lines.push(`          schema:`);
            lines.push(`            type: string`);
          }
        }
      }
      if (shouldHaveRequestBody(method, oaPath)) {
        if (!appendAccountRequestBody(lines, method, oaPath)) {
          appendGenericRequestBody(lines);
        }
      }
      if (!appendAccountResponses(lines, method, oaPath)) {
        appendGenericResponses(lines);
      }
      block.methods.set(method, lines);
    }
    byPath.set(oaPath, block);
  }

  // ── Mesclar overlay manual (rotas/curadoria não detectadas por AST — DEB-055-12) ──
  // Merge por path + método: o overlay tem PRECEDÊNCIA por operação (curadoria manual
  // vence a heurística). Métodos nativos não cobertos pelo overlay são preservados
  // (não se perde operação); paths novos do overlay são adicionados.
  if (overlayPath && existsSync(overlayPath)) {
    const overlayContent = readFileSync(overlayPath, 'utf-8');
    const lines = overlayContent
      .split('\n')
      .filter((line: string) => line.trim() !== '' && !line.trim().startsWith('#'));
    const PATH_RE = /^ {2}(\/\S*):\s*$/;
    const METHOD_RE = /^ {4}(get|post|put|patch|delete|head|options):\s*$/;

    let curPath: string | null = null;
    let curMethod: string | null = null;
    for (const line of lines) {
      const ph = PATH_RE.exec(line);
      if (ph) {
        curPath = ph[1];
        curMethod = null;
        if (!byPath.has(curPath)) byPath.set(curPath, { pathLevel: [], methods: new Map() });
        continue;
      }
      if (curPath === null) continue;
      const block = byPath.get(curPath)!;
      const mh = METHOD_RE.exec(line);
      if (mh) {
        curMethod = mh[1];
        block.methods.set(curMethod, [line]); // overlay sobrescreve a operação nativa
        continue;
      }
      if (curMethod) {
        block.methods.get(curMethod)!.push(line);
      } else {
        block.pathLevel.push(line); // nível de path (ex.: parameters:) — só vem do overlay
      }
    }
  }

  // Serializar paths (nativos + overlay) em ordem estável e determinística
  for (const oaPath of [...byPath.keys()].sort(byLocale)) {
    const block = byPath.get(oaPath)!;
    if (block.methods.size === 0) continue;
    yaml += `  ${oaPath}:\n`;
    for (const l of block.pathLevel) yaml += `${l.replace(/\s+$/, '')}\n`;
    for (const method of [...block.methods.keys()].sort(byLocale)) {
      for (const l of block.methods.get(method)!) yaml += `${l.replace(/\s+$/, '')}\n`;
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
    const overlayPath = join(OUTPUT_DIR, '.overlays', `${appName}.overlay.yaml`);
    const yaml = generateOpenApi(appName, routes, overlayPath);
    const filePath = join(OUTPUT_DIR, `${appName}.openapi.yaml`);
    writeFileSync(filePath, yaml, 'utf-8');
    const hasOverlay = existsSync(overlayPath);
    console.log(`✅ ${filePath} — ${routes.filter(r => r.method !== 'USE').length} rotas HTTP${hasOverlay ? ' (+ overlay)' : ''}`);
  }

  console.log('\n📊 Gerado para: ' + [...byApp.keys()].join(', '));
}

main();

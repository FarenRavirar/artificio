#!/usr/bin/env tsx
/**
 * scripts/api/traffic.ts
 * api:traffic — Captura e normaliza tráfego de API observado.
 *
 * Entradas:
 *   - HAR padrão (exportado de browser DevTools)
 *   - JSON manual (docs/api/api-traffic-manual.json)
 *
 * Saída:
 *   - docs/api/generated/api-traffic.generated.json
 *
 * Uso:
 *   pnpm api:traffic                                    # modo normal (busca padrão)
 *   pnpm api:traffic --har ~/Downloads/export.har       # HAR específico
 *   pnpm api:traffic --manual docs/api/traffic.json     # JSON manual específico
 *   pnpm api:traffic --domains mesas,accounts           # filtrar domínios
 *
 * Princípio: nenhuma dependência nova. HAR é JSON puro.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { byEntryKey } from './sort-utils';

const GENERATED_AT = process.env.API_GENERATED_AT || '1970-01-01T00:00:00.000Z';

// ═══════════════════════════════════════════════
//  TIPOS
// ═══════════════════════════════════════════════

interface TrafficEntry {
  method: string;
  path: string;
  normalizedKey: string;
  statusCode: number;
  observedAt: string;
  source: 'har' | 'manual' | 'supertest' | 'smoke';
  confidence: 'high' | 'medium' | 'low';
}

interface TrafficOutput {
  metadata: {
    total: number;
    sources: string[];
    byApp: Record<string, { total: number; byMethod: Record<string, number> }>;
    generatedAt: string;
  };
  routes: TrafficEntry[];
}

interface HarEntry {
  request: { method: string; url: string };
  response: { status: number };
  startedDateTime: string;
}

interface ManualRoute {
  method: string;
  path: string;
  statusCode?: number;
  observedAt?: string;
  source?: string;
  confidence?: string;
}

interface ManualTrafficFile {
  version?: number;
  _description?: string;
  source?: string;
  generatedAt?: string;
  routes: ManualRoute[];
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════

/**
 * Normaliza path para chave de comparação (mesma lógica do check-api.ts).
 */
function normalizePath(path: string): string {
  let p = (path
    .split('?')[0]
    .replace(/\/+$/, '') || '/')
    .replace(/\/:[^/]+/g, '/:param')
    .replace(/\/\{[^}]+\}/g, '/:param');
  return p.toLowerCase();
}

function buildKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizePath(path)}`;
}

/**
 * Palavras reservadas que aparecem como segmentos de path estáticos.
 * Se um segmento está nesta lista, NÃO é substituído por placeholder.
 */
const RESERVED_WORDS = new Set([
  'admin', 'auth', 'gm', 'me', 'profile', 'systems', 'tables', 'scenarios',
  'settings', 'terms', 'feedback', 'groups', 'reports', 'tags', 'health',
  'healthz', 'changelog', 'og', 'discord', 'import', 'sync', 'messages',
  'sources', 'drafts', 'metrics', 'upload', 'notifications', 'suggestions',
  'scenario-suggestions', 'system-suggestions', 'setting-suggestions',
  'dev-feedback', 'vtt-platforms', 'communication-platforms', 'categories',
  'social', 'users', 'migration', 'export', 'editions', 'history', 'approve',
  'reject', 'ban', 'file', 'preview', 'status', 'search', 'rehydrate-logos',
  'rebuild', 'accept', 'archive', 'contact', 'click', 'favorite', 'view',
  'connect', 'disconnect', 'callback', 'verify-covil', 'login', 'conta',
  'secrets', 'activity', 'pending', 'mine', 'flat', 'tree', 'reorder',
  'candidates', 'resolve', 'read-all', 'read', 'covil', 'google', 'logout',
  'refresh', 'import-text', 'import-json', 'reparse', 'diagnose-content',
  'parse-batch', 'enrich', 'auto-archive', 'toggle', 'bot-token', 'merge',
  'reingest-force', 'refresh-image', 'links', 'suggest', 'shadow', 'api',
  'v1', 'v2', 'v3', 'healthz',
]);

/**
 * Infere parâmetros de path a partir de uma URL observada.
 * Ex: /api/v1/tables/abc-123 → /api/v1/tables/:slug
 * Ex: /api/v1/tables/550e8400-... → /api/v1/tables/:id
 */
function inferPathParams(observedPath: string): string {
  const segments = observedPath.split('/');
  return segments.map(seg => {
    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':id';
    // Number
    if (/^\d+$/.test(seg)) return ':id';
    // Slug alfanumérico com tamanho 5-40
    if (/^[a-z][a-z0-9_-]{4,40}$/i.test(seg) && !RESERVED_WORDS.has(seg)) return ':slug';
    // Mantém como está
    return seg;
  }).join('/');
}

/**
 * Determina o app com base no hostname.
 */
function detectAppFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('accounts')) return 'accounts';
    if (hostname.includes('mesas') || hostname === 'localhost:3001') return 'mesas';
    if (hostname.includes('glossario') || hostname === 'localhost:3002') return 'glossario';
    if (hostname.includes('links') || hostname === 'localhost:3003') return 'links';
    if (hostname.includes('site') || hostname.includes('beta')) return 'site';
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
//  PARSE DE HAR
// ═══════════════════════════════════════════════

const DEFAULT_API_DOMAINS = [
  'accounts.artificiorpg.com', 'accounts',
  'mesas.artificiorpg.com', 'mesasbeta.artificiorpg.com', 'mesas',
  'glossario.artificiorpg.com', 'glossariobeta.artificiorpg.com', 'glossario',
  'links.artificiorpg.com', 'links',
  'localhost:4000', 'localhost:3001', 'localhost:3002', 'localhost:3003',
];

function parseHar(
  harContent: string,
  apiDomains: string[],
): TrafficEntry[] {
  let har: any;
  try {
    har = JSON.parse(harContent);
  } catch (err: any) {
    console.error(`  ❌ HAR inválido: ${err.message}`);
    process.exit(1);
  }

  const entries: HarEntry[] = har?.log?.entries || [];
  if (entries.length === 0) {
    console.warn('  ⚠️  HAR não contém entries (log.entries vazio ou ausente)');
    return [];
  }

  const seen = new Map<string, TrafficEntry>();
  const filtered = entries.filter(entry => {
    try {
      const url = new URL(entry.request.url);
      return apiDomains.some(domain => url.hostname.includes(domain));
    } catch {
      return false;
    }
  });

  for (const entry of filtered) {
    try {
      const url = new URL(entry.request.url);
      const rawPath = url.pathname;
      const method = entry.request.method.toUpperCase();

      // Pular OPTIONS (preflight CORS) e paths não-API
      if (method === 'OPTIONS') continue;
      if (!rawPath.startsWith('/api/') && !rawPath.startsWith('/health') && !rawPath.startsWith('/admin/')) continue;

      const path = inferPathParams(rawPath);
      const normalizedKey = buildKey(method, path);

      // Dedup: manter último status code e timestamp
      seen.set(normalizedKey, {
        method,
        path,
        normalizedKey,
        statusCode: entry.response.status,
        observedAt: entry.startedDateTime || new Date().toISOString(),
        source: 'har',
        confidence: 'high',
      });
    } catch {
      // URL inválida, ignorar
    }
  }

  return [...seen.values()];
}

// ═══════════════════════════════════════════════
//  PARSE DE JSON MANUAL
// ═══════════════════════════════════════════════

function parseManualJson(filePath: string): TrafficEntry[] {
  if (!existsSync(filePath)) {
    console.warn(`  ⚠️  Arquivo manual não encontrado: ${filePath}`);
    return [];
  }

  let data: any;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err: any) {
    console.error(`  ❌ JSON manual inválido (${filePath}): ${err.message}`);
    process.exit(1);
  }

  // Suporta { routes: [...] } e [...]
  const routes: ManualRoute[] = data?.routes || (Array.isArray(data) ? data : []);
  if (!Array.isArray(routes)) {
    console.warn(`  ⚠️  Formato inesperado em ${filePath}`);
    return [];
  }

  const seen = new Map<string, TrafficEntry>();

  for (const route of routes) {
    if (!route.method || !route.path) {
      console.warn(`  ⚠️  Entry inválida (sem method/path): ${JSON.stringify(route)}`);
      continue;
    }

    const method = route.method.toUpperCase();
    const path = route.path;
    const normalizedKey = buildKey(method, path);

    seen.set(normalizedKey, {
      method,
      path,
      normalizedKey,
      statusCode: route.statusCode || 200,
      observedAt: route.observedAt || new Date().toISOString(),
      source: (route.source as any) || 'manual',
      confidence: (route.confidence as any) || 'medium',
    });
  }

  return [...seen.values()];
}

// ═══════════════════════════════════════════════
//  AGRUPAMENTO POR APP
// ═══════════════════════════════════════════════

function groupByApp(routes: TrafficEntry[]): Record<string, { total: number; byMethod: Record<string, number> }> {
  const byApp: Record<string, { total: number; byMethod: Record<string, number> }> = {};

  for (const r of routes) {
    const p = r.path.toLowerCase();
    let app = 'unknown';

    // accounts
    if (p.startsWith('/api/auth') || p.startsWith('/admin/secrets') || p.startsWith('/health') || p.startsWith('/admin/secrets')) {
      app = 'accounts';
    }
    // mesas
    else if (p.includes('/tables') || p.includes('/discord/') || p.includes('/gm/') || p.includes('/vtt-platforms') || p.includes('/communication-platforms') || p.includes('/system-suggestions') || p.includes('/scenario-suggestions') || p.includes('/dev-feedback') || p.includes('/setting-suggestions') || p.includes('/upload') || p.includes('/notifications') || p.includes('/me') || p.includes('/profile') || p.includes('/settings')) {
      app = 'mesas';
    }
    // glossario
    else if (p.includes('/terms') || p.includes('/categories') || p.includes('/systems') || p.includes('/scenarios') || p.includes('/changelog') || p.includes('/social') || p.includes('/export') || p.includes('/feedback') || p.includes('/migration') || p.includes('/users')) {
      app = 'glossario';
    }
    // links
    else if (p.includes('/groups') || p.includes('/tags') || p.includes('/reports') || p.startsWith('/grupo/')) {
      app = 'links';
    }

    if (!byApp[app]) byApp[app] = { total: 0, byMethod: {} };
    byApp[app].total++;
    byApp[app].byMethod[r.method] = (byApp[app].byMethod[r.method] || 0) + 1;
  }

  return byApp;
}

// ═══════════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════════

function parseArgs(): {
  harPath: string | null;
  manualPath: string | null;
  domains: string[];
  baseDir: string;
} {
  const args = process.argv.slice(2);
  let harPath: string | null = null;
  let manualPath: string | null = null;
  let domains: string[] = [];
  const baseDir = resolve(import.meta.dirname, '../../docs/api');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--har' && i + 1 < args.length) {
      harPath = args[++i];
    } else if (args[i] === '--manual' && i + 1 < args.length) {
      manualPath = args[++i];
    } else if (args[i] === '--domains' && i + 1 < args.length) {
      domains = args[++i].split(',').map(d => d.trim());
    }
  }

  return { harPath, manualPath, domains, baseDir };
}

function main(): void {
  const { harPath, manualPath, domains, baseDir } = parseArgs();
  const apiDomains = domains.length > 0 ? domains : DEFAULT_API_DOMAINS;
  const outputPath = join(baseDir, 'generated', 'api-traffic.generated.json');

  console.log(`\n📡 api:traffic — Tráfego observado de API\n`);

  const allRoutes = new Map<string, TrafficEntry>();
  const usedSources = new Set<string>();

  // ── 1. Parse HAR ──
  if (harPath) {
    const resolvedHar = resolve(harPath);
    if (!existsSync(resolvedHar)) {
      console.error(`  ❌ Arquivo HAR não encontrado: ${resolvedHar}`);
      process.exit(1);
    }
    const content = readFileSync(resolvedHar, 'utf-8');
    const harRoutes = parseHar(content, apiDomains);
    for (const r of harRoutes) {
      allRoutes.set(r.normalizedKey, r);
    }
    usedSources.add('har');
    console.log(`   📦 HAR: ${harRoutes.length} rotas únicas (de ${resolvedHar})`);
  } else {
    // Buscar HARs no diretório docs/api/
    const harFiles = existsSync(baseDir)
      ? readdirSync(baseDir).filter(f => f.endsWith('.har'))
      : [];
    if (harFiles.length > 0) {
      for (const hf of harFiles) {
        const content = readFileSync(join(baseDir, hf), 'utf-8');
        const harRoutes = parseHar(content, apiDomains);
        for (const r of harRoutes) {
          allRoutes.set(r.normalizedKey, r);
        }
        usedSources.add('har');
        console.log(`   📦 HAR: ${harRoutes.length} rotas únicas (de ${hf})`);
      }
    } else {
      console.log(`   ℹ️  Nenhum arquivo .har encontrado em ${baseDir}`);
    }
  }

  // ── 2. Parse JSON manual ──
  if (manualPath) {
    const resolvedManual = resolve(manualPath);
    const manualRoutes = parseManualJson(resolvedManual);
    for (const r of manualRoutes) {
      // Se já existe via HAR, não sobrescreve (HAR tem prioridade)
      if (!allRoutes.has(r.normalizedKey)) {
        allRoutes.set(r.normalizedKey, r);
      }
    }
    usedSources.add('manual');
    console.log(`   📦 Manual: ${manualRoutes.length} rotas (de ${resolvedManual})`);
  } else {
    // Buscar api-traffic-manual.json padrão
    const defaultManual = join(baseDir, 'api-traffic-manual.json');
    const manualRoutes = parseManualJson(defaultManual);
    for (const r of manualRoutes) {
      if (!allRoutes.has(r.normalizedKey)) {
        allRoutes.set(r.normalizedKey, r);
      }
    }
    if (manualRoutes.length > 0) {
      usedSources.add('manual');
      console.log(`   📦 Manual: ${manualRoutes.length} rotas (de ${defaultManual})`);
    }
  }

  // ── 3. Gerar output ──
  const routes = [...allRoutes.values()];
  const byApp = groupByApp(routes);

  const output: TrafficOutput = {
    metadata: {
      total: routes.length,
      sources: [...usedSources],
      byApp,
      generatedAt: GENERATED_AT,
    },
    routes,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

  console.log(`\n   📊 Total: ${routes.length} rotas únicas`);
  for (const [app, info] of Object.entries(byApp).sort(byEntryKey)) {
    const methods = Object.entries(info.byMethod)
      .map(([m, c]) => `${m}:${c}`)
      .join(', ');
    console.log(`      ${app}: ${info.total} (${methods})`);
  }
  console.log(`   ✅ Output: ${outputPath}`);
  console.log(`   🏁 Exit code: 0\n`);
}

main();

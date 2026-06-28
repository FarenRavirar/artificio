/**
 * scripts/api/check-api.ts
 * api:check — Comparador 3-way entre inventário de código, OpenAPI e consumidores.
 * Gera relatório de divergência (api-drift.generated.md) com exit code apropriado.
 *
 * Uso:
 *   pnpm api:check                    # modo normal
 *   pnpm api:check --generate-allowlist  # bootstrap allowlist
 *
 * Dependências: js-yaml, @types/js-yaml
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { byEntryKey } from './sort-utils';

const GENERATED_AT = process.env.API_GENERATED_AT || '1970-01-01T00:00:00.000Z';

// ═══════════════════════════════════════════════
//  TIPOS
// ═══════════════════════════════════════════════

interface RouteEntry {
  app: string;
  method: string;
  path: string;
  sourceFile: string;
  line?: number;
  confidence: 'high' | 'medium' | 'low';
  kind: 'express-route' | 'mount' | 'unknown';
}

interface ConsumerEntry {
  app: string;
  consumerFile: string;
  method: string;
  endpoint: string;
  confidence: 'high' | 'medium' | 'low';
  pattern: string;
  wrapper?: string;
  line?: number;
}

interface OpenAPIRoute {
  method: string;
  path: string;
  owner?: string;
  scope?: string;
  status?: string;
  auth?: string;
  consumers?: string[];
}

interface AllowlistEntry {
  method: string;
  path: string;
  app: string;
  state: string;
  reason: string;
  added: string;
  confidence?: string;
}

type DriftState =
  | 'OK'
  | 'CODE_ONLY'
  | 'CONTRACT_ONLY'
  | 'CONSUMER_ONLY'
  | 'UNUSED_ROUTE'
  | 'ORPHAN_SUSPECT'
  | 'UNCERTAIN';

interface DriftEntry {
  key: string;
  method: string;
  path: string;
  state: DriftState;
  inInventory: boolean;
  inOpenAPI: boolean;
  inConsumers: boolean;
  app?: string;
  confidence?: string;
  hasOpenAPIMetadata: boolean;
  scope?: string;
  status?: string;
  isNew: boolean;
  isAllowed: boolean;
}

// ═══════════════════════════════════════════════
//  TIPOS — FASE 6 (órfãs e duplicatas)
// ═══════════════════════════════════════════════

interface OrphanEntry {
  key: string;
  method: string;
  path: string;
  app: string;
  inInventory: boolean;
  inOpenAPI: boolean;
  hasScope: boolean;
  scope: string;
  reason: string;
}

interface DuplicateCandidate {
  routeA: { key: string; method: string; path: string; app?: string; scope?: string };
  routeB: { key: string; method: string; path: string; app?: string; scope?: string };
  totalScore: number;
  methodMatch: boolean;
  tokenSimilarity: number;
  sameOwner: boolean;
  sameScope: boolean;
}

// ═══════════════════════════════════════════════
//  TIPOS — FASE 7 (tráfego observado)
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

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════

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
 * Casa uma chave de consumidor com valor concreto contra rotas com :param.
 * Ex: `PUT /admin/secrets/deepseek_api_key` casa `PUT /admin/secrets/:param`.
 * Match: mesmo método, mesmo nº de segmentos, cada segmento do template igual
 * ao do consumidor OU `:param`. Retorna a chave do template, ou null.
 */
function matchParamTemplate(consumerKey: string, routeKeys: Set<string>): string | null {
  const [cMethod, cPath] = consumerKey.split(' ');
  if (!cPath) return null;
  const cSegs = cPath.split('/');
  for (const routeKey of routeKeys) {
    const [rMethod, rPath] = routeKey.split(' ');
    if (rMethod !== cMethod) continue;
    if (!rPath.includes(':param')) continue; // só templates com param
    const rSegs = rPath.split('/');
    if (rSegs.length !== cSegs.length) continue;
    let ok = true;
    for (let i = 0; i < rSegs.length; i++) {
      if (rSegs[i] === ':param') continue;
      if (rSegs[i] !== cSegs[i]) { ok = false; break; }
    }
    if (ok) return routeKey;
  }
  return null;
}

function isConcreteApiPath(path: string): boolean {
  return path.startsWith('/');
}

function isSyntheticApiPath(path: string): boolean {
  return path.includes('<') || path.includes('>') || path.includes(':param:param');
}

function canBeAllowlisted(method: unknown, path: unknown): boolean {
  if (typeof method !== 'string' || typeof path !== 'string') return false;
  return method.toUpperCase() !== 'UNKNOWN' && isConcreteApiPath(path) && !isSyntheticApiPath(path);
}

function readJSON<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    console.warn(`  ⚠️  Arquivo não encontrado: ${filePath}`);
    return [];
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    // Suporta { routes: [...] } e [...]
    if (Array.isArray(data)) return data as T[];
    if (data.routes && Array.isArray(data.routes)) return data.routes as T[];
    if (data.consumers && Array.isArray(data.consumers)) return data.consumers as T[];

    console.warn(`  ⚠️  Formato inesperado em ${filePath} — esperado array ou { routes/consumers: [] }`);
    return [];
  } catch (err: any) {
    console.error(`  ❌ Erro ao parsear ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function readOpenAPIYAMLs(dir: string): OpenAPIRoute[] {
  const routes: OpenAPIRoute[] = [];
  if (!existsSync(dir)) {
    console.warn(`  ⚠️  Diretório OpenAPI não encontrado: ${dir}`);
    return routes;
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of files) {
    try {
      const doc = yamlLoad(readFileSync(join(dir, file), 'utf-8')) as any;
      if (!doc?.paths) continue;

      for (const [path, pathItem] of Object.entries(doc.paths)) {
        const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
        for (const method of methods) {
          if ((pathItem as any)[method]) {
            const op = (pathItem as any)[method];
            routes.push({
              method: method.toUpperCase(),
              path: path as string,
              owner: op['x-artificio-owner'],
              scope: op['x-artificio-scope'],
              status: op['x-artificio-status'],
              auth: op['x-artificio-auth'],
              consumers: op['x-artificio-consumers'],
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`  ❌ Erro ao parsear YAML ${file}: ${err.message}`);
      process.exit(1);
    }
  }
  return routes;
}

function readAllowlist(filePath: string): Map<string, AllowlistEntry> {
  if (!existsSync(filePath)) return new Map();
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as { items: AllowlistEntry[] };
    const map = new Map<string, AllowlistEntry>();
    for (const item of data.items || []) {
      if (!canBeAllowlisted(item.method, item.path)) continue;
      map.set(buildKey(item.method, item.path), item);
    }
    return map;
  } catch (err: any) {
    console.warn(`  ⚠️  Erro ao ler allowlist ${filePath}: ${err.message}`);
    return new Map();
  }
}

// ═══════════════════════════════════════════════
//  CORE COMPARISON
// ═══════════════════════════════════════════════

function calculateState(
  inInv: boolean,
  inOas: boolean,
  inCons: boolean,
  scope?: string,
): DriftState {
  if (inInv && inOas) {
    if (inCons) return 'OK';
    // Existe no código e no contrato, mas sem consumidor
    const classified =
      scope === 'admin' ||
      scope === 'cron' ||
      scope === 'webhook' ||
      scope === 'cross-app' ||
      scope === 'legacy' ||
      scope === 'internal';
    if (classified) return 'UNUSED_ROUTE'; // classificada → não precisa de consumidor
    return 'ORPHAN_SUSPECT'; // sem consumidor e sem classificação que justifique
  }
  if (inInv && !inOas) return 'CODE_ONLY';
  if (!inInv && inOas) return 'CONTRACT_ONLY';
  if (!inInv && !inOas && inCons) return 'CONSUMER_ONLY';
  return 'UNCERTAIN';
}

function computeConfidence(entry: RouteEntry | ConsumerEntry): string {
  return entry.confidence || 'unknown';
}

interface ComparisonSources {
  inventory: RouteEntry[];
  consumers: ConsumerEntry[];
  openapi: OpenAPIRoute[];
  traffic: TrafficEntry[];        // Fase 7 — tráfego observado (opcional)
  trafficKeys: Set<string>;       // normalized keys com tráfego observado
}

function loadAllSources(baseDir: string): ComparisonSources {
  const inventoryPath = join(baseDir, 'generated', 'api-inventory.generated.json');
  const consumersPath = join(baseDir, 'generated', 'api-consumers.generated.json');
  const openapiDir = join(baseDir, 'openapi');
  const trafficPath = join(baseDir, 'generated', 'api-traffic.generated.json');

  const inventory = readJSON<RouteEntry>(inventoryPath);
  const consumers = readJSON<ConsumerEntry>(consumersPath);
  const openapi = readOpenAPIYAMLs(openapiDir);

  // Fase 7 — Carregar tráfego observado (se disponível)
  const traffic: TrafficEntry[] = [];
  if (existsSync(trafficPath)) {
    try {
      const raw = readFileSync(trafficPath, 'utf-8');
      const data = JSON.parse(raw) as TrafficOutput;
      if (data?.routes && Array.isArray(data.routes)) {
        traffic.push(...data.routes);
      }
    } catch (err: any) {
      console.warn(`  ⚠️  Erro ao carregar tráfego (${trafficPath}): ${err.message}`);
    }
  }
  const trafficKeys = new Set(traffic.map(t => t.normalizedKey));
  if (traffic.length > 0) {
    console.log(`   📦 Traffic:  ${traffic.length} rotas com tráfego observado`);
  }

  return { inventory, consumers, openapi, traffic, trafficKeys };
}

function compareSources(sources: ComparisonSources): DriftEntry[] {
  const { inventory, consumers, openapi } = sources;

  // Build maps
  // USE é mount point interno do Express (static, sub-router), não endpoint de
  // API — excluído da comparação 3-way (DEB-055-15), igual a órfãs/duplicatas.
  const invMap = new Map<string, RouteEntry>();
  for (const r of inventory) {
    if (r.method === 'USE') continue;
    // Catch-all Express 5 ({*splat}) / wildcard não são endpoints de API — o
    // generate-openapi também os pula; manter consistência evita CODE_ONLY falso.
    if (r.path.includes('{*') || r.path.includes('/*') || r.path.includes('*splat')) continue;
    const key = buildKey(r.method, r.path);
    if (!invMap.has(key)) invMap.set(key, r);
  }

  const oasMap = new Map<string, OpenAPIRoute>();
  for (const r of openapi) {
    const key = buildKey(r.method, r.path);
    if (!oasMap.has(key)) oasMap.set(key, r);
  }

  // Conjunto de chaves de rota reais (inventário + contrato) para casar
  // consumidores que usam valor concreto onde a rota tem :param
  // (ex: consumer `/admin/secrets/deepseek_api_key` casa rota `/admin/secrets/:name`).
  const routeKeys = new Set<string>([...invMap.keys(), ...oasMap.keys()]);

  const consMap = new Map<string, ConsumerEntry[]>();
  for (const r of consumers) {
    const method = r.method && r.method !== 'UNKNOWN' ? r.method : 'UNKNOWN';
    let key = buildKey(method, r.endpoint);
    if (!routeKeys.has(key)) {
      const matched = matchParamTemplate(key, routeKeys);
      if (matched) key = matched;
    }
    if (!consMap.has(key)) consMap.set(key, []);
    consMap.get(key)!.push(r);
  }

  // Build union of all keys
  const allKeys = new Set<string>();
  for (const k of invMap.keys()) allKeys.add(k);
  for (const k of oasMap.keys()) allKeys.add(k);
  for (const k of consMap.keys()) allKeys.add(k);

  const entries: DriftEntry[] = [];
  for (const key of allKeys) {
    const invEntry = invMap.get(key);
    const oasEntry = oasMap.get(key);
    const consEntries = consMap.get(key);

    const inInv = !!invEntry;
    const inOas = !!oasEntry;
    const inCons = !!consEntries && consEntries.length > 0;

    const method = invEntry?.method || oasEntry?.method || consEntries?.[0]?.method || 'UNKNOWN';
    const path = invEntry?.path || oasEntry?.path || consEntries?.[0]?.endpoint || key;

    const scope = oasEntry?.scope;
    const state = calculateState(inInv, inOas, inCons, scope);

    // Confidence: take lowest from all sources that have it
    let confidence = 'high';
    if (invEntry) confidence = computeConfidence(invEntry);
    if (consEntries && consEntries.length > 0) {
      const consConf = consEntries.map(c => c.confidence).sort((a, b) => {
        const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
        return (order[a] || 0) - (order[b] || 0);
      })[0];
      if (consConf && (confidence === 'high' || confidence === undefined)) {
        const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
        if ((order[consConf] || 0) < (order[confidence] || 3)) {
          confidence = consConf;
        }
      }
    }

    const hasOpenAPIMetadata = !!(
      oasEntry?.owner &&
      oasEntry?.scope &&
      oasEntry?.status &&
      oasEntry?.auth
    );

    entries.push({
      key,
      method,
      path,
      state,
      inInventory: inInv,
      inOpenAPI: inOas,
      inConsumers: inCons,
      app: invEntry?.app || oasEntry?.owner || (consEntries ? consEntries[0]?.app : undefined),
      confidence,
      hasOpenAPIMetadata,
      scope,
      status: oasEntry?.status,
      isNew: true,
      isAllowed: false,
    });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

// ═══════════════════════════════════════════════
//  ALLOWLIST
// ═══════════════════════════════════════════════

function applyAllowlist(entries: DriftEntry[], allowlist: Map<string, AllowlistEntry>): void {
  for (const entry of entries) {
    const allowed = allowlist.get(entry.key);
    entry.isAllowed = !!allowed;
    entry.isNew = !allowed;
  }
}

function generateAllowlistFile(entries: DriftEntry[], filePath: string): void {
  const divergences = entries.filter(e =>
    canBeAllowlisted(e.method, e.path) &&
    (
      e.state === 'CODE_ONLY' ||
      e.state === 'CONTRACT_ONLY' ||
      e.state === 'CONSUMER_ONLY' ||
      e.state === 'ORPHAN_SUSPECT' ||
      e.state === 'UNUSED_ROUTE' ||
      e.state === 'UNCERTAIN'
    )
  );

  const items = divergences.map(e => ({
    method: e.method,
    path: e.path,
    app: e.app || 'unknown',
    state: e.state,
    reason: `Divergência legada — ${stateDescription(e.state)}`,
    added: new Date().toISOString().slice(0, 10),
    confidence: e.confidence || 'high',
  }));

  const allowlist = {
    version: 1,
    _description: 'Allowlist de divergências legadas de API. Remova entries conforme as rotas forem documentadas no OpenAPI.',
    generated: new Date().toISOString().slice(0, 10),
    items,
  };

  writeFileSync(filePath, JSON.stringify(allowlist, null, 2) + '\n');
  console.log(`✅ Allowlist gerada: ${filePath} (${items.length} entries)`);
}

function stateDescription(state: DriftState): string {
  const map: Record<DriftState, string> = {
    OK: 'rota documentada e com consumidor',
    CODE_ONLY: 'rota existe no código mas não no OpenAPI',
    CONTRACT_ONLY: 'rota no OpenAPI mas não no código',
    CONSUMER_ONLY: 'consumidor chama rota inexistente',
    UNUSED_ROUTE: 'rota sem consumidor (justificada)',
    ORPHAN_SUSPECT: 'rota sem consumidor e sem classificação',
    UNCERTAIN: 'não foi possível determinar o estado',
  };
  return map[state] || state;
}

// ═══════════════════════════════════════════════
//  FASE 6 — ÓRFÃS E DUPLICATAS
// ═══════════════════════════════════════════════

/**
 * Detecta rotas órfãs suspeitas.
 * Uma rota é órfã quando: existe no código/OpenAPI, NÃO tem consumidor,
 * e NÃO está classificada com scope que justifique ausência de uso.
 */
function detectOrphans(entries: DriftEntry[], trafficKeys: Set<string> = new Set()): OrphanEntry[] {
  return entries
    .filter(entry => {
      // 0. USE é mount point interno do Express, não endpoint de API (DEB-055-15)
      if (entry.method === 'USE') return false;

      // 1. Precisa existir em pelo menos uma fonte (código ou contrato)
      if (!entry.inInventory && !entry.inOpenAPI) return false;

      // 2. Se tem consumidor → não é órfã
      if (entry.inConsumers) return false;

      // 3. Se tem tráfego observado → não é órfã (Fase 7)
      if (trafficKeys.has(entry.key)) return false;

      // 4. Se tem classificação → verificar se justifica ausência
      const scope = entry.scope;
      const status = entry.status;
      const classified = ['admin', 'cron', 'webhook', 'cross-app', 'internal'];
      if (scope && classified.includes(scope)) return false; // classificada → não órfã
      if (status === 'legacy') return false; // legacy intencional

      return true; // órfã suspeita
    })
    .map(entry => ({
      key: entry.key,
      method: entry.method,
      path: entry.path,
      app: entry.app || 'unknown',
      inInventory: entry.inInventory,
      inOpenAPI: entry.inOpenAPI,
      hasScope: !!entry.scope,
      scope: entry.scope || '— (sem OpenAPI)',
      reason: !entry.inOpenAPI
        ? 'CODE_ONLY sem classificação'
        : entry.scope
          ? `Scope "${entry.scope}" sem consumidor`
          : 'Sem consumidor e sem scope que justifique',
    }));
}

// Normalização FORTE para comparação de duplicatas
// Remove :params, {params}, /vN/, trailing slash — mantém só tokens semânticos
function normalizeForDedup(path: string): string {
  return (path
    .toLowerCase()
    .split('?')[0]
    .replace(/\/+$/, '') || '/')
    .replace(/\/:[^/]+/g, '')
    .replace(/\/\{[^}]+\}/g, '')
    .replace(/\/v\d+\//, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

function computeDuplicateScore(
  a: DriftEntry,
  b: DriftEntry,
): DuplicateCandidate {
  if (isRestCollectionDetailPair(a.path, b.path) || isRestCollectionDetailPair(b.path, a.path)) {
    return {
      routeA: { key: a.key, method: a.method, path: a.path, app: a.app, scope: a.scope },
      routeB: { key: b.key, method: b.method, path: b.path, app: b.app, scope: b.scope },
      totalScore: 0,
      methodMatch: a.method === b.method,
      tokenSimilarity: 0,
      sameOwner: a.app === b.app && !!a.app,
      sameScope: a.scope === b.scope && !!a.scope,
    };
  }

  // 1. Method match (40 pontos)
  const methodMatch = a.method === b.method;
  const methodScore = methodMatch ? 40 : 0;

  // 2. Token similarity (40 pontos)
  const normA = normalizeForDedup(a.path);
  const normB = normalizeForDedup(b.path);
  const tokensA = normA.split('/').filter(Boolean);
  const tokensB = normB.split('/').filter(Boolean);

  const maxLen = Math.max(tokensA.length, tokensB.length);
  let matchingTokens = 0;
  for (let i = 0; i < Math.min(tokensA.length, tokensB.length); i++) {
    if (tokensA[i] === tokensB[i]) matchingTokens++;
  }
  const tokenSimilarity = maxLen > 0 ? matchingTokens / maxLen : 0;
  const tokenScore = Math.round(tokenSimilarity * 40);

  // 3. Same owner (10 pontos)
  const sameOwner = a.app === b.app && !!a.app;
  const ownerScore = sameOwner ? 10 : 0;

  // 4. Same scope (10 pontos)
  const sameScope = a.scope === b.scope && !!a.scope;
  const scopeScore = sameScope ? 10 : 0;

  return {
    routeA: { key: a.key, method: a.method, path: a.path, app: a.app, scope: a.scope },
    routeB: { key: b.key, method: b.method, path: b.path, app: b.app, scope: b.scope },
    totalScore: methodScore + tokenScore + ownerScore + scopeScore,
    methodMatch,
    tokenSimilarity,
    sameOwner,
    sameScope,
  };
}

function isParamToken(segment: string): boolean {
  return segment.startsWith(':') || (segment.startsWith('{') && segment.endsWith('}'));
}

function isRestCollectionDetailPair(collectionPath: string, detailPath: string): boolean {
  const collection = collectionPath.split('/').filter(Boolean);
  const detail = detailPath.split('/').filter(Boolean);
  if (detail.length !== collection.length + 1) return false;
  for (let i = 0; i < collection.length; i += 1) {
    if (collection[i] !== detail[i]) return false;
  }
  return isParamToken(detail[detail.length - 1]);
}

/**
 * Detecta duplicatas suspeitas comparando rotas dentro do mesmo app.
 * Retorna pares com score >= minScore (default 60).
 * O(n²/2) por app — aceitável para ~200 rotas.
 */
function detectDuplicates(entries: DriftEntry[], minScore = 90): DuplicateCandidate[] {
  // Filtrar USE mounts (não são rotas reais) e agrupar por app+método
  const filtered = entries.filter(e => e.method !== 'USE' && e.method !== 'UNKNOWN');

  const byMethodApp = new Map<string, DriftEntry[]>();
  for (const e of filtered) {
    const app = e.app || 'unknown';
    const key = `${e.method}::${app}`;
    if (!byMethodApp.has(key)) byMethodApp.set(key, []);
    byMethodApp.get(key)!.push(e);
  }

  const results: DuplicateCandidate[] = [];
  const seen = new Set<string>();

  for (const sameMethodAppEntries of byMethodApp.values()) {
    for (let i = 0; i < sameMethodAppEntries.length; i++) {
      for (let j = i + 1; j < sameMethodAppEntries.length; j++) {
        const a = sameMethodAppEntries[i];
        const b = sameMethodAppEntries[j];

        // Auto-exclusão
        if (a.key === b.key) continue;

        const pairKey = a.key < b.key ? `${a.key}||${b.key}` : `${b.key}||${a.key}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        if (canonicalRouteFingerprint(a.path) !== canonicalRouteFingerprint(b.path)) continue;

        const score = computeDuplicateScore(a, b);
        if (score.totalScore >= minScore && score.tokenSimilarity >= 0.5) {
          results.push(score);
        }
      }
    }
  }

  return results.sort((a, b) => b.totalScore - a.totalScore).slice(0, 200);
}

function canonicalRouteFingerprint(path: string): string {
  return path
    .toLowerCase()
    .replace(/\{[^}]+\}/g, ':param')
    .replace(/:[a-z0-9_]+/gi, ':param')
    .replace(/\/+$/, '')
    .replace(/\/+/g, '/');
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'DUPLICATE_HIGH';
  if (score >= 70) return 'DUPLICATE_MEDIUM';
  return 'DUPLICATE_LOW';
}

function scoreEmoji(score: number): string {
  if (score >= 80) return '🔴';
  if (score >= 70) return '🟡';
  return '🟢';
}

/**
 * Gera relatório de órfãs e duplicatas (api-orphans.generated.md).
 * NÃO altera exit code — Fase 6 não bloqueia no modo inicial.
 */
function generateOrphansReport(
  orphans: OrphanEntry[],
  duplicates: DuplicateCandidate[],
  filePath: string,
  trafficCount: number = 0,
): void {
  const now = GENERATED_AT;

  let md = `# Relatório de Rotas Órfãs e Duplicadas

**Gerado em:** ${now}
**Modo:** inicial
**Este relatório NÃO bloqueia o build.**

---

## Sumário

| Categoria | Quantidade | Bloqueia? |
|-----------|:----------:|:---------:|
| 👻 Órfãs suspeitas (ORPHAN_SUSPECT) | ${orphans.length} | ❌ |
`;

  // Contar duplicatas por nível
  const high = duplicates.filter(d => d.totalScore >= 80).length;
  const med = duplicates.filter(d => d.totalScore >= 70 && d.totalScore < 80).length;
  const low = duplicates.filter(d => d.totalScore < 70).length;

  if (high > 0) md += `| 🔀 Duplicatas suspeitas (score ≥ 80) | ${high} | ❌ |\n`;
  if (med > 0) md += `| 🔀 Duplicatas suspeitas (score 70-79) | ${med} | ❌ |\n`;
  if (low > 0) md += `| 🔀 Duplicatas suspeitas (score 60-69) | ${low} | ❌ |\n`;

  // ── Orphans section ──
  if (orphans.length > 0) {
    md += `\n## Rotas órfãs suspeitas\n\n`;
    md += `Rotas existentes no código/OpenAPI, sem consumidor detectado e sem classificação que justifique ausência de uso.\n\n`;

    const byApp = new Map<string, OrphanEntry[]>();
    for (const o of orphans) {
      const app = o.app;
      if (!byApp.has(app)) byApp.set(app, []);
      byApp.get(app)!.push(o);
    }

    for (const [app, appOrphans] of [...byApp.entries()].sort(byEntryKey)) {
      md += `### ${app} (${appOrphans.length} rota(s))\n\n`;
      md += `| Method | Path | Tem OpenAPI? | Scope | Razão |\n`;
      md += `|--------|------|:-----------:|-------|-------|\n`;
      for (const o of appOrphans) {
        md += `| ${o.method} | \`${o.path}\` | ${o.inOpenAPI ? '✅' : '❌'} | ${o.scope} | ${o.reason} |\n`;
      }
    }

    md += `\n### Observações\n\n`;
    md += `- Rotas sem OpenAPI (CODE_ONLY) não têm classificação \`x-artificio-*\` — podem ser admin/cron/legacy legítimas mas ainda não documentadas.\n`;
    md += `- Rotas com scope \`public\` sem consumidor: revisar se são realmente necessárias ou se o consumidor não foi detectado (confidence low).\n`;
  }

  // ── Duplicates section ──
  if (duplicates.length > 0) {
    md += `\n---\n\n## Rotas Duplicadas Suspeitas\n\n`;
    md += `Pares de rotas com fingerprint canônico idêntico, similaridade ≥ 90 e tokenSimilarity ≥ 0.5. Score máximo = 100 (method 40 + token 40 + owner 10 + scope 10).\n\n`;

    // Group by level
    const highDups = duplicates.filter(d => d.totalScore >= 80);
    const medDups = duplicates.filter(d => d.totalScore >= 70 && d.totalScore < 80);
    const lowDups = duplicates.filter(d => d.totalScore < 70);

    if (highDups.length > 0) {
      md += `### Score ≥ 80 (alta probabilidade)\n\n`;
      md += `| Score | Method | Rota A | Rota B | App | Observação |\n`;
      md += `|:----:|:-----:|--------|--------|:---:|------------|\n`;
      for (const d of highDups) {
        const obs = d.sameOwner ? (d.sameScope ? 'Mesmo app e scope' : 'Mesmo app') : 'Apps diferentes';
        md += `| **${d.totalScore}** | ${d.routeA.method} | \`${d.routeA.path}\` | \`${d.routeB.path}\` | ${d.routeA.app || '?'} | ${obs} |\n`;
      }
    }

    if (medDups.length > 0) {
      md += `\n### Score 70-79 (média probabilidade)\n\n`;
      md += `| Score | Method | Rota A | Rota B | App |\n`;
      md += `|:----:|:-----:|--------|--------|:---:|\n`;
      for (const d of medDups) {
        md += `| **${d.totalScore}** | ${d.routeA.method} | \`${d.routeA.path}\` | \`${d.routeB.path}\` | ${d.routeA.app || '?'} |\n`;
      }
    }

    if (lowDups.length > 0) {
      md += `\n### Score 60-69 (baixa probabilidade)\n\n`;
      md += `| Score | Method | Rota A | Rota B | App |\n`;
      md += `|:----:|:-----:|--------|--------|:---:|\n`;
      for (const d of lowDups) {
        md += `| **${d.totalScore}** | ${d.routeA.method} | \`${d.routeA.path}\` | \`${d.routeB.path}\` | ${d.routeA.app || '?'} |\n`;
      }
    }

    md += `\n### Considerações\n\n`;
    md += `- Rotas intencionalmente similares (ex: \`contact\` vs \`contact-click\`) geram falso positivo. Avaliar manualmente antes de consolidar.\n`;
    md += `- Duplicatas entre subsistemas diferentes (ex: discord vs inbox) podem ser arquiteturais, não erros.\n`;
    md += `- Threshold atual: fingerprint canônico igual + score 90 + tokenSimilarity mínimo de 0.5. Isso elimina falsos positivos REST como lista vs detalhe e siblings de ação.\n`;
  }

  if (orphans.length === 0 && duplicates.length === 0) {
    md += `\nNenhuma órfã ou duplicata encontrada. ✅\n`;
  }

  // ── Traffic section (Fase 7) ──
  if (trafficCount > 0) {
    md += `\n---\n\n## Tráfego observado\n\n`;
    md += `Dados de ${trafficCount} rota(s) com tráfego observado (HAR/manual) foram carregados.\n`;
    md += `Rotas com tráfego observado NÃO são consideradas órfãs, mesmo sem consumidor detectado.\n`;
    md += `O tráfego não altera o exit code — é evidência complementar.\n`;
  }

  // Recommendation
  md += `\n## Recomendações\n\n`;
  md += `1. **Órfãs:** Revisar cada rota órfã e decidir: remover, marcar como \`legacy\` no OpenAPI, ou justificar com scope adequado.\n`;
  md += `2. **Duplicatas:** Avaliar se as rotas com score ≥ 80 devem ser consolidadas ou se são intencionalmente distintas.\n`;
  md += `3. Para ajustar thresholds ou desabilitar o relatório, editar a seção Fase 6 em \`scripts/api/check-api.ts\`.\n`;

  writeFileSync(filePath, md, 'utf-8');
  console.log(`   📝 Órfãs/duplicatas: ${filePath}`);
}

// ═══════════════════════════════════════════════
//  EXIT CODE
// ═══════════════════════════════════════════════

function calculateExitCode(entries: DriftEntry[]): 0 | 1 {
  for (const entry of entries) {
    if (entry.isAllowed) continue; // legado conhecido

    if (entry.state === 'CODE_ONLY') {
      console.error(`  ❌ BLOQUEANTE: CODE_ONLY nova — ${entry.key}`);
      return 1;
    }

    if (entry.state === 'CONSUMER_ONLY' && entry.confidence === 'high') {
      console.error(`  ❌ BLOQUEANTE: CONSUMER_ONLY nova (high conf) — ${entry.key}`);
      return 1;
    }
  }
  return 0;
}

// ═══════════════════════════════════════════════
//  REPORT GENERATION
// ═══════════════════════════════════════════════

function generateMarkdownReport(
  entries: DriftEntry[],
  allowlist: Map<string, AllowlistEntry>,
  exitCode: 0 | 1,
): string {
  const now = GENERATED_AT;
  const mode = exitCode === 0 ? 'inicial (sem bloqueios)' : 'bloqueante';

  // Count by state
  const stateCount = new Map<DriftState, number>();
  for (const e of entries) {
    stateCount.set(e.state, (stateCount.get(e.state) || 0) + 1);
  }

  // Group by app
  const byApp = new Map<string, DriftEntry[]>();
  for (const e of entries) {
    const app = e.app || 'unknown';
    if (!byApp.has(app)) byApp.set(app, []);
    byApp.get(app)!.push(e);
  }

  const blockingEntries = entries.filter(e => !e.isAllowed && (e.state === 'CODE_ONLY' || (e.state === 'CONSUMER_ONLY' && e.confidence === 'high')));
  const orphanEntries = entries.filter(e => e.state === 'ORPHAN_SUSPECT');
  const unusedEntries = entries.filter(e => e.state === 'UNUSED_ROUTE');
  const codeOnly = entries.filter(e => e.state === 'CODE_ONLY');
  const consumerOnly = entries.filter(e => e.state === 'CONSUMER_ONLY');

  let md = `# Relatório de Divergência de API — api:check

**Gerado em:** ${now}
**Exit code:** ${exitCode} (${mode})
**Modo:** inicial

---

## Sumário

| Estado | Quantidade | Bloqueia? |
|--------|-----------|:---------:|
`;

  const iconMap: Record<DriftState, string> = {
    OK: '✅',
    CODE_ONLY: '⚠️',
    CONTRACT_ONLY: '📄',
    CONSUMER_ONLY: '🔍',
    UNUSED_ROUTE: '🕳️',
    ORPHAN_SUSPECT: '👻',
    UNCERTAIN: '❓',
  };

  const blockMap: Record<DriftState, string> = {
    OK: '❌',
    CODE_ONLY: '✅ (se novo)',
    CONTRACT_ONLY: '❌',
    CONSUMER_ONLY: '✅ (se new + high)',
    UNUSED_ROUTE: '❌',
    ORPHAN_SUSPECT: '❌',
    UNCERTAIN: '❌',
  };

  const stateOrder: DriftState[] = ['OK', 'CODE_ONLY', 'CONTRACT_ONLY', 'CONSUMER_ONLY', 'UNUSED_ROUTE', 'ORPHAN_SUSPECT', 'UNCERTAIN'];
  for (const state of stateOrder) {
    const count = stateCount.get(state) || 0;
    md += `| ${iconMap[state]} ${state} | ${count} | ${blockMap[state]} |\n`;
  }

  // Blocking section
  if (blockingEntries.length > 0) {
    md += `\n## Divergências bloqueantes\n\n⚠️ ${blockingEntries.length} divergência(s) nova(s) bloqueia(m) o build:\n\n`;
    md += `| App | Method | Path | Estado |\n`;
    md += `|-----|--------|------|--------|\n`;
    for (const e of blockingEntries) {
      md += `| ${e.app || '?'} | ${e.method} | \`${e.path}\` | ${e.state} |\n`;
    }
    md += `\n**Como resolver:** Adicionar a rota no OpenAPI com metadados x-artificio-*, OU adicionar na allowlist se for divergência legada.\n`;
  }

  // Details by app
  md += `\n## Detalhamento por app\n`;
  for (const [app, appEntries] of [...byApp.entries()].sort(byEntryKey)) {
    const invCount = appEntries.filter(e => e.inInventory).length;
    md += `\n### ${app} (${invCount} rotas no inventário)\n\n`;
    md += `| Method | Path | Estado | OpenAPI | Consumidor | Obs |\n`;
    md += `|--------|------|:-----:|:-------:|:----------:|-----|\n`;

    for (const e of appEntries) {
      const status = iconMap[e.state] + ' ' + e.state;
      const oasIcon = e.inOpenAPI ? '✅' : '❌';
      const consIcon = e.inConsumers ? '✅' : '❌';
      let obs = '';
      if (e.isNew && (e.state === 'CODE_ONLY' || (e.state === 'CONSUMER_ONLY' && e.confidence === 'high'))) {
        obs = '🆕 Novo! Bloqueante!';
      } else if (e.isNew) {
        obs = '🆕 Novo (não bloqueante)';
      } else if (e.isAllowed) {
        obs = '📋 Na allowlist (legado)';
      }
      md += `| ${e.method} | \`${e.path}\` | ${status} | ${oasIcon} | ${consIcon} | ${obs} |\n`;
    }
  }

  // Orphan suspects
  if (orphanEntries.length > 0) {
    md += `\n## Rotas órfãs suspeitas\n\n`;
    md += `Rotas existentes no código/OpenAPI, sem consumidor detectado e sem classificação que justifique.\n\n`;

    const byAppOrphan = new Map<string, DriftEntry[]>();
    for (const e of orphanEntries) {
      const app = e.app || 'unknown';
      if (!byAppOrphan.has(app)) byAppOrphan.set(app, []);
      byAppOrphan.get(app)!.push(e);
    }

    for (const [app, appOrphans] of [...byAppOrphan.entries()].sort(byEntryKey)) {
      md += `### ${app} (${appOrphans.length} rota(s))\n\n`;
      md += `| Method | Path | Tem OpenAPI? | Scope | Razão |\n`;
      md += `|--------|------|:-----------:|-------|-------|\n`;
      for (const e of appOrphans) {
        const scope = e.scope || '— (sem OpenAPI)';
        const reason = e.inOpenAPI
          ? 'Sem consumidor e scope não justifica'
          : 'CODE_ONLY sem classificação';
        md += `| ${e.method} | \`${e.path}\` | ${e.inOpenAPI ? '✅' : '❌'} | ${scope} | ${reason} |\n`;
      }
    }
  }

  // Code only summary
  if (codeOnly.length > 0) {
    md += `\n## Rotas sem OpenAPI (CODE_ONLY)\n\n`;
    md += `| App | Method | Path | Confidence |\n`;
    md += `|-----|--------|------|:---------:|\n`;
    for (const e of codeOnly) {
      md += `| ${e.app || '?'} | ${e.method} | \`${e.path}\` | ${e.confidence} |\n`;
    }
  }

  // Consumer only summary
  if (consumerOnly.length > 0) {
    md += `\n## Consumidores sem rota (CONSUMER_ONLY)\n\n`;
    md += `| App | Method | Path | Confidence |\n`;
    md += `|-----|--------|------|:---------:|\n`;
    for (const e of consumerOnly) {
      md += `| ${e.app || '?'} | ${e.method} | \`${e.path}\` | ${e.confidence} |\n`;
    }
  }

  // Allowlist recommendation
  md += `\n## Recomendação de allowlist\n\n`;
  md += `Para aceitar as divergências atuais como legado e não bloquear, execute:\n\n`;
  md += `\`\`\`bash\npnpm api:check --generate-allowlist\n\`\`\`\n`;

  return md;
}

// ═══════════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════════

function parseArgs(): { generateAllowlist: boolean; strict: boolean; baseDir: string } {
  const args = process.argv.slice(2);
  return {
    generateAllowlist: args.includes('--generate-allowlist'),
    strict: args.includes('--strict'),
    baseDir: resolve(import.meta.dirname, '../../docs/api'),
  };
}

function main(): void {
  const { generateAllowlist, strict, baseDir } = parseArgs();

  console.log(`\n🔍 api:check — Comparador 3-way de API${strict ? ' (--strict)' : ''}\n`);
  console.log(`   Base dir: ${baseDir}`);

  // 1. Load all sources
  const sources = loadAllSources(baseDir);

  const totalRoutes = sources.inventory.length;
  const totalConsumers = sources.consumers.length;
  const totalOas = sources.openapi.length;

  console.log(`   📦 Inventory: ${totalRoutes} rotas`);
  console.log(`   📦 Consumers: ${totalConsumers} chamadas`);
  console.log(`   📦 OpenAPI:   ${totalOas} operations`);

  if (totalRoutes === 0 && totalConsumers === 0 && totalOas === 0) {
    console.log('\n   ⚠️  Nenhuma fonte de dados encontrada. Nada a comparar.\n');
    process.exit(0);
  }

  // 2. Compare
  const entries = compareSources(sources);

  // 3. Load allowlist
  const allowlistPath = join(baseDir, '.api-allowlist.json');
  const allowlist = readAllowlist(allowlistPath);
  applyAllowlist(entries, allowlist);

  console.log(`   📊 ${entries.length} chaves únicas na comparação`);

  // 4. Generate allowlist if requested
  if (generateAllowlist) {
    generateAllowlistFile(entries, allowlistPath);
    process.exit(0);
  }

  // 5. Fase 6 — Detect orphans and duplicates (non-blocking)
  //    Fase 7 — Tráfego reduz falsos positivos de órfãs
  const orphans = detectOrphans(entries, sources.trafficKeys);
  const duplicates = detectDuplicates(entries, 90); // threshold mínimo 90 (DEB-055-16 — 75→80→90 após calibragem)
  const orphansPath = join(baseDir, 'generated', 'api-orphans.generated.md');
  generateOrphansReport(orphans, duplicates, orphansPath, sources.traffic.length);

  // 6. Calculate exit code (Fase 5 — CODE_ONLY/CONSUMER_ONLY blocking)
  let exitCode = calculateExitCode(entries);

  // 6b. Modo estrito (DEB-055-23): a allowlist deve estar VAZIA. Qualquer entry
  // legada = divergência varrida para debaixo do tapete → bloqueia. Isto impede
  // regressão (re-introduzir allowlist depois do verde). CODE_ONLY e CONSUMER_ONLY
  // high já bloqueiam em ambos os modos (calculateExitCode). Breaking changes são
  // tratados pelo step `api:diff` no CI (sem continue-on-error), não aqui.
  // CONSUMER_ONLY medium (consumidor chama rota inexistente) são bugs de app
  // rastreados como débito, não bloqueiam o gate de contrato.
  if (strict && allowlist.size > 0) {
    console.error(`  ❌ BLOQUEANTE (--strict): allowlist tem ${allowlist.size} entry(ies). Em modo estrito a allowlist deve estar vazia (alinhar a rota ou corrigir o contrato, não suprimir).`);
    exitCode = 1;
  }

  // 7. Generate main report
  const reportPath = join(baseDir, 'generated', 'api-drift.generated.md');
  const report = generateMarkdownReport(entries, allowlist, exitCode);
  writeFileSync(reportPath, report, 'utf-8');

  console.log(`   📝 Relatório: ${reportPath}`);
  console.log(`   📡 Tráfego:   ${sources.traffic.length} rotas observadas`);
  console.log(`   👻 Órfãs: ${orphans.length}`);
  console.log(`   🔀 Duplicatas: ${duplicates.length}`);
  console.log(`   🏁 Exit code: ${exitCode}\n`);

  process.exit(exitCode);
}

main();

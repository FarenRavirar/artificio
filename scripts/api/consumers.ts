#!/usr/bin/env tsx
/**
 * api:consumers — Escaneamento de consumidores de API nos frontends/packages.
 *
 * Uso:
 *   pnpm api:consumers
 *   pnpm api:consumers --include-tests
 *
 * Saída:
 *   docs/api/generated/api-consumers.generated.json
 *
 * Padrões detectados:
 *   1. fetch() nativo — literal, template, concatenação
 *   2. Wrappers conhecidos: authFetch, authGet/Post/Put/Patch/Delete, authenticatedFetch
 *   3. api.get/post/put/patch/delete() — mesas (apiClient) e glossario (Axios)
 *   4. Feature APIs: discordSyncApi.*(), inboxApi.*() — com prefix resolution
 *   5. api.*() centralizado — site-admin (namespace de métodos tipados)
 *   6. Server-side fetch() — backend que consome APIs externas
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { byEntryKey } from './sort-utils';

const GENERATED_AT = process.env.API_GENERATED_AT || '1970-01-01T00:00:00.000Z';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ConsumerEntry {
  app: string;
  consumerFile: string;
  method: string;
  endpoint: string;
  confidence: 'high' | 'medium' | 'low';
  pattern: 'literal' | 'template-literal' | 'concatenation' | 'service-wrapper' | 'unknown';
  wrapper?: string;
  line?: number;
}

interface ConsumerContext {
  results: ConsumerEntry[];
  includeTests: boolean;
}

type ConstMap = Map<string, ts.Expression>;

/** Cache global de paths extraídos do api.ts do site-admin (DEB-055-13) */
const siteAdminApiPathMap = new Map<string, { path: string; method: string }>();

// ─── Configuração ────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

/** Diretórios a escanear para consumo de API (frontends + packages) */
const SCAN_DIRS: string[] = [
  'apps/mesas/frontend/src',
  'apps/glossario/frontend/src',
  'apps/links/src',
  'apps/links/server/lib',    // server-side fetch (og.ts)
  'apps/site-admin/src',
  'apps/accounts/frontend/src',
  'apps/site/src',            // importer + feedback widget
  'packages/auth/src',
  'packages/ui/src',
];

/** Extensões de arquivo a escanear */
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Mapeamento de app name a partir do caminho */
function detectAppName(filePath: string): string {
  const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  if (rel.startsWith('apps/mesas')) return 'mesas-frontend';
  if (rel.startsWith('apps/glossario')) return 'glossario-frontend';
  if (rel.startsWith('apps/links')) return 'links-frontend';
  if (rel.startsWith('apps/site-admin')) return 'site-admin';
  if (rel.startsWith('apps/site')) return 'site-frontend';
  if (rel.startsWith('apps/accounts')) return 'accounts-frontend';
  if (rel.startsWith('packages/auth')) return 'packages/auth';
  if (rel.startsWith('packages/ui')) return 'packages/ui';
  return 'unknown';
}

// ─── Wrapper definitions ────────────────────────────────────────────────────

/** Wrappers conhecidos que fazem fetch internamente */
const KNOWN_WRAPPERS = new Set([
  'authFetch',
  'authenticatedFetch',
  'authGet',
  'authPost',
  'authPut',
  'authPatch',
  'authDelete',
]);

/** Wrappers que têm método HTTP implícito no nome */
const WRAPPER_METHOD_MAP: Record<string, string> = {
  'authGet': 'GET',
  'authPost': 'POST',
  'authPut': 'PUT',
  'authPatch': 'PATCH',
  'authDelete': 'DELETE',
};

/**
 * Feature APIs: objetos exportados onde cada método chama um helper interno
 * `apiFetch('/path', {method})` / `fileApiFetch('/path', ...)` prefixado por `const BASE`.
 * Mesmo padrão do site-admin. O path real vem do corpo do método (DEB-055-13),
 * não do nome — `createSource` → `POST /api/v1/admin/discord/sources`, não `/createSource`.
 */
const FEATURE_API_DEFS: { objIdent: string; fileMatch: string }[] = [
  { objIdent: 'discordSyncApi', fileMatch: 'discord-sync/api/discordSyncApi.ts' },
  { objIdent: 'inboxApi', fileMatch: 'inbox/api/inboxApi.ts' },
];

/** objIdent → (methodName → {path completo, método HTTP}) resolvido das defs */
const featureApiMethodMap = new Map<string, Map<string, { path: string; method: string }>>();

/** Apps que usam o padrão api.get/post/etc (apiClient + Axios) */
const API_OBJECT_KNOWN = new Set([
  'api',     // mesas (apiClient) + glossario (Axios)
]);

/**
 * Base path por app para o objeto `api` (DEB-055-13).
 * glossario usa axios com `baseURL` terminando em `/api`
 * (apps/glossario/frontend/src/services/api.ts), então `api.get('/terms')`
 * bate na rota real `/api/terms`. mesas usa API_BASE='' (path completo no call).
 */
const APP_API_BASE_PATH: Record<string, string> = {
  'glossario-frontend': '/api',
};

/** Aplica o base path do app a um endpoint relativo do objeto `api`. */
function applyAppBasePath(app: string, endpoint: string): string {
  const base = APP_API_BASE_PATH[app];
  if (!base) return endpoint;
  if (!endpoint.startsWith('/')) return endpoint;           // variável/concat não resolvida
  if (endpoint.startsWith(base + '/') || endpoint === base) return endpoint; // já prefixado
  if (endpoint.startsWith('/api/')) return endpoint;        // já absoluto
  return base + endpoint;
}

/** Funções que são wrappers de refresh/logout do packages/auth */
const AUTH_HELPER_FUNCTIONS = new Set([
  'refreshSession',
  'logout',
]);

// ─── Helpers AST ─────────────────────────────────────────────────────────────

function extractStringLiteral(node: ts.Node): string | null {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function getLine(node: ts.Node, sf: ts.SourceFile): number {
  return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function isTestFile(filePath: string): boolean {
  const name = path.basename(filePath);
  return (
    name.endsWith('.test.ts') ||
    name.endsWith('.spec.ts') ||
    name.endsWith('.test-d.ts') ||
    filePath.includes('__tests__')
  );
}

function isConcreteEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/') || endpoint.startsWith('http://') || endpoint.startsWith('https://');
}

function hasSyntheticEndpointSegment(endpoint: string): boolean {
  return endpoint.includes('<') || endpoint.includes('>') || endpoint.includes(':param:param');
}

function normalizeExtractedEndpoint(endpoint: string): string {
  // Template com origin dinâmico: `${apiUrl}/auth/discord/connect` vira
  // `:param/auth/discord/connect`; para governança local só importa o path.
  if (endpoint.startsWith(':param/')) return endpoint.slice(':param'.length);
  try {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return new URL(endpoint).pathname;
    }
  } catch {
    // mantém valor original; filtros seguintes descartam se não for path concreto
  }
  return endpoint;
}

/**
 * Remove artefato de query string montada por template condicional.
 * `/activity${qs ? '?'+qs : ''}` vira `/activity:param` (o `:param` cola no
 * segmento sem `/` antes). Um `:param` legítimo de rota é sempre precedido por
 * `/` (ex: `/sources/:param`). Então um `:param` colado a um não-`/` = query → cortar.
 */
function stripQueryParamArtifact(endpoint: string): string {
  return endpoint.replace(/([^/]):param.*$/, '$1').replace(/\?.*$/, '');
}

function addConsumerResult(ctx: ConsumerContext, entry: ConsumerEntry): void {
  if (entry.method === 'UNKNOWN') return;
  entry.endpoint = normalizeExtractedEndpoint(stripQueryParamArtifact(entry.endpoint));
  if (!isConcreteEndpoint(entry.endpoint)) return;
  if (hasSyntheticEndpointSegment(entry.endpoint)) return;
  ctx.results.push(entry);
}

function addExtractedConsumerResults(
  ctx: ConsumerContext,
  extracted: ExtractedPath,
  entry: Omit<ConsumerEntry, 'endpoint' | 'confidence' | 'pattern'>,
  mapEndpoint: (pathOption: string) => string = (pathOption) => pathOption,
): void {
  for (const pathOption of splitAlternativePaths(extracted, entry.method)) {
    addConsumerResult(ctx, {
      ...entry,
      endpoint: mapEndpoint(pathOption.path),
      confidence: pathOption.confidence,
      pattern: pathOption.pattern,
    });
  }
}

// ─── Extração de path de expressões ─────────────────────────────────────────

interface ExtractedPath {
  path: string;
  pattern: ConsumerEntry['pattern'];
  confidence: ConsumerEntry['confidence'];
}

function extractPathFromArg(node: ts.Expression, consts: ConstMap = new Map()): ExtractedPath {
  // String literal: '/api/me'
  const literal = extractStringLiteral(node);
  if (literal) {
    return { path: literal, pattern: 'literal', confidence: 'high' };
  }

  // Template literal com expressões: `/api/groups/${slug}/report`
  if (ts.isTemplateExpression(node)) {
    // Extrair partes literais e montar pattern com placeholders
    const parts: string[] = [];
    let hasVar = false;
    parts.push(node.head.text);
    for (const span of node.templateSpans) {
      parts.push(`:param`);
      hasVar = true;
      parts.push(span.literal.text);
    }
    const pattern = parts.join('');
    return {
      path: pattern,
      pattern: 'template-literal',
      confidence: hasVar ? 'medium' : 'high',
    };
  }

  // Concatenação binária: '/api/groups/' + slug + '/report'
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = extractPathFromArg(node.left, consts);
    const right = extractPathFromArg(node.right, consts);
    const combined = left.path + right.path;
    return {
      path: combined,
      pattern: 'concatenation',
      confidence: left.confidence === 'high' && right.confidence === 'high' ? 'medium' : 'low',
    };
  }

  // Identifier (variável): endpoint
  if (ts.isIdentifier(node)) {
    const resolved = consts.get(node.text);
    if (resolved && resolved !== node) return extractPathFromArg(resolved, consts);
    return {
      path: ':param',
      pattern: 'unknown',
      confidence: 'low',
    };
  }

  if (ts.isConditionalExpression(node)) {
    const whenTrue = extractPathFromArg(node.whenTrue, consts);
    const whenFalse = extractPathFromArg(node.whenFalse, consts);
    return {
      path: `${whenTrue.path}|${whenFalse.path}`,
      pattern: whenTrue.pattern === whenFalse.pattern ? whenTrue.pattern : 'unknown',
      confidence: 'medium',
    };
  }

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node)) {
    return { path: ':param', pattern: 'unknown', confidence: 'low' };
  }

  return { path: '<unknown>', pattern: 'unknown', confidence: 'low' };
}

function splitAlternativePaths(extracted: ExtractedPath, method: string): ExtractedPath[] {
  if (!extracted.path.includes('|')) return [extracted];

  const alternatives = extracted.path
    .split('|')
    .map((pathPart) => ({
      ...extracted,
      path: pathPart,
      confidence: 'medium' as const,
    }))
    .filter((item) => item.path && item.path !== '<unknown>');

  if (alternatives.length <= 1) return alternatives;

  // Ternário típico: `isEditing ? /resource/:id : /resource`.
  // POST cria coleção; PUT/PATCH/DELETE atuam em item. Evita gerar consumidor
  // falso cruzando método com ramo incompatível.
  if (method === 'POST') {
    const collection = alternatives.filter((item) => !item.path.includes(':param'));
    if (collection.length > 0) return collection;
  }
  if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const detail = alternatives.filter((item) => item.path.includes(':param'));
    if (detail.length > 0) return detail;
  }

  return alternatives;
}

function collectStringLikeConsts(sf: ts.SourceFile): ConstMap {
  const consts: ConstMap = new Map();

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (
        extractStringLiteral(node.initializer) ||
        ts.isTemplateExpression(node.initializer) ||
        ts.isConditionalExpression(node.initializer) ||
        (ts.isBinaryExpression(node.initializer) && node.initializer.operatorToken.kind === ts.SyntaxKind.PlusToken)
      ) {
        consts.set(node.name.text, node.initializer);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return consts;
}

// ─── Scanners de padrão ─────────────────────────────────────────────────────

/**
 * Passo 1: scan fetch() calls
 * Detecta CallExpression onde callee.name === 'fetch'
 */
function toRelPath(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

function scanFetchCalls(sf: ts.SourceFile, filePath: string, ctx: ConsumerContext): void {
  const app = detectAppName(filePath);
  const relativePath = toRelPath(filePath);
  const consts = collectStringLikeConsts(sf);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      // fetch(url, init?)
      if (ts.isIdentifier(callee) && callee.text === 'fetch') {
        const arg0 = node.arguments[0];
        if (!arg0) { ts.forEachChild(node, visit); return; }

        const extracted = extractPathFromArg(arg0, consts);
        // Detectar method no 2º argumento (init)
        let method = 'GET';
        if (node.arguments.length >= 2) {
          const initArg = node.arguments[1];
          method = extractMethodFromInit(initArg) || 'GET';
        }

        addExtractedConsumerResults(ctx, extracted, {
          app,
          consumerFile: relativePath,
          method,
          wrapper: 'fetch',
          line: getLine(node, sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

/** Extrai method de um objeto init: { method: 'POST' } */
function extractMethodFromInit(node: ts.Expression): string | null {
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'method') {
        const val = extractStringLiteral(prop.initializer);
        if (val) return val;
      }
    }
  }
  return null;
}

/**
 * Passo 2: scan known wrappers
 * authFetch(url, init?), authGet/Post/Put/Patch/Delete(path, ...), authenticatedFetch
 */
function scanKnownWrappers(sf: ts.SourceFile, filePath: string, ctx: ConsumerContext): void {
  const app = detectAppName(filePath);
  const relativePath = toRelPath(filePath);
  const consts = collectStringLikeConsts(sf);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;

      // authFetch(url, init?)
      if (ts.isIdentifier(callee) && KNOWN_WRAPPERS.has(callee.text)) {
        const fnName = callee.text;
        const arg0 = node.arguments[0];
        if (!arg0) { ts.forEachChild(node, visit); return; }

        const extracted = extractPathFromArg(arg0, consts);
        // Determinar method
        let method = WRAPPER_METHOD_MAP[fnName] || 'GET';

        // Para authFetch, pode ter method no init
        if (fnName === 'authFetch' || fnName === 'authenticatedFetch') {
          if (node.arguments.length >= 2) {
            const initArg = node.arguments[1];
            method = extractMethodFromInit(initArg) || 'GET';
          }
        }

        addExtractedConsumerResults(ctx, extracted, {
          app,
          consumerFile: relativePath,
          method,
          wrapper: fnName,
          line: getLine(node, sf),
        });
      }

      // auth helper functions (logout, refreshSession)
      if (ts.isIdentifier(callee) && AUTH_HELPER_FUNCTIONS.has(callee.text)) {
        // Essas chamam fetch internamente — marcar sem path
        addConsumerResult(ctx, {
          app,
          consumerFile: relativePath,
          method: 'UNKNOWN',
          endpoint: `<${callee.text}>`,
          confidence: 'low',
          pattern: 'service-wrapper',
          wrapper: callee.text,
          line: getLine(node, sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

/**
 * Passo 3: scan api.get/post/put/patch/delete() — mesas apiClient + glossario Axios
 * Detecta chamadas onde objIdent é 'api' e método é HTTP method.
 */
function scanApiMethodCalls(sf: ts.SourceFile, filePath: string, ctx: ConsumerContext): void {
  const app = detectAppName(filePath);
  const relativePath = toRelPath(filePath);
  const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
  const consts = collectStringLikeConsts(sf);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (!ts.isPropertyAccessExpression(callee)) { ts.forEachChild(node, visit); return; }

      const objIdent = ts.isIdentifier(callee.expression) ? callee.expression.text : null;
      const methodName = callee.name.text;

      if (objIdent === 'api' && HTTP_METHODS.has(methodName)) {
        const arg0 = node.arguments[0];
        if (!arg0) { ts.forEachChild(node, visit); return; }
        const extracted = extractPathFromArg(arg0, consts);

        const method = methodName.toUpperCase();
        addExtractedConsumerResults(
          ctx,
          extracted,
          {
            app,
            consumerFile: relativePath,
            method,
            wrapper: `api.${methodName}`,
            line: getLine(node, sf),
          },
          (pathOption) => applyAppBasePath(app, pathOption),
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

/**
 * Pré-passe (passo 4): constrói featureApiMethodMap a partir dos arquivos de
 * definição. Lê `const BASE`, o objeto exportado e resolve o path real de cada
 * método pelo helper interno (apiFetch/fileApiFetch).
 */
function buildFeatureApiMap(sf: ts.SourceFile, filePath: string): void {
  const relativePath = toRelPath(filePath);
  const def = FEATURE_API_DEFS.find((d) => relativePath.endsWith(d.fileMatch));
  if (!def) return;

  // Resolver const BASE = '...'
  let base = '';
  function findBase(node: ts.Node) {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === 'BASE' && decl.initializer) {
          const lit = extractStringLiteral(decl.initializer);
          if (lit) base = lit;
        }
      }
    }
    ts.forEachChild(node, findBase);
  }
  findBase(sf);

  const methodMap = new Map<string, { path: string; method: string }>();

  function findObject(node: ts.Node) {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === def!.objIdent &&
            decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          for (const prop of decl.initializer.properties) {
            if (!ts.isPropertyAssignment(prop) && !ts.isMethodDeclaration(prop)) continue;
            if (!prop.name || !ts.isIdentifier(prop.name)) continue;
            const resolved = resolveFeatureMethod(prop, base);
            if (resolved) methodMap.set(prop.name.text, resolved);
          }
        }
      }
    }
    ts.forEachChild(node, findObject);
  }
  findObject(sf);

  if (methodMap.size > 0) featureApiMethodMap.set(def.objIdent, methodMap);
}

/** Resolve {path, method} do corpo de um método de feature API. */
function resolveFeatureMethod(
  prop: ts.PropertyAssignment | ts.MethodDeclaration,
  base: string,
): { path: string; method: string } | null {
  let body: ts.Node | undefined;
  if (ts.isPropertyAssignment(prop)) {
    const init = prop.initializer;
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) body = init.body;
  } else {
    body = prop.body;
  }
  if (!body) return null;

  // Coletar consts locais (para resolver path em variável: const url = ... ? ... : '/x')
  const localConsts = new Map<string, ts.Expression>();
  function collectConsts(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      localConsts.set(n.name.text, n.initializer);
    }
    ts.forEachChild(n, collectConsts);
  }
  collectConsts(body);

  // Achar a chamada ao helper (apiFetch / fileApiFetch)
  const holder: { call: ts.CallExpression; helper: string }[] = [];
  function findHelper(n: ts.Node) {
    if (holder.length > 0) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const name = n.expression.text;
      if (name === 'apiFetch' || name === 'fileApiFetch') {
        holder.push({ call: n, helper: name });
        return;
      }
    }
    ts.forEachChild(n, findHelper);
  }
  findHelper(body);
  if (holder.length === 0) return null;

  const callExpr: ts.CallExpression = holder[0].call;
  const helper: string = holder[0].helper;
  const arg0 = callExpr.arguments[0];
  if (!arg0) return null;

  let pathStr = resolvePathExpr(arg0, localConsts);
  if (!pathStr) return null;
  pathStr = pathStr.split('?')[0]; // remover query string

  // método: fileApiFetch sempre POST; apiFetch via options.method (default GET)
  let method = 'GET';
  if (helper === 'fileApiFetch') {
    method = 'POST';
  } else if (callExpr.arguments.length >= 2 && ts.isObjectLiteralExpression(callExpr.arguments[1])) {
    for (const p of callExpr.arguments[1].properties) {
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'method') {
        const m = extractStringLiteral(p.initializer);
        if (m) method = m.toUpperCase();
      }
    }
  }

  return { path: `${base}${pathStr}`, method };
}

/** Resolve uma expressão de path para string com :param, seguindo consts e ternários. */
function resolvePathExpr(node: ts.Expression, localConsts: Map<string, ts.Expression>): string {
  const lit = extractStringLiteral(node);
  if (lit) return lit;
  if (ts.isTemplateExpression(node)) {
    const parts: string[] = [node.head.text];
    for (const span of node.templateSpans) {
      parts.push(':param', span.literal.text);
    }
    return parts.join('');
  }
  // Identifier → resolver const local
  if (ts.isIdentifier(node)) {
    const ref = localConsts.get(node.text);
    if (ref && ref !== node) return resolvePathExpr(ref, localConsts);
    return '';
  }
  // Ternário: usar o ramo "else" (geralmente o path sem query)
  if (ts.isConditionalExpression(node)) {
    const whenFalse = resolvePathExpr(node.whenFalse, localConsts);
    if (whenFalse) return whenFalse;
    return resolvePathExpr(node.whenTrue, localConsts);
  }
  return '';
}

/**
 * Passo 4 (use-pass): detecta discordSyncApi.*(), inboxApi.*() e resolve o path
 * real via featureApiMethodMap.
 */
function scanFeatureApis(sf: ts.SourceFile, filePath: string, ctx: ConsumerContext): void {
  const app = detectAppName(filePath);
  const relativePath = toRelPath(filePath);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (!ts.isPropertyAccessExpression(callee)) { ts.forEachChild(node, visit); return; }

      const objIdent = ts.isIdentifier(callee.expression) ? callee.expression.text : null;
      const methodMap = objIdent ? featureApiMethodMap.get(objIdent) : undefined;
      if (!objIdent || !methodMap) { ts.forEachChild(node, visit); return; }

      const methodName = callee.name.text;
      const resolved = methodMap.get(methodName);

      if (resolved) {
        addConsumerResult(ctx, {
          app,
          consumerFile: relativePath,
          method: resolved.method,
          endpoint: resolved.path,
          confidence: 'high',
          pattern: 'service-wrapper',
          wrapper: `${objIdent}.${methodName}`,
          line: getLine(node, sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

/**
 * Passo 5: scan api.*() centralizado (site-admin)
 * Detecta chamadas ao objeto `api` exportado em site-admin.
 *
 * Estratégia (DEB-055-13): dois passes —
 *   1. Pré-passe: extrai path+method do objeto `api` (chamadas req() internas)
 *   2. Passe de uso: detecta `api.*()` e usa o mapa de paths
 */
function scanCentralizedApi(sf: ts.SourceFile, filePath: string, ctx: ConsumerContext): void {
  const app = detectAppName(filePath);
  const relativePath = toRelPath(filePath);

  // ── Pré-passe: extrair paths do objeto api (só no arquivo api.ts) ──
  if (relativePath.includes('site-admin/src/api.ts') || relativePath.includes('site-admin\\src\\api.ts')) {
    function extractApiPaths(node: ts.Node) {
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === 'api' && decl.initializer) {
            scanObjectLiteralForReq(decl.initializer);
          }
        }
      }
      ts.forEachChild(node, extractApiPaths);
    }

    function scanObjectLiteralForReq(node: ts.Node) {
      if (!ts.isObjectLiteralExpression(node)) return;
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
        const methodName = prop.name.text;
        const pathInfo = extractArrowBodyReqPath(prop.initializer);
        if (pathInfo) {
          siteAdminApiPathMap.set(methodName, pathInfo);
        }
      }
    }

    /** Extrai path e método de chamadas req() dentro do corpo de arrow function/function. */
    function extractArrowBodyReqPath(node: ts.Node): { path: string; method: string } | null {
      let body: ts.Node | undefined;
      if (ts.isArrowFunction(node)) body = node.body;
      else if (ts.isFunctionExpression(node)) body = node.body;
      else return null;

      // Procura req(...) recursivamente (pode estar em .then())
      function findReqCall(n: ts.Node): ts.CallExpression | null {
        if (ts.isCallExpression(n)) {
          const callee = n.expression;
          if (ts.isIdentifier(callee) && (callee.text === 'req' || callee.text === 'authFetch')) return n;
          if (ts.isPropertyAccessExpression(callee)) return findReqCall(callee.expression);
        }
        if (ts.isBlock(n)) {
          for (const stmt of (n as ts.Block).statements) {
            if (ts.isReturnStatement(stmt) && stmt.expression) {
              const found = findReqCall(stmt.expression);
              if (found) return found;
            }
          }
        }
        return null;
      }

      const reqCall = findReqCall(body);
      if (!reqCall) return null;

      // Extrai path e método
      const args = reqCall.arguments;
      if (args.length < 1) return null;

      // path: primeiro argumento (string literal, template, ou BASE + template)
      let pathStr = '';
      const arg0 = args[0];
      if (ts.isStringLiteral(arg0) || ts.isNoSubstitutionTemplateLiteral(arg0)) {
        pathStr = arg0.text;
      } else if (ts.isTemplateExpression(arg0)) {
        pathStr = arg0.getText(sf).replace(/^[`'"]|[`'"]$/g, '').replace(/\$\{[^}]+\}/g, ':param');
      } else if (ts.isBinaryExpression(arg0) && arg0.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const right = arg0.right;
        if (ts.isStringLiteral(right) || ts.isNoSubstitutionTemplateLiteral(right)) {
          pathStr = right.text;
        } else if (ts.isTemplateExpression(right)) {
          pathStr = right.getText(sf).replace(/^[`'"]|[`'"]$/g, '').replace(/\$\{[^}]+\}/g, ':param');
        }
      }

      if (!pathStr) return null;

      // método: req(path) = GET, req(path, {method: "POST"}) = extrai
      let method = 'GET';
      if (args.length >= 2 && ts.isObjectLiteralExpression(args[1])) {
        for (const prop of args[1].properties) {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'method') {
            const m = extractStringLiteral(prop.initializer);
            if (m && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m.toUpperCase())) {
              method = m.toUpperCase();
            }
          }
        }
      }

      return { path: pathStr, method };
    }

    extractApiPaths(sf);
  }

  // ── Passe de uso: detectar api.*() ──
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (!ts.isPropertyAccessExpression(callee)) { ts.forEachChild(node, visit); return; }

      const objIdent = ts.isIdentifier(callee.expression) ? callee.expression.text : null;
      if (objIdent !== 'api') { ts.forEachChild(node, visit); return; }

      const methodName = callee.name.text;

      const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
      if (HTTP_METHODS.has(methodName)) { ts.forEachChild(node, visit); return; }

      // Só registra quando o wrapper resolve para um endpoint concreto.
      // Wrappers não resolvidos não viram resultado (o endpoint sintético
      // `<...>` seria descartado por hasSyntheticEndpointSegment de qualquer forma).
      const resolved = siteAdminApiPathMap.get(methodName);
      if (resolved) {
        addConsumerResult(ctx, {
          app,
          consumerFile: relativePath,
          method: resolved.method,
          endpoint: `/api/admin/v1${resolved.path}`,
          confidence: 'high',
          pattern: 'service-wrapper',
          wrapper: `api.${methodName}`,
          line: getLine(node, sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

/**
 * Passo 6: scan refreshSession() chamadas no site-admin
 * detecta fetch(`${ACCOUNTS_ORIGIN}/api/auth/refresh`)
 */
function scanAuthRefreshCalls(sf: ts.SourceFile, filePath: string, ctx: ConsumerContext): void {
  const app = detectAppName(filePath);
  const relativePath = toRelPath(filePath);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      // refreshSession() que chama fetch internamente
      if (ts.isIdentifier(callee) && callee.text === 'refreshSession') {
        addConsumerResult(ctx, {
          app,
          consumerFile: relativePath,
          method: 'GET',
          endpoint: `/api/auth/refresh`,
          confidence: 'high',
          pattern: 'service-wrapper',
          wrapper: 'refreshSession',
          line: getLine(node, sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

// ─── Scanner principal ──────────────────────────────────────────────────────

function scanFile(filePath: string, ctx: ConsumerContext): void {
  if (!ctx.includeTests && isTestFile(filePath)) return;

  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  // Aplicar todos os passes no arquivo
  scanFetchCalls(sf, filePath, ctx);
  scanKnownWrappers(sf, filePath, ctx);
  scanApiMethodCalls(sf, filePath, ctx);
  scanFeatureApis(sf, filePath, ctx);
  scanCentralizedApi(sf, filePath, ctx);
  scanAuthRefreshCalls(sf, filePath, ctx);
}

function walkDir(dir: string, ctx: ConsumerContext): void {
  const absDir = path.resolve(REPO_ROOT, dir);
  if (!fs.existsSync(absDir)) return;

  const entries = fs.readdirSync(absDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(absDir, entry.name);

    if (entry.isDirectory()) {
      // Pular node_modules e .git
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.generated') continue;
      walkDir(path.relative(REPO_ROOT, fullPath), ctx);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (FILE_EXTENSIONS.includes(ext)) {
        scanFile(fullPath, ctx);
      }
    }
  }
}

// ─── Geração de saída ───────────────────────────────────────────────────────

function generateOutput(entries: ConsumerEntry[]): object {
  entries.sort((a, b) => {
    if (a.app !== b.app) return a.app.localeCompare(b.app);
    if (a.endpoint !== b.endpoint) return a.endpoint.localeCompare(b.endpoint);
    return a.consumerFile.localeCompare(b.consumerFile);
  });

  // Estatísticas
  const byApp = new Map<string, ConsumerEntry[]>();
  for (const e of entries) {
    if (!byApp.has(e.app)) byApp.set(e.app, []);
    byApp.get(e.app)!.push(e);
  }

  // Remove duplicates (same app + same endpoint + same method + same file)
  const unique = new Map<string, ConsumerEntry>();
  for (const e of entries) {
    const key = `${e.app}|${e.endpoint}|${e.method}|${e.consumerFile}`;
    // Keep the one with highest confidence
    if (!unique.has(key)) {
      unique.set(key, e);
    } else {
      const existing = unique.get(key)!;
      const confRank = { high: 3, medium: 2, low: 1 };
      if (confRank[e.confidence] > confRank[existing.confidence]) {
        unique.set(key, e);
      }
    }
  }
  const deduped = Array.from(unique.values());

  const stats = {
    total: entries.length,
    uniqueEndpoints: deduped.length,
    byApp: Object.fromEntries(
      Array.from(byApp.entries()).map(([app, appEntries]) => [
        app,
        {
          total: appEntries.length,
          byConfidence: Object.fromEntries(
            Array.from(
              appEntries.reduce((acc, e) => {
                acc.set(e.confidence, (acc.get(e.confidence) || 0) + 1);
                return acc;
              }, new Map<string, number>())
            )
          ),
          byPattern: Object.fromEntries(
            Array.from(
              appEntries.reduce((acc, e) => {
                acc.set(e.pattern, (acc.get(e.pattern) || 0) + 1);
                return acc;
              }, new Map<string, number>())
            )
          ),
        },
      ])
    ),
    generatedAt: GENERATED_AT,
    script: 'scripts/api/consumers.ts',
  };

  return {
    metadata: stats,
    consumers: deduped.map((e) => ({
      app: e.app,
      consumerFile: e.consumerFile,
      method: e.method,
      endpoint: e.endpoint,
      confidence: e.confidence,
      pattern: e.pattern,
      wrapper: e.wrapper,
      line: e.line,
    })),
  };
}

// ─── Função principal ────────────────────────────────────────────────────────

function main(): void {
  const includeTests = process.argv.includes('--include-tests');

  const ctx: ConsumerContext = {
    results: [],
    includeTests,
  };

  // Pré-passe (DEB-055-13): escanear api.ts do site-admin primeiro
  // para popular o cache global de paths antes de escanear os consumidores
  const siteAdminApiPath = path.resolve(REPO_ROOT, 'apps/site-admin/src/api.ts');
  if (fs.existsSync(siteAdminApiPath)) {
    const source = fs.readFileSync(siteAdminApiPath, 'utf-8');
    const sf = ts.createSourceFile(siteAdminApiPath, source, ts.ScriptTarget.Latest, true);
    scanCentralizedApi(sf, siteAdminApiPath, ctx);
  }

  // Pré-passe feature APIs (DEB-055-13): resolver method→path real das defs
  for (const def of FEATURE_API_DEFS) {
    const defPath = path.resolve(REPO_ROOT, 'apps/mesas/frontend/src/features', def.fileMatch);
    if (fs.existsSync(defPath)) {
      const source = fs.readFileSync(defPath, 'utf-8');
      const sf = ts.createSourceFile(defPath, source, ts.ScriptTarget.Latest, true);
      buildFeatureApiMap(sf, defPath);
    }
  }

  for (const dir of SCAN_DIRS) {
    walkDir(dir, ctx);
  }

  const json = generateOutput(ctx.results);

  // Escrever JSON
  const jsonDir = path.resolve(REPO_ROOT, 'docs/api/generated');
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }

  const jsonPath = path.join(jsonDir, 'api-consumers.generated.json');
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf-8');

  // Resumo no console
  const byApp = new Map<string, ConsumerEntry[]>();
  for (const r of ctx.results) {
    if (!byApp.has(r.app)) byApp.set(r.app, []);
    byApp.get(r.app)!.push(r);
  }

  const totalUnique = new Set(ctx.results.map(r => `${r.app}|${r.endpoint}`)).size;

  console.log(`\n📊 api:consumers — Resumo`);
  console.log(`   Total de chamadas: ${ctx.results.length}`);
  console.log(`   Endpoints únicos:  ${totalUnique}`);
  for (const [app, entries] of Array.from(byApp.entries()).sort(byEntryKey)) {
    const uniqueEndpoints = new Set(entries.map(e => e.endpoint)).size;
    const high = entries.filter(e => e.confidence === 'high').length;
    const low = entries.filter(e => e.confidence === 'low').length;
    console.log(`   ${app}: ${entries.length} chamadas, ${uniqueEndpoints} endpoints (HIGH: ${high}, LOW: ${low})`);
  }

  console.log(`\n✅ JSON: ${path.relative(REPO_ROOT, jsonPath)}`);
}

main();

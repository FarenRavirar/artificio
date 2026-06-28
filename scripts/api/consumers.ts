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
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.astro'];

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

/** Feature APIs com prefixo conhecido (path montado internamente) */
const FEATURE_API_PREFIX: Record<string, string> = {
  'discordSyncApi': '/api/v1/admin/discord',
  'inboxApi': '/api/v1/admin/import',
};

/** Apps que usam o padrão api.get/post/etc (apiClient + Axios) */
const API_OBJECT_KNOWN = new Set([
  'api',     // mesas (apiClient) + glossario (Axios)
]);

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

// ─── Extração de path de expressões ─────────────────────────────────────────

interface ExtractedPath {
  path: string;
  pattern: ConsumerEntry['pattern'];
  confidence: ConsumerEntry['confidence'];
}

function extractPathFromArg(node: ts.Expression): ExtractedPath {
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
    const left = extractPathFromArg(node.left);
    const right = extractPathFromArg(node.right);
    const combined = left.path + right.path;
    return {
      path: combined,
      pattern: 'concatenation',
      confidence: 'low',
    };
  }

  // Identifier (variável): endpoint
  if (ts.isIdentifier(node)) {
    return {
      path: node.text,
      pattern: 'unknown',
      confidence: 'low',
    };
  }

  return { path: '<unknown>', pattern: 'unknown', confidence: 'low' };
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

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      // fetch(url, init?)
      if (ts.isIdentifier(callee) && callee.text === 'fetch') {
        const arg0 = node.arguments[0];
        if (!arg0) { ts.forEachChild(node, visit); return; }

        const extracted = extractPathFromArg(arg0);
        // Detectar method no 2º argumento (init)
        let method = 'GET';
        if (node.arguments.length >= 2) {
          const initArg = node.arguments[1];
          method = extractMethodFromInit(initArg) || 'GET';
        }

        ctx.results.push({
          app,
          consumerFile: relativePath,
          method,
          endpoint: extracted.path,
          confidence: extracted.confidence,
          pattern: extracted.pattern,
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

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;

      // authFetch(url, init?)
      if (ts.isIdentifier(callee) && KNOWN_WRAPPERS.has(callee.text)) {
        const fnName = callee.text;
        const arg0 = node.arguments[0];
        if (!arg0) { ts.forEachChild(node, visit); return; }

        const extracted = extractPathFromArg(arg0);
        // Determinar method
        let method = WRAPPER_METHOD_MAP[fnName] || 'GET';

        // Para authFetch, pode ter method no init
        if (fnName === 'authFetch' || fnName === 'authenticatedFetch') {
          if (node.arguments.length >= 2) {
            const initArg = node.arguments[1];
            method = extractMethodFromInit(initArg) || 'GET';
          }
        }

        ctx.results.push({
          app,
          consumerFile: relativePath,
          method,
          endpoint: extracted.path,
          confidence: extracted.confidence,
          pattern: extracted.pattern,
          wrapper: fnName,
          line: getLine(node, sf),
        });
      }

      // auth helper functions (logout, refreshSession)
      if (ts.isIdentifier(callee) && AUTH_HELPER_FUNCTIONS.has(callee.text)) {
        // Essas chamam fetch internamente — marcar sem path
        ctx.results.push({
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

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (!ts.isPropertyAccessExpression(callee)) { ts.forEachChild(node, visit); return; }

      const objIdent = ts.isIdentifier(callee.expression) ? callee.expression.text : null;
      const methodName = callee.name.text;

      if (objIdent === 'api' && HTTP_METHODS.has(methodName)) {
        const arg0 = node.arguments[0];
        if (!arg0) { ts.forEachChild(node, visit); return; }
        const extracted = extractPathFromArg(arg0);

        ctx.results.push({
          app,
          consumerFile: relativePath,
          method: methodName.toUpperCase(),
          endpoint: extracted.path,
          confidence: extracted.confidence,
          pattern: extracted.pattern,
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
 * Passo 4: scan feature APIs
 * discordSyncApi.*(), inboxApi.*() — com prefixo conhecido
 */
function scanFeatureApis(sf: ts.SourceFile, filePath: string, ctx: ConsumerContext): void {
  const app = detectAppName(filePath);
  const relativePath = toRelPath(filePath);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (!ts.isPropertyAccessExpression(callee)) { ts.forEachChild(node, visit); return; }

      const objIdent = ts.isIdentifier(callee.expression) ? callee.expression.text : null;
      if (!objIdent || !FEATURE_API_PREFIX[objIdent]) { ts.forEachChild(node, visit); return; }

      const prefix = FEATURE_API_PREFIX[objIdent];
      const methodName = callee.name.text;

      // Tentar obter path do primeiro argumento, se houver
      // Para métodos sem argumento (ex: listDrafts()), o path é inferido do nome
      let path = '/' + methodName
        .replace(/^(get|list|fetch)/, '')
        .replace(/^([A-Z])/, (_, c) => c.toLowerCase());

      const arg0 = node.arguments[0];
      if (arg0) {
        const extracted = extractPathFromArg(arg0);
        // Se for literal, usar como path
        if (extracted.confidence === 'high' || extracted.confidence === 'medium') {
          path = extracted.path;
        }
      }

      const fullPath = `${prefix}${path}`;

      // Método HTTP deduzido do nome da função
      const inferredMethod = inferMethodFromName(methodName);

      ctx.results.push({
        app,
        consumerFile: relativePath,
        method: inferredMethod,
        endpoint: fullPath,
        confidence: 'medium',
        pattern: 'service-wrapper',
        wrapper: `${objIdent}.${methodName}`,
        line: getLine(node, sf),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

function inferMethodFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('get') || lower.startsWith('list') || lower.startsWith('fetch')) return 'GET';
  if (lower.startsWith('post') || lower.startsWith('create') || lower.startsWith('import')
    || lower.startsWith('sync') || lower.startsWith('reparse') || lower.startsWith('correct')
    || lower.startsWith('refresh') || lower.startsWith('reingest')) return 'POST';
  if (lower.startsWith('put') || lower.startsWith('update')) return 'PUT';
  if (lower.startsWith('patch')) return 'PATCH';
  if (lower.startsWith('delete') || lower.startsWith('remove')) return 'DELETE';
  return 'UNKNOWN';
}

/**
 * Passo 5: scan api.*() centralizado (site-admin)
 * Detecta chamadas ao objeto `api` exportado em site-admin
 * (api.listPosts(), api.getPost(), etc.)
 */
function scanCentralizedApi(sf: ts.SourceFile, filePath: string, ctx: ConsumerContext): void {
  const app = detectAppName(filePath);
  const relativePath = toRelPath(filePath);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (!ts.isPropertyAccessExpression(callee)) { ts.forEachChild(node, visit); return; }

      const objIdent = ts.isIdentifier(callee.expression) ? callee.expression.text : null;
      if (objIdent !== 'api') { ts.forEachChild(node, visit); return; }

      const methodName = callee.name.text;

      // Ignorar chamadas api.get/post (já cobertas no Passo 3)
      const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
      if (HTTP_METHODS.has(methodName)) { ts.forEachChild(node, visit); return; }

      // api.*() — tenta encontrar onde o path está definido
      // O path é construído internamente via req(BASE + path) ou authFetch(BASE + path)
      // Não temos acesso estático ao path real, mas marcamos como existente
      ctx.results.push({
        app,
        consumerFile: relativePath,
        method: inferMethodFromName(methodName),
        endpoint: `/api/admin/v1/<${methodName}>`,
        confidence: 'low',
        pattern: 'service-wrapper',
        wrapper: `api.${methodName}`,
        line: getLine(node, sf),
      });
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
        ctx.results.push({
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
    generatedAt: new Date().toISOString(),
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
  for (const [app, entries] of Array.from(byApp.entries()).sort()) {
    const uniqueEndpoints = new Set(entries.map(e => e.endpoint)).size;
    const high = entries.filter(e => e.confidence === 'high').length;
    const low = entries.filter(e => e.confidence === 'low').length;
    console.log(`   ${app}: ${entries.length} chamadas, ${uniqueEndpoints} endpoints (HIGH: ${high}, LOW: ${low})`);
  }

  console.log(`\n✅ JSON: ${path.relative(REPO_ROOT, jsonPath)}`);
}

main();

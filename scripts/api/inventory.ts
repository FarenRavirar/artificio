#!/usr/bin/env tsx
/**
 * api:inventory — Escaneamento estático de rotas Express nos 4 apps do monorepo.
 *
 * Uso:
 *   pnpm api:inventory
 *   pnpm api:inventory --include-tests   # inclui arquivos de teste
 *
 * Saída:
 *   docs/api/generated/api-inventory.generated.json  — JSON estruturado
 *   docs/api/generated/api-map.generated.md          — Markdown legível
 *
 * Stack: TypeScript Compiler API (já disponível como devDependency).
 * Express 5 em accounts, glossario, links, mesas.
 *
 * Padrões detectados:
 *   - Rotas diretas app.METHOD(path, ...)
 *   - Rotas com middlewares (1º arg string = path)
 *   - app.use('/prefix', router) — montagem
 *   - Router() com métodos HTTP
 *   - router.use('/subprefix', subRouter) — subrouters aninhados
 *   - Array de paths: app.get(["/a", "/b"], ...)
 *   - Factory functions (confidence: low)
 *   - Múltiplos prefixos para o mesmo router
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { byLocale, byEntryKey } from './sort-utils';

const GENERATED_AT = process.env.API_GENERATED_AT || '1970-01-01T00:00:00.000Z';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RouteEntry {
  app: string;
  method: string;
  path: string;
  sourceFile: string;
  line?: number;
  confidence: 'high' | 'medium' | 'low';
  kind: 'express-route' | 'mount' | 'unknown';
}

interface ScannerContext {
  results: RouteEntry[];
  appName: string;
  includeTests: boolean;
  processedRouters: Set<string>;  // "filePath::scopeVar" pairs already scanned
}

// ─── Configuração dos apps ───────────────────────────────────────────────────

interface AppConfig {
  name: string;
  entryFile: string;
  appVarName: string;  // nome da variável app (ex: "app")
}

const APPS: AppConfig[] = [
  { name: 'accounts', entryFile: 'apps/accounts/src/app.ts', appVarName: 'app' },
  { name: 'downloads', entryFile: 'apps/downloads/backend/src/server.ts', appVarName: 'app' },
  { name: 'glossario', entryFile: 'apps/glossario/backend/src/index.ts', appVarName: 'app' },
  { name: 'links', entryFile: 'apps/links/server/server.ts', appVarName: 'app' },
  { name: 'mesas', entryFile: 'apps/mesas/backend/src/server.ts', appVarName: 'app' },
  { name: 'site', entryFile: 'apps/site/server/server.ts', appVarName: 'app' },
];

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extrai uma string literal de um nó AST */
function extractStringLiteral(node: ts.Node): string | null {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

/** Extrai o identificador de um nó (para resolução de router) */
function extractIdentifier(node: ts.Node): string | null {
  if (ts.isIdentifier(node)) return node.text;
  return null;
}

/** Normaliza path removendo trailing slash e duplicatas */
function normalizePath(p: string): string {
  let result = p;
  // Remove trailing slash (exceto para "/")
  if (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result;
}

/** Junta prefixo + path router, tratando "/" corretamente */
function joinPaths(prefix: string, routePath: string): string {
  const p = normalizePath(prefix);
  const r = normalizePath(routePath);
  if (p === '' || p === '/') return r || '/';
  if (r === '' || r === '/') return p;
  return `${p}${r.startsWith('/') ? r : '/' + r}`;
}

/** Verifica se um arquivo é de teste */
function isTestFile(filePath: string): boolean {
  const name = path.basename(filePath);
  return (
    name.endsWith('.test.ts') ||
    name.endsWith('.spec.ts') ||
    name.endsWith('.test-d.ts') ||
    filePath.includes('__tests__') ||
    filePath.includes('.test.')
  );
}

/** Converte método HTTP de CallExpression para string */
function getMethodFromCall(node: ts.CallExpression): string | null {
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  const methodName = callee.name.text;
  const HTTP_METHODS = new Set([
    'get', 'post', 'put', 'patch', 'delete', 'head', 'options',
  ]);
  if (HTTP_METHODS.has(methodName)) return methodName.toUpperCase();
  if (methodName === 'use') return 'USE';
  return null;
}

/** Verifica se um nó é uma chamada a express.Router() */
function isRouterCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  // Router() — importado diretamente
  if (ts.isIdentifier(callee) && callee.text === 'Router') return true;
  // express.Router()
  if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'Router') return true;
  return false;
}

function fileDeclaresRouter(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const source = fs.readFileSync(filePath, 'utf-8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  let found = false;

  function visit(node: ts.Node) {
    if (found) return;
    if (ts.isVariableDeclaration(node) && node.initializer && isRouterCall(node.initializer)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return found;
}

function findRouterScopeInFile(filePath: string, factoryName?: string): string | null {
  const ast = getFileAST(filePath);
  if (!ast) return null;

  if (!factoryName) return scopeVarForFile(filePath, ast);

  let scope: string | null = null;
  function visit(node: ts.Node) {
    if (scope) return;
    const isNamedFunction =
      ts.isFunctionDeclaration(node) &&
      node.name?.text === factoryName &&
      node.body;
    const isNamedFactoryConst =
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === factoryName &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer));

    const body = isNamedFunction
      ? node.body
      : isNamedFactoryConst && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        ? node.initializer.body
        : null;

    if (body) {
      function findRouterVar(inner: ts.Node) {
        if (scope) return;
        if (ts.isVariableDeclaration(inner) && ts.isIdentifier(inner.name) && inner.initializer && isRouterCall(inner.initializer)) {
          scope = inner.name.text;
          return;
        }
        ts.forEachChild(inner, findRouterVar);
      }
      findRouterVar(body);
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(ast.sf);
  return scope ?? scopeVarForFile(filePath, ast);
}

// ─── Resolução de imports ───────────────────────────────────────────────────

/** Resolve o caminho absoluto de um import relativo ao arquivo fonte */
function resolveImportPath(importPath: string, sourceFile: string): string | null {
  // Só resolve imports relativos
  if (!importPath.startsWith('.')) return null;

  const sourceDir = path.dirname(sourceFile);
  // NodeNext: imports usam extensão .js/.jsx apontando para fonte .ts/.tsx.
  // Remover a extensão emitida para que o loop tente as fontes reais.
  const importNoExt = importPath.replace(/\.(js|jsx|mjs|cjs)$/, '');
  const resolved = path.resolve(sourceDir, importNoExt);

  // Tentar extensões comuns
  const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
  for (const ext of extensions) {
    const fullPath = resolved + ext;
    if (fs.existsSync(fullPath)) return fullPath;
    // Tentar index.ts, index.js
    const indexPath = path.join(resolved, `index${ext}`);
    if (fs.existsSync(indexPath)) return indexPath;
  }

  return null;
}

/** Coleta todos os imports de um arquivo (de módulos relativos), junto do nome
 * exportado de origem (localName -> 'default' | nome exportado) — necessário
 * para resolver corretamente qual variável Router escanear quando um arquivo
 * exporta múltiplos routers (ex: default + named export). */
function collectImports(
  sourceFile: ts.SourceFile,
  filePath: string,
): { imports: Map<string, string>; importExportName: Map<string, string> } {
  const imports = new Map<string, string>();
  const importExportName = new Map<string, string>();

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return;
      const modulePath = node.moduleSpecifier.text;
      const resolvedPath = resolveImportPath(modulePath, filePath);
      if (!resolvedPath) return;

      // Extrair default import
      if (node.importClause?.name) {
        const localName = node.importClause.name.text;
        imports.set(localName, resolvedPath);
        importExportName.set(localName, 'default');
      }

      // Extrair named imports
      if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          const localName = element.name.text;
          const exportedName = element.propertyName ? element.propertyName.text : element.name.text;
          // Só registrar se o nome importado for Router (raro mas possível)
          if (exportedName === 'Router') {
            // Router function itself — não mapear como router
            continue;
          }
          imports.set(localName, resolvedPath);
          importExportName.set(localName, exportedName);
        }
      }
    }

    // Também capturar require() calls
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        const modulePath = arg.text;
        const resolvedPath = resolveImportPath(modulePath, filePath);
        if (resolvedPath) {
          // require pode retornar default: const x = require('...')
          const parent = node.parent;
          if (parent && ts.isVariableDeclaration(parent) && parent.name && ts.isIdentifier(parent.name)) {
            imports.set(parent.name.text, resolvedPath);
            importExportName.set(parent.name.text, 'default');
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { imports, importExportName };
}

/** Mapeia nome exportado ('default' ou nome nomeado) -> nome da variável local
 * declarada no arquivo. Usado para resolver corretamente qual Router escanear
 * quando o arquivo exporta múltiplos routers. */
function collectExportsToLocal(sf: ts.SourceFile): Map<string, string> {
  const map = new Map<string, string>();

  function visit(node: ts.Node) {
    if (ts.isExportAssignment(node) && !node.isExportEquals && ts.isIdentifier(node.expression)) {
      map.set('default', node.expression.text);
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        const localName = element.propertyName ? element.propertyName.text : element.name.text;
        map.set(element.name.text, localName);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return map;
}

/** Tenta encontrar onde uma variável Router é declarada */
function findRouterDeclaration(
  varName: string,
  sourceFile: ts.SourceFile,
  filePath: string,
  imports: Map<string, string>,
): string | null {
  // 1. Verificar se é import
  if (imports.has(varName)) {
    const importedFile = imports.get(varName)!;
    return fileDeclaresRouter(importedFile) ? importedFile : null;
  }

  // 2. Procurar declaração no mesmo arquivo
  let result: string | null = null;

  // Casa `const <varName> = Router()` ou factory function (confidence low).
  const matchVarDecl = (node: ts.VariableDeclaration): void => {
    if (!node.name || !ts.isIdentifier(node.name) || node.name.text !== varName) return;
    if (!node.initializer) return;
    if (isRouterCall(node.initializer)) {
      result = filePath;
      return;
    }
    // Factory function (ex: createAdminSecretsRoutes(...)) — marca filePath, confidence low.
    if (!ts.isCallExpression(node.initializer)) return;
    const callee = node.initializer.expression;
    if (ts.isIdentifier(callee) && callee.text !== 'Router' && !result) {
      result = 'FACTORY:' + filePath;
    }
  };

  // Casa `export default router` (glossario pattern).
  const matchExport = (node: ts.ExportAssignment): void => {
    if (node.expression && ts.isIdentifier(node.expression) && node.expression.text === varName) {
      result = filePath;
    }
  };

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node)) matchVarDecl(node);
    else if (ts.isExportAssignment(node)) matchExport(node);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

// Nota sobre paths especiais:
// - Express 5 usa {*splat} como wildcard (ex: /og/{*splat}) — o scanner trata
//   como string literal porque é o path real. Normalizadores futuros (F5/F6)
//   devem tratar {*splat} como parâmetro, similar a :param.

// ─── Armazenamento de AST por arquivo (cache) ──────────────────────────────

interface FileAST {
  source: string;
  sf: ts.SourceFile;
  imports: Map<string, string>;   // varName -> filePath
  importExportName: Map<string, string>; // varName local -> nome exportado na origem ('default' | nome)
  exportsToLocal: Map<string, string>; // nome exportado deste arquivo -> varName local
  localRouters: Map<string, string>; // routerVarName -> filePath | 'FACTORY:...'
  allRouters: Map<string, string>;   // merged: imports + localRouters
}

const astCache = new Map<string, FileAST>();

function getFileAST(filePath: string): FileAST | null {
  if (astCache.has(filePath)) return astCache.get(filePath)!;

  if (!fs.existsSync(filePath)) return null;
  if (filePath.includes('node_modules') || filePath.includes('.git')) return null;

  const source = fs.readFileSync(filePath, 'utf-8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const { imports, importExportName } = collectImports(sf, filePath);
  const exportsToLocal = collectExportsToLocal(sf);

  const localRouters = new Map<string, string>();

  // Identificar variáveis Router
  function identifyRouters(node: ts.Node) {
    if (ts.isVariableDeclaration(node)) {
      if (node.initializer && isRouterCall(node.initializer)) {
        if (node.name && ts.isIdentifier(node.name)) {
          localRouters.set(node.name.text, filePath);
        }
      }
      // Factory functions
      if (node.initializer && ts.isCallExpression(node.initializer)) {
        const callee = node.initializer.expression;
        if (ts.isIdentifier(callee) && callee.text !== 'Router') {
          if (node.name && ts.isIdentifier(node.name)) {
            const decl = findRouterDeclaration(callee.text, sf, filePath, imports);
            if (decl) {
              localRouters.set(node.name.text, decl);
            }
          }
        }
      }
    }
    ts.forEachChild(node, identifyRouters);
  }
  identifyRouters(sf);

  const allRouters = new Map(localRouters);

  const ast: FileAST = { source, sf, imports, importExportName, exportsToLocal, localRouters, allRouters };
  astCache.set(filePath, ast);
  return ast;
}

// ─── Scanner principal ──────────────────────────────────────────────────────

/**
 * Escaneia um arquivo e extrai rotas HTTP.
 * 
 * @param filePath   Caminho absoluto do arquivo
 * @param prefix     Prefixo atual (ex: "/api/v1") 
 * @param scopeVar   Nome da variável de escopo: "app" ou nome de router (ex: "admin")
 * @param ctx        Contexto do scanner
 */
function scanRouterFile(
  filePath: string,
  prefix: string,
  scopeVar: string,
  ctx: ScannerContext,
): void {
  // Track por (filePath, prefix, scopeVar) para permitir o mesmo router em múltiplos
  // prefixos reais (ex.: mesas monta authRoutes em /api/v1/auth e /auth).
  const scopeKey = `${filePath}::${prefix}::${scopeVar}`;
  if (ctx.processedRouters.has(scopeKey)) return;
  ctx.processedRouters.add(scopeKey);

  // Pular testes
  if (!ctx.includeTests && isTestFile(filePath)) return;

  const ast = getFileAST(filePath);
  if (!ast) return;

  const fileAst = ast;
  const relativePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');

  // Escanear nós para este scopeVar específico
  function scanNode(node: ts.Node, currentPrefix: string) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const method = getMethodFromCall(node);

      if (!method) {
        ts.forEachChild(node, (n) => scanNode(n, currentPrefix));
        return;
      }

      // Detecta callee como scopeVar.METHOD
      let exprObj: string | null = null;
      if (ts.isPropertyAccessExpression(callee)) {
        exprObj = extractIdentifier(callee.expression);
      }

      if (!exprObj || exprObj !== scopeVar) {
        ts.forEachChild(node, (n) => scanNode(n, currentPrefix));
        return;
      }

      if (method === 'USE') {
        processUse(node, currentPrefix, fileAst, relativePath, ctx);
        ts.forEachChild(node, (n) => scanNode(n, currentPrefix));
        return;
      }

      // scopeVar.METHOD(path, ...)
      processRoute(node, method, currentPrefix, relativePath, ctx, fileAst);
    }

    ts.forEachChild(node, (n) => scanNode(n, currentPrefix));
  }

  scanNode(ast.sf, prefix);
}

function processUse(
  node: ts.CallExpression,
  currentPrefix: string,
  ast: FileAST,
  relativePath: string,
  ctx: ScannerContext,
): void {
  const arg0 = node.arguments[0];
  const arg1 = node.arguments[1];

  if (!arg0) return;

  const pathStr = extractStringLiteral(arg0);

  // Sem path string literal
  if (!pathStr) {
    // Caso: app.use(factoryCall(...)) ou app.use(middlewareCall(...))
    // Heurística: se o argumento é um CallExpression
    if (arg0 && ts.isCallExpression(arg0)) {
      const callee = arg0.expression;

      // 1. middlewareCall() onde função é importada de pacote npm (não relativo)
      //    → middleware conhecido, pular
      // 2. Router() → já tratado como router, pular
      // 3. função local/relativa → factory suspeita, LOW
      // 4. identifier de middleware conhecido → pular

      const KNOWN_MIDDLEWARES = new Set([
        'cors', 'cookieParser', 'rateLimit', 'express',
        'csrfProtection', 'globalRateLimiter', 'requestLogger',
        'parseCookies', 'publicLimiter', 'suggestLimiter',
        'reportLimiter', 'adminLimiter',
      ]);

      if (ts.isIdentifier(callee)) {
        const fnName = callee.text;
        if (fnName === 'Router') {
          // app.use(Router()) — não faz sentido, pular
          return;
        }
        if (KNOWN_MIDDLEWARES.has(fnName)) {
          return; // middleware conhecido
        }
        // Factory sem path: app.use(createAdminSecretsRoutes(db, env))
        // Só seguir quando a função vem de um import que COMPROVADAMENTE declara um
        // Router (fileDeclaresRouter). Sem isso, app.use(qualquerMiddleware()) cairia
        // no arquivo atual e reescanearia rotas sob prefixo errado → endpoints falsos.
        const factoryFile = ast.imports.get(fnName);
        if (factoryFile && fs.existsSync(factoryFile) && fileDeclaresRouter(factoryFile)) {
          const scopeVar = findRouterScopeInFile(factoryFile, fnName) ?? 'router';
          scanRouterFile(factoryFile, currentPrefix, scopeVar, ctx);
        }
        return;
      }

      if (ts.isPropertyAccessExpression(callee)) {
        // express.json(), express.static(), etc.
        const objName = ts.isIdentifier(callee.expression) ? callee.expression.text : '';
        if (KNOWN_MIDDLEWARES.has(objName)) {
          return; // middleware conhecido
        }
        // Sem path literal não há rota verificável para inventariar.
        return;
      }
    }

    // arg0 não é CallExpression — é identifier de middleware sem path
    // (ex: app.use(globalLimiter) ou app.use(requireAuth))
    // Pular silenciosamente — não é mount de router
    return;
  }

  // Registrar mount
  ctx.results.push({
    app: ctx.appName,
    method: 'USE',
    path: joinPaths(currentPrefix, pathStr),
    sourceFile: relativePath,
    line: getLine(node, ast.sf),
    confidence: 'high',
    kind: 'mount',
  });

  // Seguir router se houver segundo argumento
  if (!arg1) return;

  // Factory call: app.use("/prefix", factoryFn(...)) — ex: adminApi(requireAuth, requireAdmin)
  // O router é criado dentro da factory; resolvemos a função e escaneamos seu router interno.
  if (ts.isCallExpression(arg1) && ts.isIdentifier(arg1.expression)) {
    const factoryName = arg1.expression.text;
    if (factoryName !== 'Router') {
      // Só seguir factory com path quando o import comprovadamente declara um Router
      // (evita reescanear middleware/arquivo atual sob prefixo errado → rotas falsas).
      const factoryFile = ast.imports.get(factoryName);
      if (factoryFile && fs.existsSync(factoryFile) && fileDeclaresRouter(factoryFile)) {
        const newPrefix = joinPaths(currentPrefix, pathStr);
        const scopeVar = findRouterScopeInFile(factoryFile, factoryName) ?? 'router';
        scanRouterFile(factoryFile, newPrefix, scopeVar, ctx);
      }
    }
    return;
  }

  const routerIdent = extractIdentifier(arg1);
  if (!routerIdent) return;

  const importedRouterFile = ast.imports.get(routerIdent);
  const confirmedImportedRouterFile = importedRouterFile && fileDeclaresRouter(importedRouterFile)
    ? importedRouterFile
    : null;

  if (!ast.allRouters.has(routerIdent) && !confirmedImportedRouterFile) {
    if (importedRouterFile) return;
    // Router local não resolvido (ex: factory function)
    ctx.results.push({
      app: ctx.appName,
      method: 'USE',
      path: joinPaths(currentPrefix, pathStr),
      sourceFile: relativePath,
      line: getLine(node, ast.sf),
      confidence: 'low',
      kind: 'mount',
    });
    return;
  }

  const routerFile = ast.allRouters.get(routerIdent) || confirmedImportedRouterFile!;
  const newPrefix = joinPaths(currentPrefix, pathStr);

  if (routerFile.startsWith('FACTORY:')) {
    // Factory function — marcar low confidence
    ctx.results.push({
      app: ctx.appName,
      method: 'USE',
      path: newPrefix,
      sourceFile: relativePath,
      line: getLine(node, ast.sf),
      confidence: 'low',
      kind: 'mount',
    });
    const actualFile = routerFile.slice(8);
    if (fs.existsSync(actualFile)) {
      scanRouterFile(actualFile, newPrefix, scopeVarForFile(actualFile, ast), ctx);
    }
    return;
  }

  // Router em arquivo separado ou mesmo arquivo — determinar scopeVar
  const routerAST = getFileAST(routerFile);
  if (!routerAST) return;

  // Se o router está no mesmo arquivo, o scopeVar é routerIdent
  // Se está em arquivo diferente, o scopeVar é o nome da variável exportada
  const isSameFile = routerFile === ast.sf.fileName;

  // Para router em arquivo separado: resolver pelo nome exportado real
  // (arquivo pode ter múltiplos routers exportados — default + named — então
  // "pegar o primeiro router local" adivinha errado quando há mais de um).
  let routerScopeVar = routerIdent;
  if (!isSameFile) {
    const exportName = ast.importExportName.get(routerIdent);
    const mappedLocal = exportName ? routerAST.exportsToLocal.get(exportName) : undefined;
    if (mappedLocal && routerAST.localRouters.has(mappedLocal)) {
      routerScopeVar = mappedLocal;
    } else {
      // Fallback: pega o primeiro router local encontrado
      for (const [varName, varFile] of routerAST.localRouters) {
        if (varFile === routerFile) {
          routerScopeVar = varName;
          break;
        }
      }
    }
  }

  scanRouterFile(routerFile, newPrefix, routerScopeVar, ctx);
}

function processRoute(
  node: ts.CallExpression,
  method: string,
  currentPrefix: string,
  relativePath: string,
  ctx: ScannerContext,
  ast: FileAST,
): void {
  const arg0 = node.arguments[0];

  // Array de paths: app.get(["/", "/login"], ...)
  if (arg0 && ts.isArrayLiteralExpression(arg0)) {
    for (const element of arg0.elements) {
      const elementPath = extractStringLiteral(element);
      if (elementPath) {
        ctx.results.push({
          app: ctx.appName,
          method,
          path: joinPaths(currentPrefix, elementPath),
          sourceFile: relativePath,
          line: getLine(node, ast.sf),
          confidence: 'high',
          kind: 'express-route',
        });
      }
    }
    return;
  }

  if (!arg0) return;

  const routePath = extractStringLiteral(arg0);
  if (routePath) {
    ctx.results.push({
      app: ctx.appName,
      method,
      path: joinPaths(currentPrefix, routePath),
      sourceFile: relativePath,
      line: getLine(node, ast.sf),
      confidence: 'high',
      kind: 'express-route',
    });
  } else {
    // Path não literal (ex: variável, expressão)
    ctx.results.push({
      app: ctx.appName,
      method,
      path: joinPaths(currentPrefix, '<dynamic>'),
      sourceFile: relativePath,
      line: getLine(node, ast.sf),
      confidence: 'low',
      kind: 'express-route',
    });
  }
}

function getLine(node: ts.Node, sf: ts.SourceFile): number {
  return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

/** Determina o scopeVar para um arquivo router (geralmente "router" ou primeira var Router) */
function scopeVarForFile(filePath: string, sourceAST?: FileAST): string {
  const ast = sourceAST || getFileAST(filePath);
  if (!ast) return 'router';
  for (const [varName, varFile] of ast.localRouters) {
    if (varFile === filePath) return varName;
  }
  return 'router';
}

// ─── Geração de saída ────────────────────────────────────────────────────────

function generateOutput(results: RouteEntry[]): { json: object; markdown: string } {
  // Ordenar: por app, depois path
  results.sort((a, b) => {
    if (a.app !== b.app) return a.app.localeCompare(b.app);
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });

  // Estatísticas
  const byApp = new Map<string, RouteEntry[]>();
  for (const r of results) {
    if (!byApp.has(r.app)) byApp.set(r.app, []);
    byApp.get(r.app)!.push(r);
  }

  const stats = {
    total: results.length,
    byApp: Object.fromEntries(
      Array.from(byApp.entries()).map(([app, routes]) => [
        app,
        {
          total: routes.length,
          byMethod: Object.fromEntries(
            Array.from(
              routes.reduce((acc, r) => {
                acc.set(r.method, (acc.get(r.method) || 0) + 1);
                return acc;
              }, new Map<string, number>())
            ).sort((a, b) => b[1] - a[1])
          ),
          byConfidence: Object.fromEntries(
            Array.from(
              routes.reduce((acc, r) => {
                acc.set(r.confidence, (acc.get(r.confidence) || 0) + 1);
                return acc;
              }, new Map<string, number>())
            )
          ),
        },
      ])
    ),
    generatedAt: GENERATED_AT,
    script: 'scripts/api/inventory.ts',
  };

  // JSON
  const json = {
    metadata: stats,
    routes: results.map((r) => ({
      app: r.app,
      method: r.method,
      path: r.path,
      sourceFile: r.sourceFile,
      line: r.line,
      confidence: r.confidence,
      kind: r.kind,
    })),
  };

  // Markdown
  let md = `# Mapa de Rotas — Artifício RPG

> Gerado automaticamente por \`scripts/api/inventory.ts\` em ${GENERATED_AT.split('T')[0]}.
> **Não editar manualmente.** Fonte: \`docs/api/generated/api-inventory.generated.json\`.

## Convenção de Auth (DEB-055-08)

A resolução de auth por AST tem limitações (middleware dentro do arquivo de rota).
Use esta convenção como fallback documentado:

- Rotas com prefixo \`/admin\` → escopo **admin** (restrito a admins)
- Rotas com prefixo \`/gm\` → escopo **user** (usuário logado, dono do recurso)
- Rotas sem prefixo restrito → escopo **public** ou **user** (depende do app)
- Rotas \`/health\`, \`/api/auth/*\` → escopo **internal**/**public** (sem auth)

Para informação granular (auth exata, rate-limit, payload), consulte os contratos OpenAPI em \`docs/api/openapi/*.yaml\` e os metadados \`x-artificio-*\`.

## Estatísticas

| App | Total | HIGH | MEDIUM | LOW | Methods |
|-----|-------|------|--------|-----|---------|
`;

  for (const [app, routes] of Array.from(byApp.entries()).sort(byEntryKey)) {
    const high = routes.filter((r) => r.confidence === 'high').length;
    const medium = routes.filter((r) => r.confidence === 'medium').length;
    const low = routes.filter((r) => r.confidence === 'low').length;
    const methods = Array.from(new Set(routes.map((r) => r.method))).sort(byLocale).join(', ');
    md += `| ${app} | ${routes.length} | ${high} | ${medium} | ${low} | ${methods} |\n`;
  }

  md += `| **Total** | **${results.length}** | ${results.filter(r => r.confidence === 'high').length} | ${results.filter(r => r.confidence === 'medium').length} | ${results.filter(r => r.confidence === 'low').length} | |\n\n`;

  // Rotas por app
  for (const [app, routes] of Array.from(byApp.entries()).sort(byEntryKey)) {
    // Agrupar por prefixo para facilitar leitura
    md += `## ${app}\n\n`;
    md += `| Método | Path | Confiança | Arquivo | Linha |\n`;
    md += `|--------|------|-----------|---------|------|\n`;

    for (const r of routes) {
      const confIcon =
        r.confidence === 'high' ? '✅' :
        r.confidence === 'medium' ? '⚠️' : '❓';
      md += `| ${r.method} | \`${r.path}\` | ${confIcon} ${r.confidence} | \`${r.sourceFile}\` | ${r.line || '-'} |\n`;
    }
    md += '\n';
  }

  return { json, markdown: md };
}

// ─── Função principal ────────────────────────────────────────────────────────

function main(): void {
  const includeTests = process.argv.includes('--include-tests');

  const allResults: RouteEntry[] = [];

  for (const app of APPS) {
    const entryPath = path.resolve(REPO_ROOT, app.entryFile);

    if (!fs.existsSync(entryPath)) {
      console.warn(`[warn] App entry não encontrado: ${entryPath}`);
      continue;
    }

    const ctx: ScannerContext = {
      results: [],
      appName: app.name,
      includeTests,
      processedRouters: new Set(),
    };

    // Reset cache per app para evitar contaminação entre apps
    astCache.clear();

    // Escanear começa com o appVar (ex: "app") no entrypoint
    scanRouterFile(entryPath, '', app.appVarName, ctx);
    allResults.push(...ctx.results);
  }

  // Gerar saída
  const { json, markdown } = generateOutput(allResults);

  // Escrever JSON
  const jsonDir = path.resolve(REPO_ROOT, 'docs/api/generated');
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }

  const jsonPath = path.join(jsonDir, 'api-inventory.generated.json');
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf-8');

  // Escrever Markdown
  const mdPath = path.join(jsonDir, 'api-map.generated.md');
  fs.writeFileSync(mdPath, markdown, 'utf-8');

  // Resumo no console
  const byApp = new Map<string, RouteEntry[]>();
  for (const r of allResults) {
    if (!byApp.has(r.app)) byApp.set(r.app, []);
    byApp.get(r.app)!.push(r);
  }

  console.log(`\n📊 api:inventory — Resumo`);
  console.log(`   Total de rotas encontradas: ${allResults.length}`);
  for (const [app, routes] of Array.from(byApp.entries()).sort(byEntryKey)) {
    const high = routes.filter((r) => r.confidence === 'high').length;
    const low = routes.filter((r) => r.confidence === 'low').length;
    console.log(`   ${app}: ${routes.length} rotas (HIGH: ${high}, LOW: ${low})`);
  }

  // Rotas LOW
  const lowRoutes = allResults.filter((r) => r.confidence === 'low');
  if (lowRoutes.length > 0) {
    console.log(`\n⚠️  Rotas com baixa confiança (${lowRoutes.length}):`);
    for (const r of lowRoutes) {
      console.log(`   ${r.method} ${r.path} (${r.sourceFile}:${r.line || '?'})`);
    }
  }

  console.log(`\n✅ JSON:  ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`✅  MD:   ${path.relative(REPO_ROOT, mdPath)}`);
}

main();

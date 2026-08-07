#!/usr/bin/env node
// Gate: todo pacote do workspace que tem teste precisa ter alguma tarefa de
// TypeScript que ABRA esses arquivos de teste.
//
// Por que existe: `tsconfig.build.json` exclui teste de propósito (o `dist` vai
// para as imagens de produção, e teste compilado viraria código morto
// importando `vitest`). O efeito colateral é que erro de tipo em arquivo de
// teste não aparecia em gate nenhum — mock incompleto, asserção sobre campo
// inexistente e fixture fora do schema real passavam verdes pelo CI.
//
// A lacuna foi corrigida à mão duas vezes (spec 088 nos frontends de mesas e
// downloads; PR #243 em 13 pacotes, `apps/site`, `packages/catalog-ui` e
// `apps/glossario/frontend`) e voltou nas duas. Corrigir de novo sem gate só
// marcaria a data da terceira. Este script é o gate.
//
// Uso:
//   node scripts/check-test-typecheck-coverage.mjs
//
// Saída: lista os pacotes com teste que nenhum projeto TypeScript alcança.
// Exit 1 se houver algum, 0 se não.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'dist-cjs', '.git', '.turbo', '.astro'])

// Pacotes cujos testes NÃO são checados por tipo, por decisão registrada.
// Entrada aqui exige motivo — é o que diferencia exceção de esquecimento.
const ALLOWLIST = new Map([
  [
    '@artificio/scripts',
    'JavaScript puro (.mjs), sem tsconfig. Checar exigiria allowJs/checkJs sobre ' +
      'scripts sem anotação de tipo, com ganho baixo. Ver scripts/README.md.',
  ],
])

// Sondado uma vez: o próprio arquivo deste script existe com a caixa trocada?
// Se sim, o sistema ignora caixa (Windows/macOS) e a comparação precisa
// normalizar; no Linux do CI não, e achatar a caixa faria arquivos distintos
// colidirem.
const FS_IGNORA_CAIXA = (() => {
  const self = fileURLToPath(import.meta.url)
  const trocado = self === self.toLowerCase() ? self.toUpperCase() : self.toLowerCase()
  try {
    return fs.existsSync(trocado)
  } catch {
    return false
  }
})()

/** Caminho absoluto comparável, respeitando a sensibilidade a caixa do sistema. */
function normalizeForCompare(filePath) {
  const absolute = path.resolve(filePath)
  return FS_IGNORA_CAIXA ? absolute.toLowerCase() : absolute
}

/** Pacotes do workspace, pela fonte do pnpm — não por varredura de diretório. */
function listWorkspacePackages() {
  // Comando como string única em vez de (arquivo, args[]) com `shell: true`:
  // a segunda forma dispara DEP0190, e apontar direto para `pnpm.cmd` sem shell
  // falha com EINVAL no Windows a partir do Node 25. Os argumentos são
  // literais deste arquivo, não entrada externa.
  const raw = execSync('pnpm list -r --depth -1 --json', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return JSON.parse(raw).filter((p) => path.resolve(p.path) !== REPO_ROOT)
}

function findTestFiles(dir, acc = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) findTestFiles(full, acc)
    else if (TEST_FILE_RE.test(entry.name)) acc.push(full)
  }
  return acc
}

/**
 * Tsconfigs que os scripts de um pacote mandam o `tsc` abrir.
 *
 * Cobre as três formas em uso no repo, porque um gate que só entende a sua
 * própria produz falso positivo nas outras duas — e falso positivo é o que faz
 * alguém desligar o gate:
 *   `tsc -p x.json` (pacotes)   ·   `tsc -b` (frontends)   ·   `tsc` nu (backends)
 */
function tsconfigsReferencedByScripts(scripts) {
  const text = [scripts.build, scripts.typecheck, scripts['test:types']]
    .filter(Boolean)
    .join(' && ')
  const configs = new Set()

  // Percorre comando a comando em vez de casar tudo com um regex só: a versão
  // anterior usava um padrão com look-ahead e grupos opcionais aninhados,
  // ilegível e difícil de estender (achado do Sonar, PR #243).
  for (const command of text.split(/&&|\|\|/)) {
    const tokens = command.trim().split(/\s+/)
    const start = tokens.indexOf('tsc')
    if (start === -1) continue

    const args = tokens.slice(start + 1)
    const flagIndex = args.findIndex((arg) => arg === '-p' || arg === '--project' || arg === '-b')
    const explicit = flagIndex === -1 ? undefined : args[flagIndex + 1]

    // `tsc -p x.json` e `tsc -b x.json` nomeiam o projeto; `tsc`, `tsc --noEmit`
    // e `tsc -b` sem argumento caem no ./tsconfig.json do próprio pacote.
    if (explicit?.endsWith('.json')) configs.add(explicit)
    else configs.add('tsconfig.json')
  }

  return configs
}

/** Pacotes para os quais um script delega via `pnpm --filter <pkg> <script>`. */
function delegatedPackages(scripts) {
  const text = [scripts.build, scripts.typecheck, scripts.test].filter(Boolean).join(' && ')
  return new Set([...text.matchAll(/--filter\s+(\S+)/g)].map((m) => m[1]))
}

/**
 * Todo arquivo que um tsconfig alcança, seguindo `references` — que é como os
 * frontends (`tsc -b`) incluem os testes, via `tsconfig.test.json`.
 */
function filesReachedByTsconfig(ts, tsconfigPath, seen = new Set()) {
  const absolute = path.resolve(tsconfigPath)
  if (seen.has(absolute) || !fs.existsSync(absolute)) return []
  seen.add(absolute)

  const parsed = ts.getParsedCommandLineOfConfigFile(absolute, {}, {
    getCurrentDirectory: () => path.dirname(absolute),
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    readDirectory: ts.sys.readDirectory,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    onUnRecoverableConfigFileDiagnostic: () => {},
  })
  if (!parsed) return []

  let files = parsed.fileNames.map((f) => path.resolve(f))
  for (const reference of parsed.projectReferences || []) {
    const target = fs.existsSync(reference.path) && fs.statSync(reference.path).isDirectory()
      ? path.join(reference.path, 'tsconfig.json')
      : reference.path
    files = files.concat(filesReachedByTsconfig(ts, target, seen))
  }
  return files
}

export function analyzeWorkspace({ ts, packages }) {
  const byName = new Map(packages.map((p) => [p.name, p]))
  const results = []

  for (const pkg of packages) {
    const manifest = JSON.parse(fs.readFileSync(path.join(pkg.path, 'package.json'), 'utf8'))
    const scripts = manifest.scripts || {}
    const testFiles = findTestFiles(pkg.path)

    if (testFiles.length === 0) {
      results.push({ name: pkg.name, status: 'sem-testes', uncovered: [] })
      continue
    }

    // Um pacote agregador (`pnpm --filter x test`) não tem teste próprio: os
    // arquivos que aparecem sob ele pertencem aos pacotes para os quais delega,
    // e são avaliados lá. Sem esta regra, `apps/mesas` acusaria os mesmos 79
    // testes que `mesas-backend` e `mesas-frontend` já cobrem.
    const delegates = delegatedPackages(scripts)
    const ownTestFiles = testFiles.filter((file) => {
      for (const name of delegates) {
        const target = byName.get(name)
        if (target && !path.relative(target.path, file).startsWith('..')) return false
      }
      return true
    })
    if (ownTestFiles.length === 0) {
      results.push({ name: pkg.name, status: 'delegado', uncovered: [] })
      continue
    }

    if (ALLOWLIST.has(pkg.name)) {
      results.push({ name: pkg.name, status: 'dispensado', uncovered: [] })
      continue
    }

    let reached = []
    for (const config of tsconfigsReferencedByScripts(scripts)) {
      reached = reached.concat(filesReachedByTsconfig(ts, path.join(pkg.path, config)))
    }
    // Só normaliza a caixa onde o sistema de arquivos de fato ignora caixa. No
    // Linux do CI, `Foo.test.ts` e `foo.test.ts` são arquivos diferentes, e
    // achatar os dois faria um teste descoberto casar com outro coberto.
    const reachedSet = new Set(reached.map(normalizeForCompare))
    const uncovered = ownTestFiles.filter((f) => !reachedSet.has(normalizeForCompare(f)))

    results.push({
      name: pkg.name,
      status: uncovered.length === 0 ? 'coberto' : 'descoberto',
      testCount: ownTestFiles.length,
      uncovered: uncovered.map((f) => path.relative(pkg.path, f)),
    })
  }

  return results
}

function main() {
  const require = createRequire(path.join(REPO_ROOT, 'package.json'))
  const ts = require('typescript')
  const results = analyzeWorkspace({ ts, packages: listWorkspacePackages() })

  const failing = results.filter((r) => r.status === 'descoberto')
  const covered = results.filter((r) => r.status === 'coberto')
  const dispensed = results.filter((r) => r.status === 'dispensado')

  for (const pkg of failing) {
    console.error(`\n✗ ${pkg.name}: ${pkg.uncovered.length} de ${pkg.testCount} testes sem checagem de tipo`)
    for (const file of pkg.uncovered) console.error(`    ${file}`)
  }

  if (failing.length > 0) {
    console.error(
      '\nEsses arquivos de teste não são abertos por nenhum `tsc` do pacote, então\n' +
        'erro de tipo neles passa verde pelo CI.\n\n' +
        'Correção: um projeto TypeScript que os inclua, rodado por uma tarefa `typecheck`.\n' +
        '  - pacote com `tsconfig.build.json`: `"typecheck": "tsc -p tsconfig.json --noEmit"`\n' +
        '    (o `tsconfig.json` inclui teste; o `.build.json` exclui e emite)\n' +
        '  - frontend com `tsc -b`: `tsconfig.test.json` nas `references`\n' +
        '    (modelo em `apps/mesas/frontend/tsconfig.test.json`)\n\n' +
        'Se o pacote não deve mesmo ser checado, declare em ALLOWLIST neste arquivo,\n' +
        'com o motivo.',
    )
    process.exitCode = 1
    return
  }

  const dispensedNote = dispensed.length > 0 ? `, ${dispensed.length} dispensado(s)` : ''
  console.log(`✓ testes com checagem de tipo em ${covered.length} pacote(s)${dispensedNote}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

#!/usr/bin/env node
// Gate: todo pacote `@artificio/*` importado pelo código de um app precisa ter o `dist` copiado no
// stage `production` do Dockerfile dele — e `dist-cjs` também, quando o pacote emite CJS.
//
// Por que existe: E016 e E017 são o MESMO defeito, duas vezes. Pacote workspace novo vira dependency
// de um app, o Dockerfile de produção não copia o `dist`, build e CI passam verdes, e o container
// crasha só depois com `MODULE_NOT_FOUND` — direto em beta/prod. O E016 já registrava a prevenção
// ("auditoria estática de imports × COPY antes do deploy"); ela não foi seguida e o E017 aconteceu
// igual, com `@artificio/catalog-matching`.
//
// Prevenção que depende de alguém lembrar não é prevenção. Este script faz o cruzamento sozinho.
//
// Por que o build não pega: o builder tem o monorepo inteiro, então compila bem. O stage
// `production` copia só o que está listado à mão — e é lá que o pacote some. Nenhum teste roda
// dentro dessa imagem, então o gap só aparece em runtime.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const IMPORT_RE = /@artificio\/([a-z0-9-]+)/g;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "dist-cjs") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Só precisa de `dist-cjs` na imagem quem de fato RESOLVE para lá. Testar `main`/`require` existir
 * não basta: `config` e `media` apontam `require` para `./dist/index.js` (mesmo diretório do ESM) e
 * não têm `dist-cjs` nenhum — cobrar o diretório deles seria falso-positivo. `auth` e
 * `catalog-client` apontam para `./dist-cjs/`, e esses sim precisam.
 */
function needsCjsDir(pkg) {
  const file = join(ROOT, "packages", pkg, "package.json");
  if (!existsSync(file)) return false;
  const json = JSON.parse(readFileSync(file, "utf8"));
  const targets = [json.main, json.exports?.["."]?.require].filter((t) => typeof t === "string");
  return targets.some((t) => t.includes("dist-cjs"));
}

// Só stage `production` importa: o builder tem o monorepo inteiro e nunca falta nada nele.
// Devolve também a linha `FROM`, para distinguir imagem Node de imagem nginx.
function productionStage(dockerfile) {
  const lines = readFileSync(dockerfile, "utf8").split("\n");
  const start = lines.findIndex((l) => /^FROM\s+.*\bAS\s+production\b/i.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((l) => /^FROM\s/i.test(l));
  return {
    from: lines[start],
    body: (next === -1 ? rest : rest.slice(0, next)).join("\n"),
  };
}

const failures = [];
const checked = [];

for (const app of readdirSync(join(ROOT, "apps"))) {
  for (const part of ["backend", "frontend", "."]) {
    const dockerfile = join(ROOT, "apps", app, part, "Dockerfile");
    if (!existsSync(dockerfile)) continue;

    const stage = productionStage(dockerfile);
    if (stage === null) continue; // sem stage `production` (ex.: imagem single-stage) — fora do escopo

    // Frontend servido por nginx não resolve `@artificio/*` em runtime: o Vite já bundlou tudo no
    // `dist` da própria SPA durante o build. Cobrar `COPY packages/*/dist` aqui seria falso-positivo
    // — a imagem final não tem Node e nunca faz `import`.
    if (/^FROM\s+nginx/i.test(stage.from)) continue;

    const srcDir = join(ROOT, "apps", app, part, "src");
    const imported = new Set();
    for (const file of walk(srcDir)) {
      for (const m of readFileSync(file, "utf8").matchAll(IMPORT_RE)) imported.add(m[1]);
    }
    if (imported.size === 0) continue;

    const label = `apps/${app}${part === "." ? "" : `/${part}`}`;
    checked.push(`${label} (${imported.size} pacotes)`);

    for (const pkg of [...imported].sort()) {
      // Pacote que não existe em `packages/` é import interno do próprio app (ex.: alias de tsconfig),
      // não dependency workspace — não há `dist` a copiar.
      if (!existsSync(join(ROOT, "packages", pkg))) continue;

      if (!stage.body.includes(`packages/${pkg}/dist`)) {
        failures.push(`${label}: importa @artificio/${pkg} mas o stage production não copia packages/${pkg}/dist`);
        continue; // sem o `dist`, cobrar `dist-cjs` seria ruído sobre o mesmo defeito
      }
      if (needsCjsDir(pkg) && !stage.body.includes(`packages/${pkg}/dist-cjs`)) {
        failures.push(`${label}: @artificio/${pkg} resolve require para dist-cjs mas o stage production não copia packages/${pkg}/dist-cjs`);
      }
    }
  }
}

for (const line of checked) console.log(`[dockerfile-deps] ${line}`);

if (failures.length > 0) {
  console.error("\n::error::Dockerfile de produção não copia pacote workspace importado pelo código (E016/E017):");
  for (const f of failures) console.error(`  - ${f}`);
  console.error("\nO container subiria e crasharia com MODULE_NOT_FOUND em runtime, depois do CI verde.");
  process.exit(1);
}

console.log(`[dockerfile-deps] OK — ${checked.length} imagens conferidas, nenhum pacote faltando.`);

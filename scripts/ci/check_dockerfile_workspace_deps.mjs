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

/**
 * Dependências que aparecem no `dist` de um pacote mas **nunca** carregam num
 * processo de backend: só o entrypoint de UI as importa, e nenhum caminho
 * server-side chega lá.
 *
 * Cobrá-las produziria falso-positivo em toda imagem de backend — `@artificio/auth`
 * e `content-editor` declaram `react`, e nenhum backend do monorepo renderiza
 * componente. Manter a lista curta e justificada: cada entrada aqui é um guard
 * que deixamos de ter, então entrada nova exige provar que o caminho
 * server-side não a alcança.
 */
const UI_ONLY_DEPS = new Set(["react", "react-dom"]);

/**
 * `skipDist` existe porque esta função tem dois usos opostos: varrer `src/` de um
 * app (onde `dist` é ruído — código gerado que duplicaria os imports do fonte) e
 * varrer o `dist` de um pacote (onde é justamente o alvo, porque é ele que roda
 * no container).
 */
function walk(dir, out = [], skipDist = true) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    if (skipDist && (entry === "dist" || entry === "dist-cjs")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out, skipDist);
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

/**
 * Só o último stage importa: o builder tem o monorepo inteiro e nunca falta nada nele.
 * Devolve também a linha `FROM`, para distinguir imagem Node de imagem nginx.
 *
 * ## Por que não procurar `AS production` pelo nome
 *
 * Era o que este gate fazia, e foi por isso que ele **nunca conferiu o
 * `apps/accounts`**: os stages de lá se chamam `deps`/`build`/`runtime`, então
 * `findIndex` devolvia -1 e o app era pulado em silêncio. Nenhum PR jamais o
 * cobriu — o incidente de 2026-08-08 (`sanitize-html` ausente, SSO em 502)
 * passou por aqui verde.
 *
 * O que define "imagem final" não é o nome, é a posição: o último `FROM` é o que
 * vira a imagem publicada. Casar por posição elimina a classe inteira de erro
 * "alguém nomeou o stage diferente".
 *
 * Dockerfile single-stage (`links`, `site`) também entra: um `FROM` só é o
 * último. Eles fazem `pnpm install` completo, sem poda, então passam — mas
 * passam por terem sido *conferidos*, não por terem sido ignorados.
 */
function finalStage(dockerfile) {
  const lines = readFileSync(dockerfile, "utf8").split("\n");
  const fromIndexes = lines.reduce((acc, l, i) => (/^FROM\s/i.test(l) ? [...acc, i] : acc), []);
  if (fromIndexes.length === 0) return null;
  const start = fromIndexes[fromIndexes.length - 1];
  return {
    from: lines[start],
    body: lines.slice(start + 1).join("\n"),
  };
}

/**
 * Fecho transitivo dos `@artificio/*` alcançáveis a partir de um conjunto inicial.
 *
 * O gate original varria só `apps/<app>/src`, então enxergava apenas o que o app
 * importa **diretamente**. `@artificio/content-editor` nunca aparecia ali: quem
 * o importa é `packages/comments`, e o app importa `comments`. Foi essa
 * dependência de segundo nível que caiu em produção.
 */
function transitiveClosure(direct) {
  const seen = new Set(direct);
  const queue = [...direct];

  while (queue.length > 0) {
    const pkg = queue.shift();
    const file = join(ROOT, "packages", pkg, "package.json");
    if (!existsSync(file)) continue;

    const json = JSON.parse(readFileSync(file, "utf8"));
    for (const dep of Object.keys(json.dependencies ?? {})) {
      const match = /^@artificio\/([a-z0-9-]+)$/.exec(dep);
      if (!match || seen.has(match[1])) continue;
      seen.add(match[1]);
      queue.push(match[1]);
    }
  }

  return seen;
}

/**
 * Casa um caminho no corpo do Dockerfile respeitando **fronteira de token**.
 *
 * `String.includes` cru aceita prefixo: `node_modules/markdown-it-anchor`
 * satisfaria a checagem de `node_modules/markdown-it`, e o guard passaria verde
 * cobrindo a dependência errada. `markdown-it` está entre as deps guardadas
 * hoje, então o falso-negativo é alcançável, não teórico.
 *
 * O caractere seguinte precisa ser fim de string, espaço, quebra de linha, `/`
 * ou `"` — nunca `[A-Za-z0-9._-]`, que continuaria o nome do pacote. O `\.` do
 * escape importa: `ipaddr.js` tem ponto, e sem escapar o `.` casaria qualquer
 * caractere.
 */
function mentionsPath(body, path) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(?![A-Za-z0-9._-])`).test(body);
}

/** `dependencies` que o próprio app declara — resolvem pelo `node_modules` dele. */
function appDependencies(app, part) {
  const file = join(ROOT, "apps", app, part === "." ? "." : part, "package.json");
  if (!existsSync(file)) return new Set();
  const json = JSON.parse(readFileSync(file, "utf8"));
  return new Set(Object.keys(json.dependencies ?? {}));
}

/**
 * Dependências externas que o pacote resolve **do próprio build** em runtime.
 *
 * Lê o código compilado, não o `package.json`: o manifesto lista tudo que o
 * pacote declara, inclusive o que só a UI ou o teste usa. `react` é o caso —
 * `auth` e `content-editor` o declaram, mas nenhum caminho server-side carrega
 * módulo React, e cobrá-lo daria falso-positivo em toda imagem de backend.
 *
 * Varre `dist` **e** `dist-cjs`, e casa `from "x"` **e** `require("x")`: 8
 * pacotes do repo emitem CJS, e `content-editor/dist-cjs` alcança `markdown-it`
 * e `sanitize-html` só por `require()`. Uma versão anterior lia apenas `dist`
 * com sintaxe ESM e não enxergava nenhuma dessas.
 *
 * Se o build não existe (checkout sem `pnpm build`), devolve vazio em vez de
 * falhar: este gate cobra o Dockerfile, não a ordem dos passos de CI.
 */
function externalRuntimeDeps(pkg) {
  const deps = new Set();

  for (const dir of ["dist", "dist-cjs"]) {
    const full = join(ROOT, "packages", pkg, dir);
    if (!existsSync(full)) continue;

    for (const file of walk(full, [], false)) {
      const source = readFileSync(file, "utf8");
      const specs = [
        ...[...source.matchAll(/\bfrom\s+["']([^."'][^"']*)["']/g)].map((m) => m[1]),
        ...[...source.matchAll(/\brequire\(\s*["']([^."'][^"']*)["']\s*\)/g)].map((m) => m[1]),
      ];

      for (const spec of specs) {
        if (spec.startsWith("node:") || spec.startsWith("@artificio/")) continue;
        // `sanitize-html`, mas também `@scope/pkg` — o subpath depois disso não
        // importa, o que se instala é o pacote.
        const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        if (UI_ONLY_DEPS.has(name)) continue;
        deps.add(name);
      }
    }
  }

  return deps;
}

const failures = [];
const checked = [];

for (const app of readdirSync(join(ROOT, "apps"))) {
  for (const part of ["backend", "frontend", "."]) {
    const dockerfile = join(ROOT, "apps", app, part, "Dockerfile");
    if (!existsSync(dockerfile)) continue;

    const stage = finalStage(dockerfile);
    if (stage === null) continue; // arquivo sem `FROM` — não é Dockerfile válido

    // Frontend servido por nginx não resolve `@artificio/*` em runtime: o Vite já bundlou tudo no
    // `dist` da própria SPA durante o build. Cobrar `COPY packages/*/dist` aqui seria falso-positivo
    // — a imagem final não tem Node e nunca faz `import`.
    if (/^FROM\s+nginx/i.test(stage.from)) continue;

    const label = `apps/${app}${part === "." ? "" : `/${part}`}`;
    const srcDir = join(ROOT, "apps", app, part, "src");

    // Diretório ausente e diretório vazio de imports são coisas diferentes, e
    // tratá-los igual é como o `accounts` ficou fora do gate por meses: sai
    // calado e ninguém percebe. Um app com Dockerfile mas sem `src/` no lugar
    // esperado precisa falhar, para que a divergência apareça no PR.
    if (!existsSync(srcDir)) {
      failures.push(`${label}: tem Dockerfile mas não tem ${label}/src — o gate não consegue levantar os imports; ajuste o layout ou o gate`);
      continue;
    }

    const direct = new Set();
    for (const file of walk(srcDir)) {
      for (const m of readFileSync(file, "utf8").matchAll(IMPORT_RE)) direct.add(m[1]);
    }
    if (direct.size === 0) continue; // fonte real sem nenhum `@artificio/*` — nada a cobrar

    // Só pacotes que existem em `packages/`: o resto é import interno do app
    // (alias de tsconfig), não dependency workspace.
    const imported = new Set(
      [...transitiveClosure(direct)].filter((p) => existsSync(join(ROOT, "packages", p))),
    );

    checked.push(`${label} (${imported.size} pacotes)`);

    // `pnpm install --prod --filter` PODA o store `.pnpm`: sobrevive só o que os
    // pacotes filtrados precisam. Pacote de fora da lista mantém o symlink em
    // `node_modules/`, mas com o alvo removido — e o container quebra em runtime
    // com o CI verde. Foi o incidente de 2026-08-08.
    // `pnpm install --frozen-lockfile` sem `--prod` instala o workspace inteiro
    // dentro da imagem: não há `COPY dist` a cobrar nem store podado. É o caso de
    // `links` e `site`, que buildam o Astro no entrypoint e por isso precisam das
    // devDependencies. Conferir e passar — não pular em silêncio, que era o que
    // deixava app inteiro fora do gate.
    // A checagem é por LINHA de `pnpm install`, não pelo corpo inteiro: `links` e
    // `site` também usam `--filter`, mas no `turbo run build` várias linhas
    // abaixo. Casar contra o corpo todo confundia os dois comandos e fazia o gate
    // tratar install completo como install podado.
    // Junta continuação de linha (`\` no fim) ANTES de separar: `glossario`
    // quebra um único `pnpm install` em três linhas, e recortar por `\n` cru
    // deixaria os `--filter` das linhas seguintes de fora — o gate acusaria
    // pacote não-filtrado que na verdade está lá.
    const installLines = stage.body
      .replace(/\\\r?\n\s*/g, " ")
      .split("\n")
      .filter((l) => /pnpm install/.test(l));
    const installsFullWorkspace = installLines.some(
      (l) => !/--prod/.test(l) && !/--filter/.test(l),
    );
    if (installsFullWorkspace) continue;

    const prunesStore = installLines.some((l) => /--prod/.test(l) && /--filter/.test(l));
    // Extrai de `installLines`, não de `stage.body`: `--filter` também aparece
    // em `turbo run build`, e contar aquele como se fosse install faria o gate
    // dar por instalado um pacote que só foi compilado.
    const filtered = new Set(
      installLines.flatMap((l) =>
        [...l.matchAll(/--filter\s+@artificio\/([a-z0-9-]+)/g)].map((m) => m[1]),
      ),
    );

    const appDeps = appDependencies(app, part);

    // `COPY packages ./packages` traz o workspace inteiro, `dist` incluso — é o
    // que `accounts` faz. Detectar isso evita cobrar um `COPY` por pacote que
    // seria redundante ali, sem afastar a checagem de quem copia seletivamente.
    const copiesAllPackages = /^COPY\s+(--from=\S+\s+)?\S*packages\s+\.?\/?packages\/?\s*$/m.test(
      stage.body,
    );

    for (const pkg of [...imported].sort()) {
      // As duas checagens abaixo são INDEPENDENTES e ambas rodam: o `dist` chega
      // por `COPY`, e as dependências externas dele sobrevivem — ou não — à poda
      // do `--filter`. Uma versão anterior tratava `--filter` como alternativa ao
      // `COPY` e deixava de cobrar o `dist`, o que reabria o E017 exato (medido:
      // remover `COPY packages/catalog-matching/dist` de downloads passava verde).
      if (!copiesAllPackages) {
        if (!mentionsPath(stage.body, `packages/${pkg}/dist`)) {
          failures.push(`${label}: importa @artificio/${pkg} mas o stage final não copia packages/${pkg}/dist`);
        }
        // `if` próprio, não `else if`: um Dockerfile pode copiar `dist` e
        // esquecer `dist-cjs`, e encadear escondia o segundo defeito atrás do
        // primeiro. São dois artefatos distintos, cada um com seu modo de falha.
        if (needsCjsDir(pkg) && !mentionsPath(stage.body, `packages/${pkg}/dist-cjs`)) {
          failures.push(`${label}: @artificio/${pkg} resolve require para dist-cjs mas o stage final não copia packages/${pkg}/dist-cjs`);
        }
      }

      if (!prunesStore) continue;

      if (!filtered.has(pkg)) {
        failures.push(`${label}: depende de @artificio/${pkg} mas o stage final não o inclui em --filter (o store .pnpm dele é podado)`);
        continue; // sem o pacote instalado, cobrar as deps dele seria ruído
      }

      // Dep que o próprio app também declara resolve pelo `node_modules` dele por
      // resolução ascendente do Node, e o `--filter` do app já a preserva no
      // store. Cobrar guard aí seria redundante — e `express`/`zod`/
      // `jsonwebtoken` cairiam como falso-positivo em todo backend.
      for (const dep of [...externalRuntimeDeps(pkg)].sort()) {
        if (appDeps.has(dep)) continue;
        if (!mentionsPath(stage.body, `node_modules/${dep}`)) {
          failures.push(`${label}: @artificio/${pkg} importa "${dep}" do dist mas o stage final não valida node_modules/${dep} (o store .pnpm é podado)`);
        }
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

#!/usr/bin/env node
/**
 * Gate: o Proxy lazy de `db` nao pode mutilar os modulos *callable* do Kysely.
 *
 * Incidente que originou (medido 2026-08-24): o commit `85063da` (19/06/2026,
 * D078/T28d) trocou `export const db = new Kysely(...)` por um Proxy lazy cujo
 * handler fazia `value.bind(instance)` em qualquer valor do tipo `function`.
 * `db.fn` do Kysely e um objeto *callable* com metodos anexados (`count`,
 * `sum`, `countAll`, ...) e `Function.prototype.bind` cria uma funcao nova
 * DESCARTANDO essas own properties. Efeito: `db.fn.count` virou `undefined` e
 * cada `POST /api/v1/profile/links` respondeu 500
 * (`TypeError: db.fn.count is not a function`) por mais de dois meses, sem
 * nenhum gate acusar — lint, build, typecheck e os 114 testes passavam, porque
 * `bind` e valido em TS e nenhum teste exercitava a rota.
 *
 * Por que smoke de runtime e nao teste de tipo: `bind` descartar propriedades e
 * comportamento de runtime do JS, invisivel ao `tsc`. So carregando o modulo
 * real e lendo `db.fn.count` se prova que o Proxy esta correto.
 *
 * Descoberta automatica de proposito: uma lista fixa de apps deixaria o proximo
 * `db` Proxy de fora — foi assim que `apps/links/db/index.ts` ficou com o mesmo
 * defeito sem ninguem notar.
 */
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { resolve } from "node:path";
// Carrega os modulos TS direto do fonte (mesmo caminho que `tsx` usa em runtime
// no app links). Evita depender de build previo e verifica o arquivo que o
// autor de fato edita. `tsx/esm/api` e a forma suportada de registrar o loader
// de dentro do processo (o `--loader` foi depreciado no Node 20+).
import { register as registerTsx } from "tsx/esm/api";

registerTsx();

// `kysely`/`pg` nao existem na raiz (pnpm isola por workspace): resolver a
// partir do package.json de um app que os declara, como faz
// `check-cjs-workspace-exports.cjs`.
const appRequire = createRequire(`${process.cwd()}/apps/mesas/backend/package.json`);

function kyselyInstance() {
  const { Kysely, PostgresDialect } = appRequire("kysely");
  const { Pool } = appRequire("pg");
  return new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: "postgres://smoke:smoke@127.0.0.1:5432/smoke" }),
    }),
  });
}

// Metodos de `db.fn` lidos do Kysely instalado, nao hardcoded: se uma versao
// nova acrescentar um agregador, o gate passa a cobri-lo sozinho.
function expectedFnMethods() {
  return Object.getOwnPropertyNames(kyselyInstance().fn).filter(
    (n) => !["length", "name", "prototype"].includes(n)
  );
}

// Diretorios que nunca contem fonte do repo. Pular explicitamente e o que
// substitui o `.gitignore` agora que a varredura e feita em Node puro.
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-cjs",
  ".git",
  ".turbo",
  ".astro",
  "coverage",
  "build",
]);

/** Caminha `apps/` e `packages/` procurando `**\/db/*.ts`, sem subprocesso. */
function* walkDbModules(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // diretorio ausente (ex.: packages/ sem db/) nao e erro
  }
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walkDbModules(full);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && dir.endsWith("/db")) {
      yield full;
    }
  }
}

// Varredura em Node puro, sem `git grep`: alem de nao depender do binario do
// git no PATH (S4036 — PATH e gravavel, entao invocar comando por nome nao e
// seguro), o gate passa a rodar igual em qualquer checkout, inclusive fora de
// um repositorio git.
function findProxyModules() {
  const found = [];
  for (const root of ["apps", "packages"]) {
    for (const file of walkDbModules(root)) {
      const src = readFileSync(file, "utf8");
      if (src.includes("new Proxy") && src.includes("Kysely")) found.push(file);
    }
  }
  // Comparador explicito: `sort()` sem argumento ordena pela representacao
  // UTF-16 de cada elemento, que so coincide com ordem alfabetica por acidente.
  // Aqui a ordem so serve para a saida do gate ser estavel entre execucoes.
  return found.sort((a, b) => a.localeCompare(b));
}

// Cada app valida DATABASE_URL no primeiro acesso (DT-004). O Pool do `pg` so
// abre socket no primeiro query, entao uma URL sintetica exercita o Proxy
// inteiro sem tocar em banco nenhum.
const SMOKE_URL = "postgres://smoke:smoke@127.0.0.1:5432/smoke";
process.env.DATABASE_URL ||= SMOKE_URL;
// `db/prod.ts` do mesas le a sua propria variavel (PROD_DB_URL). Sem ela o
// acesso a `.fn` lanca e o Proxy escaparia do gate sem ninguem notar.
process.env.PROD_DB_URL ||= SMOKE_URL;

const failures = [];
const checked = [];
const methods = expectedFnMethods();

for (const tsPath of findProxyModules()) {
  let mod;
  try {
    mod = await import(pathToFileURL(resolve(tsPath)).href);
  } catch (err) {
    failures.push(`${tsPath}: falha ao importar — ${err.message}`);
    continue;
  }

  let sawProxy = false;

  for (const [name, value] of Object.entries(mod)) {
    if (!value || typeof value !== "object") continue;

    let fn;
    try {
      fn = value.fn;
    } catch (err) {
      // Um Proxy de db que lanca ao ler `.fn` (env faltando, por exemplo) nao
      // pode passar como "nao aplicavel" — seria exatamente o silencio que
      // deixou o bug original correr por dois meses.
      failures.push(`${tsPath}: \`${name}.fn\` lancou ao ser lido — ${err.message}`);
      sawProxy = true;
      continue;
    }
    if (fn === undefined) continue;

    sawProxy = true;

    if (typeof fn !== "function") {
      failures.push(`${tsPath}: \`${name}.fn\` veio como ${typeof fn}, esperado function`);
      continue;
    }

    const missing = methods.filter((m) => typeof fn[m] !== "function");
    if (missing.length) {
      failures.push(
        `${tsPath}: \`${name}.fn\` perdeu ${missing.length}/${methods.length} metodos ` +
          `(${missing.join(", ")}) — o handler do Proxy provavelmente faz ` +
          `\`value.bind(instance)\` sem recopiar as own properties`
      );
      continue;
    }

    checked.push(`ok ${tsPath} -> ${name}.fn (${methods.length} metodos)`);
  }

  if (!sawProxy && !failures.some((f) => f.startsWith(tsPath))) {
    failures.push(`${tsPath}: nenhum export com \`.fn\` encontrado — o gate nao esta cobrindo este arquivo`);
  }
}

// Prova de regressao: confirma que este gate DE FATO pega o bug. Smoke que
// nunca falha e smoke que nao protege nada.
function regressionProof() {
  const k = kyselyInstance();
  const brokenProxy = new Proxy({}, {
    get(_t, prop) {
      const v = Reflect.get(k, prop, k);
      return typeof v === "function" ? v.bind(k) : v; // <- o bug de 85063da
    },
  });
  if (typeof brokenProxy.fn.count === "function") {
    throw new TypeError(
      "prova de regressao falhou: o Proxy defeituoso deveria perder `fn.count`, " +
        "mas nao perdeu — este gate parou de detectar o bug que existe para pegar"
    );
  }
  console.log("ok prova de regressao (Proxy com bind cru perde fn.count)");
}

regressionProof();

if (!checked.length && !failures.length) {
  console.error("FALHA: nenhum Proxy de db foi verificado — a descoberta quebrou (padrao de arquivo mudou?)");
  process.exit(1);
}

for (const line of checked) console.log(line);

if (failures.length) {
  console.error("\nFALHA: Proxy de db mutilando modulo callable do Kysely\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error("\nCorrecao: no handler `get`, apos `value.bind(instance)`, recopiar as");
  console.error("own properties: `Object.defineProperties(bound, Object.getOwnPropertyDescriptors(value))`.");
  process.exit(1);
}

console.log(`\n${checked.length} Proxy(ies) de db verificados — modulos callable intactos.`);

// Spec 102 F2 — carga e varredura dos 301 legados do WordPress (T2.2 e T2.3).
//
// Os pares são DERIVADOS do banco, nunca digitados: o `canonical` gravado na importação é a
// fonte fiel das URLs antigas do WP. O predicado `regexp_replace` é o MESMO usado em T3.2 e nas
// medições de spec.md §2 — de propósito: predicado divergente aqui produziria redirect para post
// cujo canonical T3.2 não limpou (ou o inverso), e as duas tasks operam sobre o mesmo conjunto.
//
// Como o `canonical` é limpo por T3.2 (`SET canonical = NULL`), a varredura de T2.3 lê os pares
// da própria tabela `redirects` quando o banco já não tem canonical divergente — assim a
// regressão continua verificável depois da limpeza.
//
// Uso:
//   tsx scripts/redirects-legados.ts plan            # lista os pares, não escreve nada
//   tsx scripts/redirects-legados.ts load            # INSERT idempotente (exige autorização)
//   tsx scripts/redirects-legados.ts verify --base https://artificiorpg.com
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/connection.js";
import { addRedirect } from "../db/repo/redirects.js";

interface Pair { from_path: string; to_path: string }

// `regexp_replace` tira o esquema+host do canonical, deixando só o caminho: `lookupRedirect`
// compara com `req.path`, que é relativo. Comparar a URL absoluta daria contagem diferente se
// algum canonical tiver `http://` em vez de `https://`.
const PAIRS_SQL = `
  SELECT regexp_replace(canonical, '^https?://[^/]+', '') AS from_path,
         '/blog/' || slug || '/'                          AS to_path
  FROM posts
  WHERE canonical IS NOT NULL
    AND regexp_replace(canonical, '^https?://[^/]+', '') <> '/blog/' || slug || '/'
  ORDER BY from_path
`;

async function pairsFromPosts(): Promise<Pair[]> {
  const db = await getDb();
  return (await db.query<Pair>(PAIRS_SQL)).rows;
}

// Manifesto dos 105 pares da migração, congelado na carga de 2026-09-11. A varredura NÃO pode
// derivar o conjunto esperado da tabela que ela verifica: se um redirect fosse apagado, ele
// sumiria de `pairs` e a varredura reportaria "104/104 ok" — verde por ausência da evidência
// (achado de review, PR #315). Também isola a migração de redirects internos criados depois,
// por troca de slug no admin, que não fazem parte deste conjunto.
const MANIFEST = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/redirects-legados-105.tsv",
);

// O manifesto é a única defesa contra "verde por ausência" — mas ele mesmo precisa ser
// verificado, senão o defeito só muda de lugar: truncado a 80 linhas, a varredura reportaria
// "80/80 ok" com a mesma confiança (achado de review, PR #315). Origem duplicada é igualmente
// grave: dois pares para o mesmo `from_path` inflariam o denominador sem cobrir URL nova.
const MANIFEST_PAIRS = 105;

function pairsFromManifest(): Pair[] {
  const pairs = readFileSync(MANIFEST, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [from_path, to_path] = line.split("\t");
      if (!from_path || !to_path) throw new Error(`linha inválida no manifesto: ${line}`);
      return { from_path, to_path };
    });

  if (pairs.length !== MANIFEST_PAIRS) {
    throw new Error(
      `manifesto tem ${pairs.length} pares, esperado ${MANIFEST_PAIRS} — varredura abortada`,
    );
  }
  const origens = new Set(pairs.map((p) => p.from_path));
  if (origens.size !== MANIFEST_PAIRS) {
    throw new Error(
      `manifesto tem ${origens.size} origens únicas, esperado ${MANIFEST_PAIRS} — há from_path duplicado`,
    );
  }
  return pairs;
}

function assertNoChain(pairs: Pair[]): string[] {
  // Cadeia = destino de um par é origem de outro. O aceite exige 1:1 direto: o Google trata
  // cadeia como perda de sinal, e `trailingSlash: "always"` já adiciona um hop potencial.
  const origins = new Set(pairs.map((p) => p.from_path.replace(/\/$/, "")));
  return pairs
    .filter((p) => origins.has(p.to_path.replace(/\/$/, "")))
    .map((p) => `${p.from_path} -> ${p.to_path} (destino também é origem)`);
}

async function plan(): Promise<Pair[]> {
  const pairs = await pairsFromPosts();
  console.log(`pares derivados: ${pairs.length}`);
  const prefixes = new Map<string, number>();
  for (const p of pairs) {
    const prefix = `/${p.from_path.split("/").filter(Boolean)[0] ?? ""}/`;
    prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
  }
  for (const [prefix, n] of [...prefixes].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${prefix.padEnd(24)} ${n}`);
  }
  const chains = assertNoChain(pairs);
  for (const c of chains) console.log(`✗ CADEIA: ${c}`);
  if (chains.length > 0) throw new Error(`${chains.length} cadeia(s) — carga abortada`);
  return pairs;
}

async function load(): Promise<void> {
  const pairs = await plan();
  for (const p of pairs) await addRedirect(p.from_path, p.to_path, 301);
  const db = await getDb();
  const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM redirects`);
  console.log(`redirects na tabela após a carga: ${rows[0]?.n ?? 0}`);
}

// `fetch` sem sinal herda o timeout do runtime, que no Node é longo o bastante para a varredura
// parecer travada: uma URL que pendura segurava as 105 indefinidamente, sem saída nem sinal de
// qual par parou (achado de review, PR #315). 10s é folgado para um 301 servido por CDN.
const FETCH_TIMEOUT_MS = 10_000;

async function fetchComTimeout(url: URL): Promise<Response> {
  try {
    return await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    // `AbortError` cru não diz qual URL nem quanto esperou; a mensagem abaixo é o que aparece
    // no relatório da varredura.
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`timeout após ${FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

async function verify(base: string): Promise<void> {
  // Fonte é o manifesto congelado, não a tabela verificada nem `posts` (que T3.2 limpa).
  const pairs = pairsFromManifest();
  console.log(`varrendo ${pairs.length} URLs contra ${base}`);

  // Um redirect apagado da tabela é falha da migração, não item a ignorar. Sem esta checagem
  // a URL sumida simplesmente não seria testada.
  const db = await getDb();
  const presentes = new Set(
    (await db.query<{ from_path: string }>(`SELECT from_path FROM redirects`)).rows.map(
      (r) => r.from_path,
    ),
  );
  const ausentes = pairs.filter((p) => !presentes.has(p.from_path));
  for (const p of ausentes) console.log(`✗ ${p.from_path} AUSENTE da tabela redirects`);

  let fails = 0;
  for (const p of pairs) {
    try {
      const hop1 = await fetchComTimeout(new URL(p.from_path, base));
      const location = hop1.headers.get("location") ?? "";
      if (hop1.status !== 301) {
        console.log(`✗ ${p.from_path} → ${hop1.status} (esperado 301)`);
        fails++;
        continue;
      }
      const hop2 = await fetchComTimeout(new URL(location, base));
      if (hop2.status !== 200) {
        console.log(`✗ ${p.from_path} → 301 → ${location} → ${hop2.status} (esperado 200, sem cadeia)`);
        fails++;
        continue;
      }
      if (location.replace(/\/$/, "") !== p.to_path.replace(/\/$/, "")) {
        console.log(`✗ ${p.from_path} → ${location} (esperado ${p.to_path})`);
        fails++;
      }
    } catch (err) {
      // Falha de rede é falha da varredura, não motivo para abortá-la: sem este catch, um
      // `ECONNRESET` no par 12 derrubava o processo e os outros 93 nunca eram testados — o
      // relatório saía incompleto sem dizer que estava incompleto (achado de review, PR #315).
      console.log(`✗ ${p.from_path} → ${err instanceof Error ? err.message : String(err)}`);
      fails++;
    }
  }
  // Denominador é o manifesto (105), nunca o que a tabela tem hoje — senão apagar um redirect
  // faria a varredura "passar" com um total menor.
  const total = pairs.length;
  const falhas = fails + ausentes.length;
  console.log(`${total - falhas}/${total} resolvem 301 → 200 sem cadeia`);
  if (ausentes.length > 0) console.log(`  (${ausentes.length} ausente(s) da tabela)`);
  if (falhas > 0) throw new Error(`${falhas} falha(s) — reabre T2.2`);
}

async function main(): Promise<void> {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "plan") { await plan(); return; }
  if (mode === "load") { await load(); return; }
  if (mode === "verify") {
    const at = rest.indexOf("--base");
    const base = at === -1 ? undefined : rest[at + 1];
    if (!base) throw new Error("verify exige --base <url>");
    await verify(base);
    return;
  }
  throw new Error("uso: plan | load | verify --base <url>");
}

main()
  .then(async () => { (await getDb()).close(); })
  .catch(async (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    await (await getDb()).close();
    process.exitCode = 1;
  });

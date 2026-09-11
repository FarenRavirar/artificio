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

async function pairsFromRedirects(): Promise<Pair[]> {
  const db = await getDb();
  return (
    await db.query<Pair>(
      `SELECT from_path, to_path FROM redirects WHERE to_path LIKE '/blog/%' ORDER BY from_path`,
    )
  ).rows;
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

async function verify(base: string): Promise<void> {
  // Prefere os pares da tabela: depois de T3.2 o canonical some, e a varredura tem que
  // continuar rodando. Cai para `posts` só se a tabela ainda estiver vazia.
  let pairs = await pairsFromRedirects();
  if (pairs.length === 0) pairs = await pairsFromPosts();
  console.log(`varrendo ${pairs.length} URLs contra ${base}`);

  let fails = 0;
  for (const p of pairs) {
    const hop1 = await fetch(new URL(p.from_path, base), { redirect: "manual" });
    const location = hop1.headers.get("location") ?? "";
    if (hop1.status !== 301) {
      console.log(`✗ ${p.from_path} → ${hop1.status} (esperado 301)`);
      fails++;
      continue;
    }
    const hop2 = await fetch(new URL(location, base), { redirect: "manual" });
    if (hop2.status !== 200) {
      console.log(`✗ ${p.from_path} → 301 → ${location} → ${hop2.status} (esperado 200, sem cadeia)`);
      fails++;
      continue;
    }
    if (location.replace(/\/$/, "") !== p.to_path.replace(/\/$/, "")) {
      console.log(`✗ ${p.from_path} → ${location} (esperado ${p.to_path})`);
      fails++;
    }
  }
  console.log(`${pairs.length - fails}/${pairs.length} resolvem 301 → 200 sem cadeia`);
  if (fails > 0) throw new Error(`${fails} falha(s) — reabre T2.2`);
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

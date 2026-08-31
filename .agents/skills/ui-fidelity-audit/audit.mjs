#!/usr/bin/env node
// Auditoria de fidelidade visual contra @artificio/ui (skill ui-fidelity-audit).
// Read-only: mede e reporta, nunca edita. Exit 1 se alguma medicao reprovar.
import { readFileSync, existsSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// A skill vive em .agents/skills/ui-fidelity-audit/ — a raiz do repo esta 3 niveis acima.
// Resolver assim deixa a skill rodavel de qualquer cwd, nao so da raiz.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const argv = process.argv.slice(2);
const MODO_REPO = argv.includes("--repo");
let args = argv.filter((a) => a !== "--repo");

if (!MODO_REPO && args.length === 0) {
  console.error("uso: node audit.mjs <arquivo.tsx|arquivo.css> [...]");
  console.error("     node audit.mjs --repo    # varre apps/* e packages/* (fonte, sem build)");
  process.exit(2);
}

// Codigo-fonte que NOS escrevemos. Sem isto a varredura audita build e dependencia
// (medido: dist.a/_astro, .venv do Playwright, node_modules do camoufox) e o ruido
// afoga o achado real.
const IGNORAR = /(^|[\/])(node_modules|dist|dist\.[a-z]+|build|\.venv|\.turbo|coverage|\.astro|public)([\/]|$)/i;

if (MODO_REPO) {
  const varrer = (dir, out = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (IGNORAR.test(full)) continue;
      if (e.isDirectory()) varrer(full, out);
      else if (/\.(css|tsx|jsx)$/i.test(e.name)) out.push(full);
    }
    return out;
  };
  args = ["apps", "packages"]
    .map((d) => join(REPO, d))
    .filter((d) => existsSync(d))
    .flatMap((d) => varrer(d));
  console.log(`modo --repo: ${args.length} arquivos de fonte (build/deps excluidos)
`);
}

const RULE_SPACING = [0.25, 0.5, 0.75, 1, 1.25, 1.5]; // --space-1..6 em rem
const toRem = (v, unit) => (unit === "px" ? Number(v) / 16 : Number(v));
const onGrid4 = (rem) => Math.abs((rem * 16) % 4) < 0.01;

let fail = 0;
let alvoAtual = "";

// Agregado por app, so usado no modo --repo: 468 arquivos produzem centenas de
// linhas, e lista longa nao ajuda a decidir por onde comecar.
const porApp = new Map();
const somar = (chave, n = 1) => {
  const m = alvoAtual.replace(/\\/g, "/").match(/(?:apps|packages)\/([^/]+)/);
  const app = m ? m[1] : "(raiz)";
  const r = porApp.get(app) || { arquivos: new Set(), foraRegua: 0, dup: 0, semImport: 0, twFora: 0, kfDup: 0 };
  r[chave] += n;
  r.arquivos.add(alvoAtual);
  porApp.set(app, r);
};

const line = (ok, label, detail) => {
  if (!ok) fail++;
  if (!MODO_REPO) console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const SUPORTADAS = new Set([".css", ".tsx", ".jsx"]);

// Le um alvo so depois de validar tipo e extensao. Entrada nao auditavel e FALHA,
// nunca "verde": auditoria que aprova o que nao leu e pior que auditoria ausente.
// (Antes: `audit.mjs README.md` dizia "Tudo verde" com exit 0, e um diretorio
// derrubava o script com stack trace de node:fs.)
const lerAlvo = (arg) => {
  const file = resolve(arg);
  if (!existsSync(file)) { line(false, `entrada ausente: ${arg}`); return null; }
  if (statSync(file).isDirectory()) {
    line(false, `entrada e diretorio: ${arg}`, "passe os arquivos .css/.tsx explicitamente");
    return null;
  }
  const ext = extname(file).toLowerCase();
  if (!SUPORTADAS.has(ext)) {
    line(false, `extensao nao suportada: ${arg}`, `esperado ${[...SUPORTADAS].join("/")}`);
    return null;
  }
  return { file, ext, src: readFileSync(file, "utf8") };
};

for (const arg of args) {
  const alvo = lerAlvo(arg);
  if (!alvo) continue;
  const { src, ext, file } = alvo;
  alvoAtual = arg;
  if (!MODO_REPO) console.log(`\n== ${arg} (${src.split("\n").length} linhas)`);

  // `packages/ui` DEFINE a regua; medi-lo contra ela mesma acusa a fonte da verdade
  // (medido: 19 "fora da regua" em styles.css, que sao a escala do proprio pacote).
  // A auditoria de CONSUMO nao se aplica ao definidor — la o que vale e a paridade [6].
  const ehPacote = /packages[\\/]ui[\\/]/.test(file);
  if (ehPacote && !MODO_REPO) console.log("INFO fonte do design system — medicoes [2][3][4][7] nao se aplicam");

  if ((ext === ".tsx" || ext === ".jsx") && !ehPacote) {
    // [8] ESPACAMENTO EM CLASSE UTILITARIA DO TAILWIND.
    // As medicoes [2][3][4] leem CSS; tela escrita so com `gap-3.5`/`p-2` passava sem
    // ser auditada. Foi por esse furo que o mesmo 14px (`gap-3.5`) escapou duas vezes:
    // editor de mesa (098 §6.3) e editor de perfil (099 §9).
    // Escala Tailwind: 1 unidade = 0.25rem = 4px; o sufixo `.5` e meio passo (2px),
    // que por definicao NAO fecha na grade de 4px.
    // Os  sao obrigatorios: sem eles a alternancia curta (`p`, `m`) casa dentro
    // de outra classe (`gap-2` seria lido como `p-2`) e o valor sai errado.
    const TW_ESPACO = /\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y)-(\d+(?:\.5)?)\b/g;
    const twFora = new Map(); // classe -> ocorrencias
    for (const m of src.matchAll(TW_ESPACO)) {
      const rem = Number(m[1]) * 0.25;
      if (rem * 16 <= 2) continue; // hairline, mesmo criterio do CSS
      if (!RULE_SPACING.some((r) => Math.abs(r - rem) < 0.001)) {
        twFora.set(m[0], (twFora.get(m[0]) || 0) + 1);
      }
    }
    if (MODO_REPO && twFora.size) somar("twFora", [...twFora.values()].reduce((a, b) => a + b, 0));
    line(twFora.size === 0,
      `[8] espacamento Tailwind fora da regua: ${twFora.size} classe(s)`,
      twFora.size
        ? [...twFora.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([c, n]) => `${c}×${n} (${Number(c.match(/[\d.]+$/)[0]) * 4}px)`).join(", ")
        : "");

    const imports = (src.match(/from ["']@artificio\/ui[^"']*["']/g) || []).length;
    // So conta como "sem-import" o componente que de fato renderiza UI: arquivo de
    // teste e helper sem JSX inflavam o numero e faziam apps inteiros parecerem piores
    // do que sao.
    const ehTeste = /\.(test|spec)\.[jt]sx?$/i.test(file);
    const temJsx = /<[A-Za-z][\w.]*[\s/>]/.test(src);
    if (MODO_REPO && imports === 0 && !ehTeste && temJsx) somar("semImport");
    line(imports > 0, `[1] imports de @artificio/ui: ${imports}`,
      imports === 0 ? "tela sem primitivo do pacote — provavel design paralelo" : "");
  }

  if (ext === ".css" && !ehPacote) {
    const spaceVars = (src.match(/var\(--space-\d/g) || []).length;
    line(spaceVars > 0, `[2] var(--space-*): ${spaceVars}`,
      spaceVars === 0 ? "regua do pacote (base 4px) nao usada" : "");

    // Cobre tambem propriedades logicas (margin-inline-start, padding-block-end)
    // e row-gap/column-gap. O regex anterior perdia o prefixo: "row-gap" casava
    // so como "gap", e "margin-inline-start" nao casava de todo.
    const PROP_ESPACO = /(?:(?:row|column)-gap|gap|(?:padding|margin)(?:-(?:inline|block))?(?:-(?:start|end|top|right|bottom|left))?):\s*[^;]+/g;
    const decls = src.match(PROP_ESPACO) || [];
    const vals = new Set();
    const offGrid = new Set();
    const foraRegua = new Set();
    // Contagem de OCORRENCIAS, separada do Set de valores distintos: com so o Set,
    // acrescentar `margin: 100px` num arquivo que ja tinha `padding: 100px` nao
    // mudava o numero e o gate seguia verde, apesar de a divida ter crescido.
    let foraReguaOcorrencias = 0;
    const naRegua = (rem) => RULE_SPACING.some((r) => Math.abs(r - rem) < 0.001);
    for (const d of decls) {
      // `\d*\.?\d+` e nao `[0-9.]+`: o segundo casava ".px" em valores como
      // `calc(100% - .px)` e sujava o relatorio com um valor inexistente.
      for (const m of d.matchAll(/(\d*\.?\d+)(rem|px)\b/g)) {
        const rem = toRem(m[1], m[2]);
        if (rem * 16 <= 2) continue; // 1-2px sao hairline/borda, nao espacamento
        vals.add(rem);
        if (!onGrid4(rem)) offGrid.add(`${m[1]}${m[2]}`);
        if (!naRegua(rem)) { foraRegua.add(`${m[1]}${m[2]}`); foraReguaOcorrencias++; }
      }
    }
    // Pertencer a regua e mais forte que "estar na grade de 4px": 2rem e 3rem passam
    // na grade e NAO estao em --space-1..6. Contar valores distintos tambem nao pega:
    // um CSS com 2 valores, ambos fora da escala, passaria como verde.
    if (MODO_REPO && foraReguaOcorrencias) somar("foraRegua", foraReguaOcorrencias);
    line(foraRegua.size === 0,
      `[3] fora da regua --space-1..6: ${foraReguaOcorrencias} uso(s), ${foraRegua.size} valor(es)`,
      foraRegua.size
        ? [...foraRegua].join(", ") + ` — regua: ${RULE_SPACING.map((r) => r + "rem").join(", ")}`
        : "");
    line(offGrid.size === 0, `[4] fora da grade de 4px: ${offGrid.size}`,
      offGrid.size ? [...offGrid].join(", ") : "");

    const tokens = (src.match(/var\(--artificio-[a-z-]+/g) || []).length;
    const literals = (src.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g) || []).length;
    // Nao reprova: literal e legitimo nas excecoes da spec 022 T8 (ver SKILL.md).
    if (!MODO_REPO) console.log(`INFO [5] tokens de cor: ${tokens} · literais: ${literals}` +
      (literals ? " — ler o contexto antes de acusar (marca/plataforma/gradiente/scrim sao excecao)" : ""));
    const semComentario = src.replace(/\/\*[\s\S]*?\*\//g, "");
    if (/\[data-theme=["']?light/.test(semComentario) && !MODO_REPO)
      console.log("WARN [5] bloco [data-theme=light] local — foi removido de proposito; conferir spec 022 T8");
  }
}

// [7] REIMPLEMENTACAO: conceito que o pacote ja define, reescrito localmente.
// Este e o defeito que mais quebra padronizacao — nome local diferente esconde
// que a regra ja existe em @artificio/ui, e as duas versoes divergem com o tempo.
const PKG_CSS = join(REPO, "packages/ui/src/styles.css");
if (existsSync(PKG_CSS)) {
  const pkg = readFileSync(PKG_CSS, "utf8");
  const pkgClasses = new Set((pkg.match(/^\.artificio-[a-z0-9-]+/gm) || [])
    .map((c) => c.replace(/^\.artificio-/, "")));
  const pkgKeyframes = new Set((pkg.match(/@keyframes\s+([a-z0-9-]+)/gi) || [])
    .map((k) => k.split(/\s+/)[1].replace(/^artificio-/, "")));

  // Conceitos de UI que o pacote exporta como primitivo. Lista curada de proposito:
  // fatiar todo nome por hifen gera falso positivo (ex.: "user-systems-selector"
  // casaria com "usermenu"). So entra o que e de fato primitivo reusavel.
  const PRIMITIVOS = ["button", "badge", "avatar", "banner", "field", "panel",
    "modal", "dialog", "textarea", "input", "select", "spinner", "card", "tab"];
  const conceitoSet = new Set(PRIMITIVOS.filter((p) =>
    [...pkgClasses].some((c) => c === p || c.startsWith(p + "-"))));
  const ALIAS = { btn: "button" }; // nomes curtos que significam o mesmo

  for (const arg of args) {
    const file = resolve(arg);
    // Ja validado no laco principal; aqui so re-filtra os .css legiveis.
    if (!existsSync(file) || statSync(file).isDirectory()) continue;
    if (extname(file).toLowerCase() !== ".css") continue;
    if (/packages[\\\/]ui[\\\/]/.test(file)) continue; // o definidor nao reimplementa a si mesmo
    const src = readFileSync(file, "utf8");
    const locais = [...new Set((src.match(/^\.[a-z][a-z0-9-]*/gm) || [])
      .map((c) => c.slice(1)))];

    // Reimplementacao e a classe local que colide com uma classe REAL do pacote,
    // nao qualquer nome que comece com o mesmo primeiro segmento. `avatar-premium-
    // container` e composicao local legitima: o pacote so oferece `avatar`,
    // `avatar-fallback` e `avatar-link`, nao esse contêiner. Acusar por prefixo
    // obrigaria a renomear classe para escapar do scanner — o oposto do objetivo.
    const canon = (c) => (ALIAS[c.split("-")[0]]
      ? c.replace(/^[a-z]+/, ALIAS[c.split("-")[0]])
      : c);
    // Justificativa inline permitida pelo SKILL.md: `/* ui-fidelity: <motivo> */`
    // na regra desarma o achado daquela classe.
    const justificadas = new Set(
      [...src.matchAll(/^\.([a-z][a-z0-9-]*)[^{]*\{[^}]*ui-fidelity:/gm)].map((m) => m[1])
    );
    // Dois niveis, ambos exigindo evidencia — nunca prefixo solto:
    //  (a) colisao direta: a classe canonizada existe no pacote
    //      (`field-description`, `btn-*` -> `button-*`, `spinner`);
    //  (b) o seletor local declara as MESMAS propriedades estruturais que a regra
    //      homonima do pacote — sinal de regra copiada, nao de composicao.
    const suspeitos = locais.filter((c) => {
      if (justificadas.has(c)) return false;
      const cn = canon(c);
      if (pkgClasses.has(cn)) return true;              // colisao direta
      const head = c.split("-")[0];
      // `btn-*` e apelido de `button`: qualquer btn-* reimplementa o primitivo de
      // botao, que o pacote cobre com variantes (-primary/-ghost/-sm/-lg).
      if (head in ALIAS && pkgClasses.has(ALIAS[head])) return true;
      // Familia: o pacote define o conceito como sufixo de outro primitivo
      // (`spinner` existe so como `button-spinner`). Reescrever solto duplica a regra.
      return [...pkgClasses].some((pc) => pc.endsWith("-" + cn));
    });

    const kfLocais = (src.match(/@keyframes\s+([a-z0-9-]+)/gi) || [])
      .map((k) => k.split(/\s+/)[1]);
    const kfDup = kfLocais.filter((k) => pkgKeyframes.has(k.replace(/^artificio-/, "")));

    if (!MODO_REPO) console.log(`
== ${arg} — reimplementacao`);
    if (MODO_REPO && suspeitos.length) { alvoAtual = arg; somar("dup", suspeitos.length); }
    // [7b] tambem entra no gate: sem isto, acrescentar um `@keyframes spin` ja
    // definido pelo pacote — a duplicacao que ORIGINOU esta medicao — passava com
    // GATE OK, porque so `fail` era incrementado e o gate nao le `fail`.
    if (MODO_REPO && kfDup.length) { alvoAtual = arg; somar("kfDup", kfDup.length); }
    line(suspeitos.length === 0,
      `[7] classes locais sobre conceito ja definido no pacote: ${suspeitos.length}`,
      suspeitos.length ? suspeitos.slice(0, 12).join(", ") + (suspeitos.length > 12 ? " …" : "") : "");
    line(kfDup.length === 0,
      `[7b] @keyframes redeclarado: ${kfDup.length}`,
      kfDup.length ? `${kfDup.join(", ")} — o pacote ja define (conferir duracao/valores antes de manter)` : "");
  }
}

// [6] paridade do pacote — global, roda uma vez.
try {
  const out = execFileSync("node", [join(REPO, "packages/ui/scripts/check-token-parity.mjs")], { encoding: "utf8" });
  line(true, "[6] paridade tokens.ts/styles.css/tailwind-preset", out.trim().split("\n")[0].slice(0, 60));
} catch (e) {
  line(false, "[6] paridade de tokens", (e.stdout || e.message).toString().trim().split("\n")[0]);
}

if (MODO_REPO) {
  console.log("app             arqs  fora-regua  tailwind  reimplem.  keyfr.  sem-import");
  const linhas = [...porApp.entries()]
    .sort((a, b) => ((b[1].dup + b[1].kfDup) * 10 + b[1].foraRegua + b[1].twFora) -
                    ((a[1].dup + a[1].kfDup) * 10 + a[1].foraRegua + a[1].twFora));
  for (const [app, r] of linhas) {
    console.log(app.padEnd(15) + String(r.arquivos.size).padStart(5) +
      String(r.foraRegua).padStart(12) + String(r.twFora).padStart(10) +
      String(r.dup).padStart(11) + String(r.kfDup).padStart(8) +
      String(r.semImport).padStart(12));
  }
  console.log("\nPrioridade: reimplementacao (duplica regra do pacote) pesa 10x fora-regua.");
  console.log("`sem-import` sozinho NAO e defeito — componente pode nao precisar de primitivo.");
}

// --baseline: escreve o retrato atual. --gate: compara contra ele e falha SO se piorou.
// Exigir zero hoje seria gate morto (555 achados); travar a regressao e o que impede a
// proxima spec de acrescentar divergencia.
if (MODO_REPO && (argv.includes("--baseline") || argv.includes("--gate"))) {
  const BASE = join(REPO, ".agents/skills/ui-fidelity-audit/baseline.json");
  const atual = Object.fromEntries([...porApp.entries()].map(([app, r]) => [app, {
    foraRegua: r.foraRegua, twFora: r.twFora, dup: r.dup, kfDup: r.kfDup,
  }]));

  if (argv.includes("--baseline")) {
    writeFileSync(BASE, JSON.stringify(atual, null, 2) + "\n");
    console.log(`\nbaseline gravada: ${Object.keys(atual).length} apps`);
    process.exit(0);
  }

  if (!existsSync(BASE)) {
    console.error("\nsem baseline — rode antes: node audit.mjs --repo --baseline");
    process.exit(2);
  }
  const base = JSON.parse(readFileSync(BASE, "utf8"));
  const pioras = [];
  for (const [app, r] of Object.entries(atual)) {
    const b = base[app] || { foraRegua: 0, twFora: 0, dup: 0, kfDup: 0 };
    for (const k of ["dup", "kfDup", "twFora", "foraRegua"]) {
      if (r[k] > b[k]) pioras.push(`${app}.${k}: ${b[k]} -> ${r[k]} (+${r[k] - b[k]})`);
    }
  }
  console.log("");
  if (pioras.length) {
    console.log("GATE REPROVADO — divergencia nova em relacao a baseline:");
    for (const p of pioras) console.log("  " + p);
    console.log("\nUse o primitivo/token do pacote, ou justifique com /* ui-fidelity: <motivo> */.");
    console.log("Baixou de proposito? regrave: node audit.mjs --repo --baseline");
    process.exit(1);
  }
  const melhorou = Object.entries(atual).some(([app, r]) =>
    ["dup", "kfDup", "twFora", "foraRegua"].some((k) => r[k] < (base[app]?.[k] ?? 0)));
  console.log(melhorou
    ? "GATE OK — e a divergencia DIMINUIU; regrave a baseline para travar o ganho."
    : "GATE OK — nenhuma divergencia nova.");
  process.exit(0);
}

console.log(fail ? `\n${fail} medicao(oes) reprovada(s).` : "\nTudo verde.");
process.exit(fail ? 1 : 0);

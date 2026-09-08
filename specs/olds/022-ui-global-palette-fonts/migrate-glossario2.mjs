// Migração T5 glossário — passo 2: classes de BLOCO (contexto por linha).
// Regra: cada className do glossário é self-contained numa linha JSX.
//  - linha com bg-azul-escuro + hover de botão (btn-primary-bg-hover | hover:bg-azul-medio)
//    => BOTÃO: bg-azul-escuro→btn-primary-bg, e o texto branco da linha→btn-primary-fg.
//  - linha com bg-azul-escuro sem hover de botão => BLOCO NAVY decorativo:
//    bg-azul-escuro→navy-block-bg, texto branco da linha→navy-block-fg.
//  - texto branco fora de linha azul-escuro (filho de header navy / sobre marca) => navy-block-fg
//    (=#fff nos 2 temas; sem regressão). Opacidades de branco viram rgba literal (preserva look).
//  - backdrops bg-black/NN ficam (exceção). Idempotente.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "apps/glossario/frontend/src";
const NBG = "bg-[var(--navy-block-bg)]";
const NFG = "text-[var(--navy-block-fg)]";
const BBG = "bg-[var(--btn-primary-bg)]";
const BFG = "text-[var(--btn-primary-fg)]";

const tok = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// substitui classe-token respeitando borda (aspas/espaço/template/$).
function repTok(line, from, to) {
  const re = new RegExp(`(^|[\\s"'\`{])${tok(from)}(?=[\\s"'\`}]|$)`, "g");
  return line.replace(re, (m, p1) => p1 + to);
}

function whiteText(line) {
  // text-white/NN e hover:text-white → preserva opacidade via rgba; sólido → bloco fg.
  line = line.replace(/(^|[\s"'`{])text-white\/(\d{1,3})(?=[\s"'`}]|$)/g,
    (m, p1, n) => `${p1}text-[rgba(255,255,255,${(+n / 100).toFixed(2).replace(/0$/, "")})]`);
  line = line.replace(/(^|[\s"'`{])hover:text-white(?=[\s"'`}]|$)/g, `$1hover:${NFG}`);
  line = line.replace(/(^|[\s"'`{])placeholder-white\/(\d{1,3})(?=[\s"'`}]|$)/g,
    (m, p1, n) => `${p1}placeholder-[rgba(255,255,255,${(+n / 100).toFixed(2).replace(/0$/, "")})]`);
  return line;
}

function migrateLine(line) {
  if (line.includes("bg-azul-escuro") || line.includes("bg-azul-medio")) {
    const isButton = line.includes("btn-primary-bg-hover") || line.includes("hover:bg-azul-medio");
    if (isButton) {
      line = repTok(line, "bg-azul-escuro", BBG);
      line = repTok(line, "hover:bg-azul-medio", "hover:bg-[var(--btn-primary-bg-hover)]");
      // texto branco do botão → btn fg
      line = line.replace(/(^|[\s"'`{])text-white(?=[\s"'`}]|$)/g, `$1${BFG}`);
      line = line.replace(/(^|[\s"'`{])hover:text-white(?=[\s"'`}]|$)/g, `$1hover:${BFG}`);
    } else {
      line = repTok(line, "bg-azul-escuro", NBG);
      line = repTok(line, "bg-azul-medio", NBG);
      line = line.replace(/(^|[\s"'`{])text-white(?=[\s"'`}]|$)/g, `$1${NFG}`);
      line = whiteText(line);
    }
    return line;
  }
  // linhas sem bloco azul: texto branco solto → navy-block-fg / rgba
  line = line.replace(/(^|[\s"'`{])text-white(?=[\s"'`}]|$)/g, `$1${NFG}`);
  line = whiteText(line);
  return line;
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

let changed = 0;
for (const f of walk(ROOT)) {
  const src = readFileSync(f, "utf8");
  const out = src.split("\n").map(migrateLine).join("\n");
  if (out !== src) { changed++; console.log(f); writeFileSync(f, out); }
}
console.log("changed:", changed);

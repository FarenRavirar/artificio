#!/usr/bin/env node
// Auditoria de fidelidade visual contra @artificio/ui (skill ui-fidelity-audit).
// Read-only: mede e reporta, nunca edita. Exit 1 se alguma medicao reprovar.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, resolve } from "node:path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("uso: node audit.mjs <arquivo.tsx|arquivo.css> [...]");
  process.exit(2);
}

const RULE_SPACING = [0.25, 0.5, 0.75, 1, 1.25, 1.5]; // --space-1..6 em rem
const toRem = (v, unit) => (unit === "px" ? Number(v) / 16 : Number(v));
const onGrid4 = (rem) => Math.abs((rem * 16) % 4) < 0.01;

let fail = 0;
const line = (ok, label, detail) => {
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

for (const arg of args) {
  const file = resolve(arg);
  if (!existsSync(file)) { console.error(`ausente: ${arg}`); fail++; continue; }
  const src = readFileSync(file, "utf8");
  const ext = extname(file);
  console.log(`\n== ${arg} (${src.split("\n").length} linhas)`);

  if (ext === ".tsx" || ext === ".jsx") {
    const imports = (src.match(/from ["']@artificio\/ui[^"']*["']/g) || []).length;
    line(imports > 0, `[1] imports de @artificio/ui: ${imports}`,
      imports === 0 ? "tela sem primitivo do pacote — provavel design paralelo" : "");
  }

  if (ext === ".css") {
    const spaceVars = (src.match(/var\(--space-\d/g) || []).length;
    line(spaceVars > 0, `[2] var(--space-*): ${spaceVars}`,
      spaceVars === 0 ? "regua do pacote (base 4px) nao usada" : "");

    const decls = src.match(/(?:gap|padding|margin)(?:-[a-z]+)?:\s*[^;]+/g) || [];
    const vals = new Set();
    const offGrid = new Set();
    for (const d of decls) {
      for (const m of d.matchAll(/([0-9.]+)(rem|px)\b/g)) {
        const rem = toRem(m[1], m[2]);
        if (rem * 16 <= 2) continue; // 1-2px sao hairline/borda, nao espacamento
        vals.add(rem);
        if (!onGrid4(rem)) offGrid.add(`${m[1]}${m[2]}`);
      }
    }
    line(vals.size <= RULE_SPACING.length,
      `[3] valores distintos de espacamento: ${vals.size}`,
      vals.size > RULE_SPACING.length ? `regua do pacote tem ${RULE_SPACING.length}` : "");
    line(offGrid.size === 0, `[4] fora da grade de 4px: ${offGrid.size}`,
      offGrid.size ? [...offGrid].join(", ") : "");

    const tokens = (src.match(/var\(--artificio-[a-z-]+/g) || []).length;
    const literals = (src.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g) || []).length;
    // Nao reprova: literal e legitimo nas excecoes da spec 022 T8 (ver SKILL.md).
    console.log(`INFO [5] tokens de cor: ${tokens} · literais: ${literals}` +
      (literals ? " — ler o contexto antes de acusar (marca/plataforma/gradiente/scrim sao excecao)" : ""));
    const semComentario = src.replace(/\/\*[\s\S]*?\*\//g, "");
    if (/\[data-theme=["']?light/.test(semComentario))
      console.log("WARN [5] bloco [data-theme=light] local — foi removido de proposito; conferir spec 022 T8");
  }
}

// [6] paridade do pacote — global, roda uma vez.
try {
  const out = execFileSync("node", ["packages/ui/scripts/check-token-parity.mjs"], { encoding: "utf8" });
  line(true, "[6] paridade tokens.ts/styles.css/tailwind-preset", out.trim().split("\n")[0].slice(0, 60));
} catch (e) {
  line(false, "[6] paridade de tokens", (e.stdout || e.message).toString().trim().split("\n")[0]);
}

console.log(fail ? `\n${fail} medicao(oes) reprovada(s).` : "\nTudo verde.");
process.exit(fail ? 1 : 0);

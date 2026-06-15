// Migração T5 glossário — substituição de classes INEQUÍVOCAS (sem contexto) por var canônica.
// NÃO toca: text-white (fg de bloco), bg-azul-escuro/azul-medio (btn vs banner), backdrops
// bg-black/NN, hover:bg-black já tratado. Essas ficam manuais por arquivo. Idempotente.
// Uso: node specs/022-ui-global-palette-fonts/migrate-glossario.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = "apps/glossario/frontend/src";

const B = "var(--artificio-brand)";
const O = (a) => `rgba(255,87,34,${a})`;

// pares [classe exata, substituta]. Ordem: mais específicas (com /opacity) antes.
const MAP = [
  // --- texto neutro ---
  ["text-gray-900", "text-[var(--fg)]"],
  ["text-gray-800", "text-[var(--fg)]"],
  ["text-gray-700", "text-[var(--fg)]"],
  ["text-gray-600", "text-[var(--fg-muted)]"],
  ["text-gray-500", "text-[var(--fg-muted)]"],
  ["text-gray-400", "text-[var(--fg-muted)]"],
  ["text-gray-300", "text-[var(--fg-muted)]"],
  ["hover:text-gray-700", "hover:text-[var(--fg-muted)]"],
  ["hover:text-black", "hover:text-[var(--fg)]"],
  ["placeholder-gray-400", "placeholder-[var(--fg-muted)]"],
  ["text-[#020740]", "text-[var(--fg)]"],
  // --- azul nomeado: texto = tema; borda = line ---
  ["group-hover:text-azul-escuro", "group-hover:text-[var(--fg)]"],
  ["hover:text-azul-escuro", "hover:text-[var(--fg)]"],
  ["hover:text-azul-medio", "hover:text-[var(--fg-muted)]"],
  ["text-azul-escuro", "text-[var(--fg)]"],
  ["text-azul-medio", "text-[var(--fg-muted)]"],
  ["border-azul-escuro/10", "border-[var(--line)]"],
  ["hover:border-azul-medio/30", "hover:border-[var(--line-strong)]"],
  ["hover:border-azul-escuro", "hover:border-[var(--line-strong)]"],
  ["border-azul-medio/30", "border-[var(--line-strong)]"],
  ["border-azul-escuro", "border-[var(--line)]"],
  ["border-azul-medio", "border-[var(--line)]"],
  // --- superfícies neutras (bg-white = card no light) ---
  ["bg-white/60", "bg-[var(--surface)]"],
  ["bg-white/50", "bg-[var(--surface)]"],
  ["bg-white/10", "bg-[var(--fill)]"],
  ["bg-white/5", "bg-[var(--fill-subtle)]"],
  ["hover:bg-white/10", "hover:bg-[var(--fill)]"],
  ["hover:bg-white", "hover:bg-[var(--surface)]"],
  ["bg-white", "bg-[var(--surface)]"],
  ["bg-cinza-fundo", "bg-[var(--surface-subtle)]"],
  ["bg-[#f0f4ff]", "bg-[var(--surface-subtle)]"],
  // --- bordas/divide/ring neutras brancas ---
  ["border-white/20", "border-[var(--line-strong)]"],
  ["border-white/10", "border-[var(--line)]"],
  ["border-white", "border-[var(--line)]"],
  ["ring-white", "ring-[var(--line-strong)]"],
  ["via-white", "via-[var(--surface)]"],
  ["divide-gray-100", "divide-[var(--line)]"],
  // --- bordas cinza neutras ---
  ["hover:border-gray-200", "hover:border-[var(--line)]"],
  ["border-gray-300", "border-[var(--line)]"],
  ["border-gray-200", "border-[var(--line)]"],
  ["border-gray-100", "border-[var(--line)]"],
  ["border-gray-50", "border-[var(--line)]"],
  // --- bg cinza neutro ---
  ["hover:bg-gray-200/50", "hover:bg-[var(--surface-strong)]"],
  ["hover:bg-gray-200", "hover:bg-[var(--surface-strong)]"],
  ["hover:bg-gray-100", "hover:bg-[var(--surface-subtle)]"],
  ["hover:bg-gray-50", "hover:bg-[var(--surface-subtle)]"],
  ["bg-gray-200/50", "bg-[var(--surface-strong)]"],
  ["bg-gray-200", "bg-[var(--surface-strong)]"],
  ["bg-gray-100", "bg-[var(--surface-subtle)]"],
  ["bg-gray-50/70", "bg-[var(--surface-subtle)]"],
  ["bg-gray-50/50", "bg-[var(--surface-subtle)]"],
  ["bg-gray-50/30", "bg-[var(--surface-subtle)]"],
  ["bg-gray-50", "bg-[var(--surface-subtle)]"],
  // --- botão navy: hover preto (sempre em CTA azul-escuro) ---
  ["hover:bg-black", "hover:bg-[var(--btn-primary-bg-hover)]"],
  // --- marca laranja ---
  ["focus:ring-laranja", `focus:ring-[${B}]`],
  ["focus:border-laranja", `focus:border-[${B}]`],
  ["group-hover:text-laranja", `group-hover:text-[${B}]`],
  ["hover:text-laranja", `hover:text-[${B}]`],
  ["hover:border-laranja/30", `hover:border-[${O("0.30")}]`],
  ["text-laranja", `text-[${B}]`],
  ["bg-laranja/10", `bg-[${O("0.10")}]`],
  ["bg-laranja/5", `bg-[${O("0.05")}]`],
  ["bg-laranja", `bg-[${B}]`],
  ["border-laranja/20", `border-[${O("0.20")}]`],
  ["border-laranja/10", `border-[${O("0.10")}]`],
  ["border-laranja", `border-[${B}]`],
  // --- tints semânticos: info (blue+cyan) ---
  ["bg-blue-100", "bg-[var(--state-info-bg)]"],
  ["bg-blue-50/50", "bg-[var(--state-info-bg)]"],
  ["bg-blue-50/30", "bg-[var(--state-info-bg)]"],
  ["bg-blue-50", "bg-[var(--state-info-bg)]"],
  ["bg-blue-500", "bg-[var(--state-info-bg)]"],
  ["hover:bg-blue-100", "hover:bg-[var(--state-info-bg)]"],
  ["hover:bg-blue-50/30", "hover:bg-[var(--state-info-bg)]"],
  ["hover:bg-blue-50", "hover:bg-[var(--state-info-bg)]"],
  ["bg-cyan-50", "bg-[var(--state-info-bg)]"],
  ["text-blue-900", "text-[var(--state-info-fg)]"],
  ["text-blue-800", "text-[var(--state-info-fg)]"],
  ["text-blue-700", "text-[var(--state-info-fg)]"],
  ["text-blue-600", "text-[var(--state-info-fg)]"],
  ["text-blue-300", "text-[var(--state-info-fg)]"],
  ["text-blue-200", "text-[var(--state-info-fg)]"],
  ["text-cyan-800", "text-[var(--state-info-fg)]"],
  ["text-cyan-700", "text-[var(--state-info-fg)]"],
  ["text-cyan-600", "text-[var(--state-info-fg)]"],
  ["border-blue-200", "border-[var(--state-info-line)]"],
  ["border-blue-100", "border-[var(--state-info-line)]"],
  ["border-cyan-200", "border-[var(--state-info-line)]"],
  ["border-cyan-100", "border-[var(--state-info-line)]"],
  // --- success (green) ---
  ["bg-green-100", "bg-[var(--state-success-bg)]"],
  ["bg-green-50", "bg-[var(--state-success-bg)]"],
  ["hover:bg-green-100", "hover:bg-[var(--state-success-bg)]"],
  ["hover:bg-green-50", "hover:bg-[var(--state-success-bg)]"],
  ["text-green-800", "text-[var(--state-success-fg)]"],
  ["text-green-700", "text-[var(--state-success-fg)]"],
  ["text-green-600", "text-[var(--state-success-fg)]"],
  ["text-green-500", "text-[var(--state-success-fg)]"],
  ["text-green-400", "text-[var(--state-success-fg)]"],
  ["text-green-300", "text-[var(--state-success-fg)]"],
  ["hover:text-green-600", "hover:text-[var(--state-success-fg)]"],
  ["border-green-200", "border-[var(--state-success-line)]"],
  ["border-green-100", "border-[var(--state-success-line)]"],
  // --- danger (red) ---
  ["bg-red-100", "bg-[var(--state-danger-bg)]"],
  ["bg-red-50", "bg-[var(--state-danger-bg)]"],
  ["hover:bg-red-100", "hover:bg-[var(--state-danger-bg)]"],
  ["hover:bg-red-50", "hover:bg-[var(--state-danger-bg)]"],
  ["text-red-700", "text-[var(--state-danger-fg)]"],
  ["text-red-600", "text-[var(--state-danger-fg)]"],
  ["text-red-500", "text-[var(--state-danger-fg)]"],
  ["text-red-400", "text-[var(--state-danger-fg)]"],
  ["hover:text-red-500", "hover:text-[var(--state-danger-fg)]"],
  ["hover:text-red-400", "hover:text-[var(--state-danger-fg)]"],
  ["border-red-200", "border-[var(--state-danger-line)]"],
  // --- warning (amber/yellow/orange) ---
  ["bg-amber-100", "bg-[var(--state-warning-bg)]"],
  ["bg-amber-50", "bg-[var(--state-warning-bg)]"],
  ["bg-amber-600", "bg-[var(--state-warning-bg)]"],
  ["bg-amber-200", "bg-[var(--state-warning-bg)]"],
  ["bg-yellow-50", "bg-[var(--state-warning-bg)]"],
  ["bg-orange-50", "bg-[var(--state-warning-bg)]"],
  ["from-amber-50", "from-[var(--state-warning-bg)]"],
  ["to-orange-50", "to-[var(--state-warning-bg)]"],
  ["hover:bg-amber-700", "hover:bg-[var(--state-warning-bg)]"],
  ["text-amber-950", "text-[var(--state-warning-fg)]"],
  ["text-amber-900", "text-[var(--state-warning-fg)]"],
  ["text-amber-800", "text-[var(--state-warning-fg)]"],
  ["text-amber-700", "text-[var(--state-warning-fg)]"],
  ["text-amber-600", "text-[var(--state-warning-fg)]"],
  ["text-yellow-700", "text-[var(--state-warning-fg)]"],
  ["hover:text-orange-600", "hover:text-[var(--state-warning-fg)]"],
  ["text-orange-600", "text-[var(--state-warning-fg)]"],
  ["border-amber-300", "border-[var(--state-warning-line)]"],
  ["border-amber-200", "border-[var(--state-warning-line)]"],
  ["border-amber-100", "border-[var(--state-warning-line)]"],
  ["focus:border-amber-500", "focus:border-[var(--state-warning-line)]"],
  ["focus:ring-amber-200", "focus:ring-[var(--state-warning-line)]"],
  // --- especial (purple) ---
  ["text-purple-600", "text-[var(--special)]"],
];

// Substituição por TOKEN delimitado (entre aspas/espaço) p/ não casar prefixo de outra classe.
function migrate(src) {
  let out = src;
  for (const [from, to] of MAP) {
    // escape regex
    const f = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // borda: precedido por aspas/espaço/backtick, seguido por aspas/espaço/backtick.
    const re = new RegExp(`(^|[\\s"'\`])${f}(?=[\\s"'\`]|$)`, "g");
    out = out.replace(re, (m, p1) => p1 + to);
  }
  return out;
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
  const out = migrate(src);
  if (out !== src) {
    changed++;
    console.log((DRY ? "[dry] " : "") + f);
    if (!DRY) writeFileSync(f, out);
  }
}
console.log(`${DRY ? "would change" : "changed"}: ${changed} files`);

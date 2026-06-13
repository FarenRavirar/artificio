// Trava de paridade da fonte unica de tokens (Spec 020 / D064).
// tokens.ts e a fonte; styles.css (CSS vars) e tailwind-preset.js devem concordar.
// Drift entre eles ja causou bug real (preset com ink #10103A / brand #FC9054).
// Roda sem dep: node scripts/check-token-parity.mjs (exit 1 em divergencia).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const tokens = read("src/tokens.ts");
const styles = read("src/styles.css");
const preset = read("tailwind-preset.js");

const norm = (h) => h && h.toLowerCase();
const grab = (src, re) => {
  const m = src.match(re);
  return m ? norm(m[1]) : null;
};

// papel -> [valor em tokens.ts, valor em styles.css, valor em preset.js]
// null = papel ausente naquele arquivo (nao compara).
const roles = {
  ink: [
    grab(tokens, /\bink:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-ink:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bink:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  brand: [
    grab(tokens, /\bbrand:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-brand:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bbrand:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  brandDeep: [
    grab(tokens, /\bbrandDeep:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-brand-deep:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /"brand-deep":\s*"(#[0-9a-fA-F]{6})"/),
  ],
  focus: [
    grab(tokens, /\bfocus:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-focus:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bfocus:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  muted: [
    grab(tokens, /\bmuted:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-muted:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bmuted:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  line: [
    grab(tokens, /\bline:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-line:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bline:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  surface: [
    grab(tokens, /\bsurface:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-surface:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bsurface:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  canvas: [
    grab(tokens, /\bcanvas:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-canvas:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bcanvas:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  charcoal: [
    grab(tokens, /\bcharcoal:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-charcoal:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bcharcoal:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  // navy = superfície dark canônica (header/footer dark + dark variants D065/D066).
  // Cross-app de verdade após os pilotos lua/sol → entra na trava. Sem alias no
  // preset (preset=null não compara); valida tokens.ts vs styles.css.
  navy: [
    grab(tokens, /\bnavy:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-navy:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  bronze: [
    grab(tokens, /\bbronze:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-bronze:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bbronze:\s*"(#[0-9a-fA-F]{6})"/),
  ],
};

const labels = ["tokens.ts", "styles.css", "preset.js"];
const fails = [];
for (const [role, vals] of Object.entries(roles)) {
  const present = vals.filter((v) => v !== null);
  if (present.length === 0) {
    fails.push(`${role}: nao encontrado em nenhum arquivo (regex quebrou?)`);
    continue;
  }
  const uniq = [...new Set(present)];
  if (uniq.length > 1) {
    const detail = vals
      .map((v, i) => `${labels[i]}=${v ?? "—"}`)
      .join("  ");
    fails.push(`${role}: divergente -> ${detail}`);
  }
}

if (fails.length) {
  console.error("PARITY FAIL (tokens.ts vs styles.css vs preset.js):");
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("token parity OK:", Object.keys(roles).join(", "));

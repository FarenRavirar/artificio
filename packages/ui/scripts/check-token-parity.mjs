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

  // Semânticos (B11) — 3 saídas (tokens.ts / styles.css / preset.js).
  success: [
    grab(tokens, /\bsuccess:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-success:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bsuccess:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  successText: [
    grab(tokens, /\bsuccessText:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-success-text:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /"success-text":\s*"(#[0-9a-fA-F]{6})"/),
  ],
  warning: [
    grab(tokens, /\bwarning:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-warning:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bwarning:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  warningText: [
    grab(tokens, /\bwarningText:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-warning-text:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /"warning-text":\s*"(#[0-9a-fA-F]{6})"/),
  ],
  danger: [
    grab(tokens, /\bdanger:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-danger:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\bdanger:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  dangerText: [
    grab(tokens, /\bdangerText:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-danger-text:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /"danger-text":\s*"(#[0-9a-fA-F]{6})"/),
  ],
  info: [
    grab(tokens, /\binfo:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-info:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /\binfo:\s*"(#[0-9a-fA-F]{6})"/),
  ],
  infoText: [
    grab(tokens, /\binfoText:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-info-text:\s*(#[0-9a-fA-F]{6})/),
    grab(preset, /"info-text":\s*"(#[0-9a-fA-F]{6})"/),
  ],

  // Superfícies dark/light estruturadas (B10b) — sem alias no preset (preset=null),
  // valida tokens.ts vs styles.css (mesmo padrão do navy).
  darkCanvas: [
    grab(tokens, /\bdarkCanvas:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-dark-canvas:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  darkSubtle: [
    grab(tokens, /\bdarkSubtle:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-dark-subtle:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  darkSurface: [
    grab(tokens, /\bdarkSurface:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-dark-surface:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  darkStrong: [
    grab(tokens, /\bdarkStrong:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-dark-strong:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  darkText: [
    grab(tokens, /\bdarkText:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-dark-text:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  darkMuted: [
    grab(tokens, /\bdarkMuted:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-dark-muted:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  lightCanvas: [
    grab(tokens, /\blightCanvas:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-light-canvas:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  lightSubtle: [
    grab(tokens, /\blightSubtle:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-light-subtle:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  lightSurface: [
    grab(tokens, /\blightSurface:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-light-surface:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  lightStrong: [
    grab(tokens, /\blightStrong:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-light-strong:\s*(#[0-9a-fA-F]{6})/),
    null,
  ],
  lightInk: [
    grab(tokens, /\blightInk:\s*"(#[0-9a-fA-F]{6})"/),
    grab(styles, /--artificio-light-ink:\s*(#[0-9a-fA-F]{6})/),
    null,
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

// --- Vars semânticas de tema (Spec 022 T3) ---------------------------------
// Não têm hex único (derivam via var()/rgba e viram por tema), então em vez de
// comparar valor travamos PRESENÇA: cada nome canônico deve existir no bloco
// :root (light) E no bloco :root[data-theme="dark"] de styles.css. Falta em
// qualquer tema = fail (garante "vars têm valor nos 2 temas", T3).
// Grupo A: viram por tema → devem existir em :root (light) E em :root[data-theme="dark"].
const bothThemeVars = [
  "--fg", "--fg-muted",
  "--canvas", "--surface", "--surface-subtle", "--surface-strong",
  "--line", "--line-strong",
  "--fill-subtle", "--fill", "--fill-strong", "--special",
  "--state-success-fg", "--state-warning-fg", "--state-danger-fg", "--state-info-fg",
  "--btn-primary-bg", "--btn-primary-fg", "--btn-primary-bg-hover",
  "--navy-block-bg", "--navy-block-fg",
];
// Grupo B: theme-agnósticos (rgba leve serve nos 2 fundos) → só :root, NÃO redefinir no dark.
const lightOnlyVars = [
  "--state-success-bg", "--state-success-line",
  "--state-warning-bg", "--state-warning-line",
  "--state-danger-bg", "--state-danger-line",
  "--state-info-bg", "--state-info-line",
];
const darkBlock = (styles.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/) || [, ""])[1];
// :root light = primeiro bloco :root { ... } que NÃO seja o [data-theme].
const lightBlocks = styles.match(/(?<!\])\:root\s*\{([^}]*)\}/g) || [];
const lightBody = lightBlocks.join("\n");
const decl = (name) => new RegExp(`\\${name}\\s*:`);
for (const name of bothThemeVars) {
  const inLight = decl(name).test(lightBody);
  const inDark = decl(name).test(darkBlock);
  if (!inLight || !inDark) {
    fails.push(
      `${name}: ausente em ${[!inLight && ":root(light)", !inDark && ":root[data-theme=dark]"].filter(Boolean).join(" + ")}`,
    );
  }
}
for (const name of lightOnlyVars) {
  if (!decl(name).test(lightBody)) fails.push(`${name}: ausente em :root(light)`);
}

if (fails.length) {
  console.error("PARITY FAIL (tokens.ts vs styles.css vs preset.js):");
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("token parity OK:", Object.keys(roles).join(", "));

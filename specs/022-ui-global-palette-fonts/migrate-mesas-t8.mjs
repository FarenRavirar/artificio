// Migração T8 mesas (área PERFIL/MestrePage) — utilities cruas → vars canônicas.
// Escopo = só os arquivos da área (sem big-bang; mesas é prod dark-default).
// Tailwind v4. Backdrops bg-black/NN mantidos (exceção). Idempotente.
// Colapso aceito (2026-06-15): text-white/* → --fg-muted (1 nível). Dark vira #eef1f8
// (ui :root[data-theme=dark] vence o :root do mesas) = unificação aprovada.
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "pages/MestrePage.tsx",
  "pages/ProfileEditPage.tsx",
  "components/TableCardDashboard.tsx",
  "components/LinksDisplay.tsx",
  "components/LinksManager.tsx",
  "components/SettingStylesField.tsx",
  "components/UserSystemsSelector.tsx",
  "features/table/components/MasterCard.tsx",
  "features/table/components/TableActionPanel.tsx",
  "features/table/components/TableMaster.tsx",
].map((f) => "apps/mesas/frontend/src/" + f);

const P = (a) => `rgba(168,85,247,${a})`; // special (roxo) tint theme-agnóstico

// regex-token: borda aspas/espaço/template. ORDEM: mais específico (/opacity) antes.
const MAP = [
  // texto branco: sólido→fg, qualquer opacidade→fg-muted (colapso)
  ["text-white/90", "text-[var(--fg-muted)]"], ["text-white/80", "text-[var(--fg-muted)]"],
  ["text-white/70", "text-[var(--fg-muted)]"], ["text-white/60", "text-[var(--fg-muted)]"],
  ["text-white/55", "text-[var(--fg-muted)]"], ["text-white/50", "text-[var(--fg-muted)]"],
  ["text-white/40", "text-[var(--fg-muted)]"], ["text-white/30", "text-[var(--fg-muted)]"],
  ["text-white", "text-[var(--fg)]"],
  // fills brancos
  ["bg-white/20", "bg-[var(--fill-strong)]"], ["bg-white/15", "bg-[var(--fill)]"],
  ["bg-white/10", "bg-[var(--fill)]"], ["bg-white/5", "bg-[var(--fill-subtle)]"],
  ["hover:bg-white/10", "hover:bg-[var(--fill)]"], ["hover:bg-white/5", "hover:bg-[var(--fill-subtle)]"],
  ["bg-white", "bg-[var(--surface)]"],
  // bordas brancas
  ["hover:border-white/40", "hover:border-[var(--line-strong)]"],
  ["border-white/40", "border-[var(--line-strong)]"], ["border-white/30", "border-[var(--line-strong)]"],
  ["border-white/20", "border-[var(--line-strong)]"], ["border-white/15", "border-[var(--line-strong)]"],
  ["border-white/10", "border-[var(--line)]"], ["border-white/5", "border-[var(--line)]"],
  // texto cinza/slate → muted
  ["text-gray-400", "text-[var(--fg-muted)]"], ["text-gray-300", "text-[var(--fg-muted)]"],
  ["text-slate-400", "text-[var(--fg-muted)]"], ["text-slate-300", "text-[var(--fg-muted)]"],
  // superfícies arbitrary
  ["bg-[#13213f]", "bg-[var(--surface-subtle)]"], ["bg-[#0F1A2E]", "bg-[var(--surface-subtle)]"],
  ["bg-[#1B2A4A]", "bg-[var(--surface)]"], ["bg-[#10203a]", "bg-[var(--surface)]"],
  ["bg-[#0a1628]", "bg-[var(--canvas)]"],
  // --- ESTADOS ---
  // info (blue)
  ["hover:bg-blue-500/30", "hover:bg-[var(--state-info-bg)]"], ["hover:bg-blue-600", "hover:bg-[var(--state-info-bg)]"],
  ["bg-blue-500/20", "bg-[var(--state-info-bg)]"], ["to-blue-500/10", "to-[var(--state-info-bg)]"],
  ["text-blue-300", "text-[var(--state-info-fg)]"],
  // success (green)
  ["hover:bg-green-500/30", "hover:bg-[var(--state-success-bg)]"],
  ["bg-green-500/20", "bg-[var(--state-success-bg)]"],
  ["text-green-400", "text-[var(--state-success-fg)]"], ["text-green-300", "text-[var(--state-success-fg)]"],
  // warning (yellow + orange)
  ["hover:bg-yellow-500/30", "hover:bg-[var(--state-warning-bg)]"], ["hover:bg-yellow-600", "hover:bg-[var(--state-warning-bg)]"],
  ["hover:bg-orange-500/30", "hover:bg-[var(--state-warning-bg)]"],
  ["bg-yellow-500/20", "bg-[var(--state-warning-bg)]"],
  ["border-yellow-500/20", "border-[var(--state-warning-line)]"], ["border-orange-400/30", "border-[var(--state-warning-line)]"],
  ["hover:text-orange-300", "hover:text-[var(--state-warning-fg)]"],
  ["text-yellow-400", "text-[var(--state-warning-fg)]"], ["text-yellow-300", "text-[var(--state-warning-fg)]"],
  ["text-orange-400", "text-[var(--state-warning-fg)]"], ["text-orange-300", "text-[var(--state-warning-fg)]"],
  // danger (red)
  ["hover:bg-red-500/20", "hover:bg-[var(--state-danger-bg)]"],
  ["border-red-500/20", "border-[var(--state-danger-line)]"],
  ["text-red-400/60", "text-[var(--state-danger-fg)]"],
  ["text-red-400", "text-[var(--state-danger-fg)]"], ["text-red-300", "text-[var(--state-danger-fg)]"],
  // neutros tint (gray/slate button) → fill + muted
  ["hover:bg-gray-500/30", "hover:bg-[var(--fill)]"], ["hover:bg-slate-500/30", "hover:bg-[var(--fill)]"],
  ["bg-gray-500/20", "bg-[var(--fill)]"], ["bg-slate-500/20", "bg-[var(--fill)]"],
  // --- ESPECIAL (roxo): texto vira; bg/line tint theme-agnóstico ---
  ["group-hover:text-purple-300", "group-hover:text-[var(--special)]"],
  ["group-hover:text-purple-200", "group-hover:text-[var(--special)]"],
  ["text-purple-300/90", "text-[var(--special)]"], ["text-purple-300/70", "text-[var(--special)]"],
  ["text-purple-300/60", "text-[var(--special)]"], ["text-purple-300", "text-[var(--special)]"],
  ["hover:border-purple-500/60", `hover:border-[${P("0.60")}]`],
  ["hover:border-purple-500/40", `hover:border-[${P("0.40")}]`],
  ["border-purple-500/30", `border-[${P("0.30")}]`], ["border-purple-500/20", `border-[${P("0.20")}]`],
  ["border-purple-400/30", `border-[${P("0.30")}]`],
  ["bg-purple-500/20", `bg-[${P("0.20")}]`], ["bg-purple-500/10", `bg-[${P("0.10")}]`],
  ["from-purple-500/10", `from-[${P("0.10")}]`],
  ["group-hover:border-purple-500/60", `group-hover:border-[${P("0.60")}]`],
  // solids + variantes restantes
  ["bg-yellow-500/10", "bg-[var(--state-warning-bg)]"], ["bg-yellow-500", "bg-[var(--artificio-warning)]"],
  ["bg-red-500/10", "bg-[var(--state-danger-bg)]"], ["bg-orange-500/20", "bg-[var(--state-warning-bg)]"],
  ["bg-blue-500", "bg-[var(--artificio-info)]"], ["bg-gray-500/80", "bg-[var(--fill-strong)]"],
  ["bg-[#13213f]/40", "bg-[var(--surface-subtle)]"],
];

const tok = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function migrate(src) {
  let out = src;
  for (const [from, to] of MAP) {
    const re = new RegExp(`(^|[\\s"'\`{])${tok(from)}(?=[\\s"'\`}]|$)`, "g");
    out = out.replace(re, (m, p1) => p1 + to);
  }
  return out;
}

let changed = 0;
for (const f of FILES) {
  const src = readFileSync(f, "utf8");
  const out = migrate(src);
  if (out !== src) { changed++; console.log(f); writeFileSync(f, out); }
}
console.log("changed:", changed);

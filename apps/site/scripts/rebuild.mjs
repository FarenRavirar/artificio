// Rebuild SSG atômico (spec 011 / D053, revisão: swap precisa ser atômico de fato).
// Estratégia: 2 dirs estáveis (dist.a / dist.b) + `dist` = SYMLINK p/ o ativo.
// Builda no dir INATIVO e retarget do symlink via rename (atômico no POSIX) → sem janela com `dist` ausente.
// Fallback (Windows/sem symlink): rename com restore em caso de falha.
import { execSync } from "node:child_process";
import { existsSync, rmSync, renameSync, symlinkSync, lstatSync, readlinkSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "dist");
const A = resolve(ROOT, "dist.a");
const B = resolve(ROOT, "dist.b");

const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: "inherit" });

function currentTarget() {
  try {
    if (existsSync(DIST) && lstatSync(DIST).isSymbolicLink()) return resolve(ROOT, readlinkSync(DIST));
  } catch { /* ignore */ }
  return null;
}

console.log("[rebuild] export store -> json");
run("pnpm run export");

// Builda no dir inativo (o que NÃO está live).
const live = currentTarget();
const target = live === A ? B : A;
if (existsSync(target)) rmSync(target, { recursive: true, force: true });

console.log(`[rebuild] astro build -> ${basename(target)}`);
run(`pnpm exec astro build --outDir ${JSON.stringify(target)}`);
console.log(`[rebuild] pagefind -> ${basename(target)}`);
run(`pnpm exec pagefind --site ${JSON.stringify(target)}`);

console.log("[rebuild] swap atômico");
try {
  // Symlink temp -> target, depois rename sobre `dist` (atômico no POSIX, mesmo sobre symlink existente).
  const tmp = `${DIST}.lnk.${process.pid}`;
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  symlinkSync(target, tmp, "junction");
  let legacyDir = null;
  if (existsSync(DIST) && !lstatSync(DIST).isSymbolicLink()) {
    // `dist` era dir real (1º uso/legado): move p/ fora antes de pôr o symlink.
    legacyDir = `${DIST}.legacy.${process.pid}`;
    renameSync(DIST, legacyDir);
  }
  renameSync(tmp, DIST);
  if (legacyDir) rmSync(legacyDir, { recursive: true, force: true });
  console.log(`[rebuild] OK (symlink dist -> ${basename(target)})`);
} catch (e) {
  // Fallback sem symlink (Windows): rename com restore. `dist` vira dir real.
  console.warn("[rebuild] symlink swap indisponível, fallback rename:", String(e.message || e));
  const OLD = `${DIST}.old.${process.pid}`;
  if (existsSync(DIST)) renameSync(DIST, OLD);
  try {
    renameSync(target, DIST);
  } catch (err) {
    if (existsSync(OLD)) renameSync(OLD, DIST); // restore: nunca deixa o site sem dist
    throw err;
  }
  if (existsSync(OLD)) rmSync(OLD, { recursive: true, force: true });
  console.log("[rebuild] OK (rename fallback)");
}

// Runner de jobs single-flight (rebuild SSG / import WP). Um job por vez (lock em memória).
// rebuild = export(store->posts.json) + astro build + pagefind. Gatilho do SSG incremental (D006).
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export interface JobState {
  name: string;
  startedAt: string;
  finishedAt?: string;
  ok?: boolean;
  code?: number | null;
  logTail?: string;
}

let current: JobState | null = null;
// Coalescing: se chega pedido de rebuild enquanto há job em curso, marca p/ rodar UM rebuild
// ao terminar (trailing run). Garante que a última publicação sempre entra no SSG (corrige
// "rebuild concorrente perdido": a mutação foi gravada antes, mas o rebuild em curso já exportou).
let rerunRebuildPending = false;

export const jobState = (): JobState | null => current;
export const jobBusy = (): boolean => Boolean(current && !current.finishedAt);

export interface StartResult {
  started: boolean;
  busy?: boolean;
  queued?: boolean;
  job?: JobState;
}

function spawnJob(name: string, script: string): StartResult {
  current = { name, startedAt: new Date().toISOString() };
  const child = spawn("pnpm", ["run", script], { cwd: APP_ROOT, shell: true });
  let log = "";
  const append = (d: Buffer) => {
    log += d.toString();
    if (log.length > 8000) log = log.slice(-8000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  const finish = (ok: boolean, code: number | null, tail: string) => {
    current = { name, startedAt: current!.startedAt, finishedAt: new Date().toISOString(), ok, code, logTail: tail };
    // trailing rebuild se houve pedido durante a execução
    if (rerunRebuildPending) { rerunRebuildPending = false; spawnJob("rebuild", "rebuild"); }
  };
  child.on("close", (code) => finish(code === 0, code, log.slice(-2000)));
  child.on("error", (err) => finish(false, null, String(err)));
  return { started: true, job: current };
}

/** Dispara um script pnpm do apps/site (ex.: "rebuild", "import"). Não bloqueia a request.
 *  Single-flight; um rebuild pedido durante outro job fica pendente (coalesced) e roda ao final. */
export function runJob(name: string, script: string): StartResult {
  if (jobBusy()) {
    if (name === "rebuild") rerunRebuildPending = true;
    return { started: false, busy: true, queued: name === "rebuild", job: current ?? undefined };
  }
  return spawnJob(name, script);
}

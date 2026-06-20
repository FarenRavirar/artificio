// Runner de jobs single-flight (rebuild SSG). Um job por vez (lock em memória).
// rebuild = astro build. Gatilho pós-moderação (D006 do site, adaptado p/ links).
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
let rerunPending = false;

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
    if (rerunPending) {
      rerunPending = false;
      spawnJob("rebuild", "rebuild");
    }
  };
  child.on("close", (code) => finish(code === 0, code, log.slice(-2000)));
  child.on("error", (err) => finish(false, null, String(err)));
  return { started: true, job: current };
}

/**
 * Dispara um script pnpm do apps/links (ex.: "rebuild"). Não bloqueia a request.
 * Single-flight; um rebuild pedido durante outro job fica pendente (coalesced) e roda ao final.
 */
export function runJob(name: string, script: string): StartResult {
  if (jobBusy()) {
    if (name === "rebuild") rerunPending = true;
    return { started: false, busy: true, queued: name === "rebuild", job: current ?? undefined };
  }
  return spawnJob(name, script);
}

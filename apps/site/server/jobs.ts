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

export const jobState = (): JobState | null => current;
export const jobBusy = (): boolean => Boolean(current && !current.finishedAt);

export interface StartResult {
  started: boolean;
  busy?: boolean;
  job?: JobState;
}

/** Dispara um script pnpm do apps/site (ex.: "rebuild", "import"). Não bloqueia a request. */
export function runJob(name: string, script: string): StartResult {
  if (jobBusy()) return { started: false, busy: true, job: current ?? undefined };
  current = { name, startedAt: new Date().toISOString() };
  const child = spawn("pnpm", ["run", script], { cwd: APP_ROOT, shell: true });
  let log = "";
  const append = (d: Buffer) => {
    log += d.toString();
    if (log.length > 8000) log = log.slice(-8000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("close", (code) => {
    current = {
      name,
      startedAt: current!.startedAt,
      finishedAt: new Date().toISOString(),
      ok: code === 0,
      code,
      logTail: log.slice(-2000),
    };
  });
  child.on("error", (err) => {
    current = { name, startedAt: current!.startedAt, finishedAt: new Date().toISOString(), ok: false, code: null, logTail: String(err) };
  });
  return { started: true, job: current };
}

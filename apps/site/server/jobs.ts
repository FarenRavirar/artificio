// Runner de jobs single-flight (rebuild SSG). Um job por vez (lock em memória).
// rebuild = export(store->posts.json) + astro build + pagefind + purga da borda.
// Gatilho do SSG incremental (D006).
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { purgeCache, type PurgeResult } from "./purge-cache.js";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Fases que o rebuild atravessa, na ordem em que o script as imprime. */
export type JobPhase = "iniciando" | "exportando" | "build" | "busca" | "publicando" | "purgando" | "concluido";

export interface JobState {
  name: string;
  startedAt: string;
  finishedAt?: string;
  ok?: boolean;
  code?: number | null;
  logTail?: string;
  /** Onde o job está agora. O editor mostra isto enquanto espera. */
  phase?: JobPhase;
  /** Resultado da purga da borda. `ok: false` significa: site novo no disco, borda ainda velha. */
  purge?: PurgeResult;
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

// O `rebuild.mjs` já imprime cada etapa; mapear a linha dele para uma fase evita inventar
// um protocolo de progresso paralelo que sairia de sincronia com o script na primeira edição.
const MARCADORES: ReadonlyArray<{ re: RegExp; phase: JobPhase }> = [
  { re: /\[rebuild\] export store/, phase: "exportando" },
  { re: /\[rebuild\] astro build/, phase: "build" },
  { re: /\[rebuild\] pagefind/, phase: "busca" },
  { re: /\[rebuild\] swap/, phase: "publicando" },
];

function spawnJob(name: string, script: string): StartResult {
  current = { name, startedAt: new Date().toISOString(), phase: "iniciando" };
  const child = spawn("pnpm", ["run", script], { cwd: APP_ROOT, shell: true });
  let log = "";
  const append = (d: Buffer) => {
    const txt = d.toString();
    log += txt;
    if (log.length > 8000) log = log.slice(-8000);
    if (current && !current.finishedAt) {
      for (const m of MARCADORES) if (m.re.test(txt)) current.phase = m.phase;
    }
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  const finish = async (ok: boolean, code: number | null, tail: string) => {
    const base: JobState = {
      name,
      startedAt: current!.startedAt,
      finishedAt: new Date().toISOString(),
      ok,
      code,
      logTail: tail,
      phase: "concluido",
    };

    // Purga só faz sentido depois de um rebuild que deu certo: com o build quebrado, o
    // disco ainda tem o SSG anterior e derrubar a borda serviria a mesma coisa de novo,
    // só que pagando origem. Rebuild bom sem purga é meio deploy (ver purge-cache.ts).
    if (ok && name === "rebuild") {
      current = { ...base, phase: "purgando", finishedAt: undefined };
      const purge = await purgeCache();
      current = { ...base, purge };
    } else {
      current = base;
    }

    if (rerunRebuildPending) { rerunRebuildPending = false; spawnJob("rebuild", "rebuild"); }
  };

  child.on("close", (code) => { void finish(code === 0, code, log.slice(-2000)); });
  child.on("error", (err) => { void finish(false, null, String(err)); });
  return { started: true, job: current };
}

/** Dispara um script pnpm do apps/site (hoje só "rebuild"). Não bloqueia a request.
 *  Single-flight; um rebuild pedido durante outro job fica pendente (coalesced) e roda ao final. */
export function runJob(name: string, script: string): StartResult {
  if (jobBusy()) {
    if (name === "rebuild") rerunRebuildPending = true;
    return { started: false, busy: true, queued: name === "rebuild", job: current ?? undefined };
  }
  return spawnJob(name, script);
}

// CLI da reidratação de logos (spec 038 T4). Invocável no container prod:
//   tsx server/rehydrate-cli.ts          → reidrata só faltantes/trocadas
//   tsx server/rehydrate-cli.ts --force  → força reidratação de todos
// Requer DATABASE_URL + CLOUDINARY_* no ambiente.
import "dotenv/config";
import { rehydrateLogos } from "./lib/rehydrate-logos.js";

const force = process.argv.includes("--force");

console.log(`[rehydrate-cli] iniciando${force ? " (force)" : ""}...`);
const t0 = Date.now();
const result = await rehydrateLogos({ force });
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`[rehydrate-cli] concluído em ${elapsed}s.`);
console.log(JSON.stringify(result));

// Falha parcial (alguns grupos ok, outros falharam) também deve alertar o cron.
// Exit code 1 para qualquer falha — crontab captura e notifica o operador.
if (result.failed > 0) {
  process.exitCode = 1;
}

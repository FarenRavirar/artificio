import { createDb } from "./db.js";
import { loadAccountsEnv } from "./env.js";
import { createApp } from "./app.js";
import { ensureBootstrapAdmin } from "./globalRoles.js";
import { shutdownWithError } from "./shutdown.js";
import { processOutboxPending } from "./notificationOutbox.js";

// T3.15 (achado CodeRabbit, PR #255): o único gatilho do fan-out de
// notificação era o pós-commit de createComment. Sweep periódico cobre o
// caso em que esse gatilho falha e a entrada fica presa até o próximo
// comentário — sem isso, `notification_outbox` pode acumular pendências
// indefinidamente em módulo de baixo tráfego.
const OUTBOX_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const env = loadAccountsEnv();
const db = createDb(env.DATABASE_URL);

const fail = (reason: string, error: unknown) =>
  shutdownWithError(reason, error, { destroy: () => db.destroy() });

try {
  const app = createApp(env, db);
  const bootstrapStatus = await ensureBootstrapAdmin(db, env.ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL);
  if (bootstrapStatus === "missing_account") {
    console.warn("accounts bootstrap admin pending: account will be promoted on first login");
  }
  const server = app.listen(env.PORT, () => {
    console.log(`accounts listening on ${env.PORT}`);
  });
  // Bind falho emite 'error' no servidor, fora do try acima — sem este handler
  // o processo seguiria vivo sem servir (motivo completo em `shutdown.ts`).
  server.on("error", (error: unknown) => {
    void fail("accounts failed to bind port", error);
  });

  const outboxSweep = setInterval(() => {
    processOutboxPending(db).catch((error) => {
      console.warn("[notificationOutbox] falha no sweep periódico:", error);
    });
  }, OUTBOX_SWEEP_INTERVAL_MS);
  outboxSweep.unref();
} catch (error: unknown) {
  await fail("accounts failed to start", error);
}

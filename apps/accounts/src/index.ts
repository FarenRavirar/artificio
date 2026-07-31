import { createDb } from "./db.js";
import { loadAccountsEnv } from "./env.js";
import { createApp } from "./app.js";
import { ensureBootstrapAdmin } from "./globalRoles.js";
import { shutdownWithError } from "./shutdown.js";

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
} catch (error: unknown) {
  await fail("accounts failed to start", error);
}

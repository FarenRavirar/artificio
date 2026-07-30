import { createDb } from "./db.js";
import { loadAccountsEnv } from "./env.js";
import { createApp } from "./app.js";
import { ensureBootstrapAdmin } from "./globalRoles.js";

const env = loadAccountsEnv();
const db = createDb(env.DATABASE_URL);
const app = createApp(env, db);

async function start(): Promise<void> {
  const bootstrapStatus = await ensureBootstrapAdmin(db, env.ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL);
  if (bootstrapStatus === "missing_account") {
    console.warn("accounts bootstrap admin pending: account will be promoted on first login");
  }
  app.listen(env.PORT, () => {
    console.log(`accounts listening on ${env.PORT}`);
  });
}

void start().catch(async (error: unknown) => {
  console.error("accounts failed to start", error instanceof Error ? error.message : "unknown_error");
  try {
    await db.destroy();
  } catch (destroyError) {
    console.error(
      "accounts failed to close database pool",
      destroyError instanceof Error ? destroyError.message : "unknown_error",
    );
  }
  process.exitCode = 1;
});

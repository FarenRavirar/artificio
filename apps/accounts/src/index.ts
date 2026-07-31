import { createDb } from "./db.js";
import { loadAccountsEnv } from "./env.js";
import { createApp } from "./app.js";
import { ensureBootstrapAdmin } from "./globalRoles.js";

const env = loadAccountsEnv();
const db = createDb(env.DATABASE_URL);

// `app.listen` é assíncrono: falha de bind (EADDRINUSE) emite 'error' no
// servidor em vez de lançar dentro do try, então o catch abaixo nunca dispara
// sozinho. Sem este caminho o processo ficava vivo, sem servir e com o pool
// aberto — container saudável para o orquestrador enquanto o SSO está morto,
// mesma classe de falso-verde do E018 (achado de review, PR #233).
async function shutdownWithError(reason: string, error: unknown): Promise<void> {
  console.error(reason, error instanceof Error ? error.message : "unknown_error");
  try {
    await db.destroy();
  } catch (destroyError) {
    console.error(
      "accounts failed to close database pool",
      destroyError instanceof Error ? destroyError.message : "unknown_error",
    );
  }
  process.exitCode = 1;
}

try {
  const app = createApp(env, db);
  const bootstrapStatus = await ensureBootstrapAdmin(db, env.ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL);
  if (bootstrapStatus === "missing_account") {
    console.warn("accounts bootstrap admin pending: account will be promoted on first login");
  }
  const server = app.listen(env.PORT, () => {
    console.log(`accounts listening on ${env.PORT}`);
  });
  server.on("error", (error: unknown) => {
    void shutdownWithError("accounts failed to bind port", error);
  });
} catch (error: unknown) {
  await shutdownWithError("accounts failed to start", error);
}

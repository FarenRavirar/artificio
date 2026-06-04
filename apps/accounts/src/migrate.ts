import { createDb, migrate } from "./db.js";
import { loadAccountsEnv } from "./env.js";

const env = loadAccountsEnv();
const db = createDb(env.DATABASE_URL);

try {
  await migrate(db);
  console.log("accounts migration OK");
} finally {
  await db.destroy();
}

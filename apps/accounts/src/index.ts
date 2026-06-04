import { createDb } from "./db.js";
import { loadAccountsEnv } from "./env.js";
import { createApp } from "./app.js";

const env = loadAccountsEnv();
const db = createDb(env.DATABASE_URL);
const app = createApp(env, db);

app.listen(env.PORT, () => {
  console.log(`accounts listening on ${env.PORT}`);
});

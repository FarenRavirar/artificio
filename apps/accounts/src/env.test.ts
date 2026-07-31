import { describe, expect, it } from "vitest";
import { accountsEnvSchema } from "./env.js";

// `docker-compose.prod.yml:59` injeta `${ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL:-}`, que
// chega como string vazia quando a variável não está no `.env` da VM. Como
// `loadAccountsEnv()` roda no topo de `index.ts`, antes do try/catch, um schema
// que rejeitasse `""` derrubaria o SSO em crash loop no primeiro deploy sem a
// variável — sem passar pelo shutdown que fecha o pool (achado de review, PR #233).
describe("ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL", () => {
  const base = {
    // Mesmo fixture de `app.test.ts:11` e `internalUsers.test.ts:11`: host
    // localhost e senha óbvia. `secret@accounts-db` casava com a heurística do
    // TruffleHog (senha não-óbvia + host de infraestrutura) e falhava o gate de
    // segredos no CI, mesmo sendo valor inventado.
    DATABASE_URL: "postgres://admin:admin@localhost:5432/artificio_auth",
    GOOGLE_CALLBACK_URL: "https://accounts.artificiorpg.com/api/auth/google/callback",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    JWT_REFRESH_SECRET: "r".repeat(32),
    JWT_SECRET: "s".repeat(32),
  };

  it("aceita string vazia do compose como ausência", () => {
    const parsed = accountsEnvSchema.safeParse({ ...base, ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL: "" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
  });

  it("aceita string só de espaços como ausência", () => {
    const parsed = accountsEnvSchema.safeParse({ ...base, ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL: "   " });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
  });

  it("preserva e-mail válido", () => {
    const parsed = accountsEnvSchema.safeParse({
      ...base,
      ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL).toBe("admin@example.com");
  });

  it("continua recusando e-mail malformado", () => {
    const parsed = accountsEnvSchema.safeParse({
      ...base,
      ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL: "nao-e-email",
    });
    expect(parsed.success).toBe(false);
  });
});

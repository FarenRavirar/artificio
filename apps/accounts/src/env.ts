import { parseEnv, BRAND_DOMAIN } from "@artificio/config";
import { z } from "zod";

export const accountsEnvSchema = z.object({
  // `docker-compose.prod.yml:59` injeta `${ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL:-}`,
  // que vira string vazia quando a variável não está no `.env` — e `z.email()`
  // rejeita `""`. Como `loadAccountsEnv()` roda no topo do módulo, antes do
  // try/catch de `index.ts`, isso derrubaria o SSO em crash loop no primeiro
  // deploy sem a variável (achado de review, PR #233).
  ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
  ACCOUNTS_SECRETS_KEY: z.string().min(32).optional(),
  COOKIE_DOMAIN: z.string().default(`.${BRAND_DOMAIN}`),
  DATABASE_URL: z.url(),
  GOOGLE_CALLBACK_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.url().default("https://accounts.artificiorpg.com"),
  SERVICE_SECRET: z.string().min(16).optional(),
  TRUSTED_PROXY_CIDR: z.string().default("172.18.0.0/16"),
});

export type AccountsEnv = z.infer<typeof accountsEnvSchema>;

export function loadAccountsEnv(env = process.env): AccountsEnv {
  return parseEnv(accountsEnvSchema, env);
}

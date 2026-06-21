import { parseEnv, BRAND_DOMAIN } from "@artificio/config";
import { z } from "zod";

export const accountsEnvSchema = z.object({
  COOKIE_DOMAIN: z.string().default(`.${BRAND_DOMAIN}`),
  DATABASE_URL: z.url(),
  GOOGLE_CALLBACK_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.url().default("https://accounts.artificiorpg.com"),
  TRUSTED_PROXY_CIDR: z.string().default("172.18.0.0/16"),
});

export type AccountsEnv = z.infer<typeof accountsEnvSchema>;

export function loadAccountsEnv(env = process.env): AccountsEnv {
  return parseEnv(accountsEnvSchema, env);
}

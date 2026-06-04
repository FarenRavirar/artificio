import { parseEnv } from "@artificio/config";
import { z } from "zod";

export const accountsEnvSchema = z.object({
  COOKIE_DOMAIN: z.string().default(".artificiorpg.com"),
  DATABASE_URL: z.string().url(),
  GOOGLE_CALLBACK_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.string().url().default("https://accounts.artificiorpg.com"),
});

export type AccountsEnv = z.infer<typeof accountsEnvSchema>;

export function loadAccountsEnv(env = process.env): AccountsEnv {
  return parseEnv(accountsEnvSchema, env);
}

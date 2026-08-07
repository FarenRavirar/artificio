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
  /**
   * T2.3 (spec 090) — chave de assinatura do cursor de leitura em árvore.
   *
   * `spec.md` 8d-i: chave **dedicada**, não reaproveitando `JWT_SECRET`. É o
   * precedente REV-023 (spec 048), que criou `ACCOUNTS_SECRETS_KEY` pelo mesmo
   * motivo: um segredo por finalidade faz a rotação de um não inutilizar o
   * outro. Rotacionar o JWT aqui invalidaria todo cursor em voo; rotacionar o
   * cursor não deve derrubar sessão nenhuma.
   *
   * Obrigatória, `min(32)` como as demais. O compose usa `:?`, então a variável
   * precisa existir no `.env` da VM **antes** do deploy — mesma armadilha que a
   * T2.2a-op tratou em 2026-08-07.
   */
  ACCOUNTS_COMMENT_CURSOR_KEY: z.string().min(32),
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
  TRUSTED_PROXY_CIDR: z.string().default("172.18.0.0/16"),
}).superRefine((env, ctx) => {
  // `spec.md` 8d-i exige chave **dedicada**, não derivada do `JWT_SECRET` —
  // é o ponto inteiro do precedente REV-023. O `min(32)` sozinho não impede
  // colar o mesmo valor nos dois campos, e nesse caso a separação existiria só
  // no papel: rotacionar o JWT invalidaria todo cursor em voo, e um vazamento
  // de qualquer um dos dois comprometeria as duas finalidades.
  //
  // Falha no boot, não em runtime: com `:?` no compose a variável já é
  // pré-condição de subida, então o operador descobre na hora do deploy, não
  // quando um cursor forjado aparecer (achado de review, PR #245).
  if (env.ACCOUNTS_COMMENT_CURSOR_KEY === env.JWT_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["ACCOUNTS_COMMENT_CURSOR_KEY"],
      message:
        "ACCOUNTS_COMMENT_CURSOR_KEY não pode ser igual ao JWT_SECRET: a chave do cursor é dedicada (spec 090, 8d-i / REV-023)",
    });
  }
});

export type AccountsEnv = z.infer<typeof accountsEnvSchema>;

export function loadAccountsEnv(env = process.env): AccountsEnv {
  return parseEnv(accountsEnvSchema, env);
}

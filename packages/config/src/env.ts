import type { z } from "zod";

export function parseEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  env: Record<string, unknown> = process.env,
): z.infer<TSchema> {
  return schema.parse(env);
}

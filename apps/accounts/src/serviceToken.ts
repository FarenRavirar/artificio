import { timingSafeEqual } from "node:crypto";

/**
 * Comparação em tempo constante mesmo com tamanhos diferentes — `timingSafeEqual`
 * exige buffers do mesmo comprimento, e sair cedo pelo `length` vazaria por
 * timing quanto do token bate.
 *
 * Vive em módulo próprio porque o mesmo `SERVICE_SECRET` autentica dois pontos
 * do `accounts.`: a rota interna de usuários (`app.ts`) e as rotas de segredo
 * (`adminSecretsRoutes.ts`). Enquanto a função era local do `app.ts`, o segundo
 * comparava com `===` — mesma credencial protegida de duas formas, e a versão
 * fraca guardava a chave de cifra dos segredos.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Autentica `X-Service-Token` contra `SERVICE_SECRET`. Devolve `false` quando o
 * segredo não está configurado — ausência de credencial nunca autoriza.
 */
export function isValidServiceToken(
  serviceSecret: string | undefined | null,
  token: unknown,
): boolean {
  if (!serviceSecret || typeof token !== "string" || token === "") return false;
  return timingSafeEqualStrings(token, serviceSecret);
}

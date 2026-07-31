import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compara dois segredos em tempo constante, sem ramificar por comprimento.
 *
 * `timingSafeEqual` exige buffers do mesmo tamanho, então comparar strings de
 * comprimento livre exige normalizar antes. A versão anterior tratava o caso
 * desigual num ramo próprio (com uma comparação descartável para não sair
 * cedo); o ramo continuava observável, e o custo daquela comparação variava com
 * o tamanho do valor recebido (achado de review, PR #234).
 *
 * SHA-256 resolve por construção: todo par vira 32 bytes, existe **um** caminho
 * de execução, e nenhum comprimento chega ao comparador. O digest aqui não é
 * proteção de armazenamento — é normalização de tamanho —, então SHA-256 puro
 * basta e KDF seria custo sem ganho.
 *
 * Vive em módulo próprio porque o mesmo `SERVICE_SECRET` autentica dois pontos
 * do `accounts.`: a rota interna de usuários (`app.ts`) e as rotas de segredo
 * (`adminSecretsRoutes.ts`). Enquanto a função era local do `app.ts`, o segundo
 * comparava com `===` — mesma credencial protegida de duas formas, e a versão
 * fraca guardava a chave de cifra dos segredos.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
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

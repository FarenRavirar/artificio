import type { Transaction } from "kysely";
import type { Database } from "./db.js";

/**
 * Resolução do ator comunitário (`spec.md` 7a; decisão 53).
 *
 * ## Por que isto virou módulo
 *
 * As três funções abaixo estavam copiadas em cinco handlers — escrita, ciclo de
 * vida, voto, denúncia, caso e recurso. São curtas, mas carregam duas armadilhas
 * que só falham em produção (`defaultValues()` e o `LEFT JOIN` implícito de
 * conta excluída), e cada cópia era uma chance de perder o comentário que as
 * explica. Sonar mediu a duplicação; o risco real é a correção que chega a
 * quatro arquivos e esquece o quinto.
 *
 * ## Duas funções, não uma com flag
 *
 * `resolveActorId` **não cria**; `resolveOrCreateActor` cria. A diferença é
 * decisão de produto, não conveniência: criar o ator grava identidade
 * comunitária permanente, e há fluxos que precisam recusar o pedido **antes**
 * disso — votar em comentário legado, denunciar o próprio comentário. Uma
 * função única com `create: boolean` deixaria a escolha invisível na chamada, e
 * inverter o argumento por engano passaria no `tsc`.
 */

/** Ator do usuário, ou `null` se ele ainda não participou da comunidade. */
export async function resolveActorId(
  trx: Transaction<Database>,
  userId: string,
): Promise<string | null> {
  const row = await trx
    .selectFrom("community_actor_account_link")
    .select("actor_id")
    .where("user_id", "=", userId)
    .executeTakeFirst();

  return row?.actor_id ?? null;
}

/**
 * Cria ator e vínculo. **Não** consulta antes — quem chama já sabe que não há.
 *
 * Existe separada de `resolveOrCreateActor` porque a consulta a mais não é
 * grátis nem invisível: o voto e a denúncia já resolveram o ator no começo da
 * transação (precisam dele para as recusas) e criam só depois de passar por
 * elas. Reler ali seria uma ida ao banco redundante dentro de uma transação que
 * já segura lock, e apareceria como query extra no SQL compilado — que é
 * exatamente como este defeito foi pego ao extrair este módulo.
 */
export async function createActor(
  trx: Transaction<Database>,
  userId: string,
): Promise<string> {
  // `defaultValues()`, não `values({})`. A tabela só tem colunas com default
  // (`id` e `created_at`), e o objeto vazio compila para
  // `INSERT INTO community_actor () VALUES ()` — sintaxe que o PostgreSQL
  // recusa com `syntax error at or near ")"`. O tipo do Kysely aceita `{}`, e o
  // erro só aparece no banco: os testes de rota param antes da transação, e o
  // script de medição escreve o ator por SQL direto, então nenhum dos dois
  // exercitava esta linha. Achado no primeiro smoke real (2026-08-08).
  const actor = await trx
    .insertInto("community_actor")
    .defaultValues()
    .returning("id")
    .executeTakeFirstOrThrow();

  await trx
    .insertInto("community_actor_account_link")
    .values({ actor_id: actor.id, user_id: userId })
    .execute();

  return actor.id;
}

/**
 * Ator do usuário, criado sob demanda.
 *
 * O ator é opaco e separado da conta (`spec.md` 7a): é ele que sobrevive à
 * exclusão da conta preservando conversa e score. Quem participa pela primeira
 * vez ainda não tem ator — criá-lo aqui, dentro da transação, evita um estado em
 * que o comentário existe sem autor resolvível.
 *
 * Use esta quando o ator ainda não foi resolvido; use `createActor` quando o
 * chamador já sabe que não existe.
 */
export async function resolveOrCreateActor(
  trx: Transaction<Database>,
  userId: string,
): Promise<string> {
  const existing = await resolveActorId(trx, userId);
  if (existing !== null) return existing;

  return await createActor(trx, userId);
}

/**
 * Conta viva ligada ao ator, ou `null` quando não há.
 *
 * Duas consultas e não um `JOIN`: o vínculo pode existir apontando para uma
 * conta já removida se o `CASCADE` da exclusão ainda não rodou. Confirmar em
 * `users` evita violar `notification_receipt_user_fk` e abortar a transação
 * inteira por causa de um destinatário — o mesmo cuidado de
 * `findIneligibleRecipients` na criação de comentário.
 *
 * `null` é o comportamento correto, não tolerância: conta excluída perde o
 * vínculo por `ON DELETE CASCADE` (decisão 53) e o ator permanece. Quem saiu
 * não recebe notificação, e não há `user_id` para endereçar.
 */
export async function resolveUserIdOfActor(
  trx: Transaction<Database>,
  actorId: string,
): Promise<string | null> {
  const link = await trx
    .selectFrom("community_actor_account_link")
    .select("user_id")
    .where("actor_id", "=", actorId)
    .executeTakeFirst();

  if (!link) return null;

  const user = await trx
    .selectFrom("users")
    .select("id")
    .where("id", "=", link.user_id)
    .executeTakeFirst();

  return user?.id ?? null;
}

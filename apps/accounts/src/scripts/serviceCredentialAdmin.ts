/**
 * T2.2a — emissão, listagem e revogação de credencial de serviço.
 *
 * Uso (dentro do container do `accounts.`, com `DATABASE_URL` no ambiente):
 *
 *   node dist/scripts/serviceCredentialAdmin.js issue \
 *     --source-app downloads --realm prod --scopes users.read \
 *     --description "resolve e-mail de autor (spec 083)"
 *
 *   node dist/scripts/serviceCredentialAdmin.js list
 *   node dist/scripts/serviceCredentialAdmin.js revoke --token-id <id> --reason "rotação"
 *
 * O segredo em claro é impresso **uma única vez**, na emissão, e nunca fica
 * recuperável: o banco guarda só o hash Argon2id. Perder o valor exige emitir
 * uma credencial nova — que é o comportamento correto para credencial.
 *
 * ## Rotação sem downtime
 *
 * `spec.md` §"Trust boundary e credenciais" define a janela curta `current` +
 * `next`. A ordem importa, e inverter derruba o consumidor:
 *
 *   1. `issue --slot next` (a `current` segue ativa e atendendo)
 *   2. publicar o novo valor em `SERVICE_CREDENTIAL` do consumidor e reiniciar
 *   3. confirmar tráfego pela nova credencial (`list` mostra `último uso`)
 *   4. `revoke --token-id <current> --reason "rotação AAAA-MM-DD"`
 *   5. na próxima rotação, o papel se inverte — quem era `next` vira a de uso
 *
 * Revogar antes do passo 3 é o erro que causa indisponibilidade.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createDb } from "../db.js";
import { hashServiceSecret, SERVICE_SCOPES, type ServiceScope } from "../serviceCredential.js";

const REALMS = ["beta", "prod"] as const;
type Realm = (typeof REALMS)[number];

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current?.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, next);
    i += 1;
  }
  return args;
}

function fail(message: string): never {
  console.error(`erro: ${message}`);
  process.exit(1);
}

/**
 * 32 bytes de `randomBytes` em base64url. Não é derivado de nome, data ou
 * contador: credencial previsível é credencial adivinhada.
 */
function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * `token_id` legível e único, no formato `<source_app>-<realm>-<sufixo>`. O
 * sufixo aleatório evita colisão quando uma credencial é revogada e outra é
 * emitida para o mesmo par — a linha revogada permanece, então o `UNIQUE` de
 * `token_id` continua valendo sobre o histórico inteiro.
 */
function generateTokenId(sourceApp: string, realm: string): string {
  return `${sourceApp}-${realm}-${randomBytes(4).toString("hex")}`;
}

async function issue(db: ReturnType<typeof createDb>, args: Map<string, string>): Promise<void> {
  const sourceApp = args.get("source-app");
  const realm = args.get("realm");
  const scopesRaw = args.get("scopes");
  const description = args.get("description") ?? "";
  const createdBy = args.get("created-by") ?? "manual";
  // Janela de rotação: emitir `next` enquanto `current` segue em uso, trocar o
  // consumidor, confirmar tráfego, revogar `current`.
  const rotationSlot = args.get("slot") ?? "current";

  if (!sourceApp) fail("--source-app obrigatório");
  // Espelha o CHECK da migration. Validar aqui troca um erro cru de constraint
  // do Postgres por uma mensagem que diz ao operador o que corrigir.
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(sourceApp)) {
    fail(`--source-app inválido: ${sourceApp} (minúsculas, 2–32 chars, começando por letra)`);
  }
  if (!realm) fail("--realm obrigatório (beta|prod)");
  if (!REALMS.includes(realm as Realm)) fail(`--realm inválido: ${realm}`);
  if (rotationSlot !== "current" && rotationSlot !== "next") {
    fail(`--slot inválido: ${rotationSlot} (current|next)`);
  }
  if (!scopesRaw) fail(`--scopes obrigatório (${SERVICE_SCOPES.join(",")})`);

  const scopes = scopesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const scope of scopes) {
    if (!SERVICE_SCOPES.includes(scope as ServiceScope)) fail(`escopo inválido: ${scope}`);
  }
  if (scopes.length === 0) fail("--scopes vazio");

  // Uma credencial ativa por (source_app, realm, slot) — o índice parcial no
  // banco é a autoridade, mas avisar aqui evita erro cru de constraint na cara do
  // operador.
  const existing = await db
    .selectFrom("community_service_credential")
    .select(["token_id", "rotation_slot", "realms"])
    .where("source_app", "=", sourceApp)
    .where("revoked_at", "is", null)
    .execute();

  // Filtra por realm **e** slot: o índice único é
  // `(source_app, realms[1], rotation_slot)`, então uma credencial de `beta` não
  // conflita com a emissão de `prod`. Sem o filtro de realm, emitir a segunda
  // credencial legítima de um app disparava um aviso de conflito que não existe,
  // e a orientação de rotação mandava revogar a credencial errada.
  const sameSlot = existing.filter(
    (r) => r.rotation_slot === rotationSlot && Array.isArray(r.realms) && r.realms[0] === realm,
  );
  if (sameSlot.length > 0) {
    console.warn(
      `aviso: já existe credencial ativa de ${sourceApp} no slot '${rotationSlot}' (${sameSlot.map((r) => r.token_id).join(", ")}).`,
    );
    console.warn(
      `revogue-a antes, ou emita no outro slot (--slot ${rotationSlot === "current" ? "next" : "current"}) para rotacionar sem downtime.`,
    );
  }

  const secret = generateSecret();
  const tokenId = generateTokenId(sourceApp, realm);
  const tokenHash = await hashServiceSecret(secret);

  await db
    .insertInto("community_service_credential")
    .values({
      id: randomUUID(),
      token_id: tokenId,
      token_hash: tokenHash,
      source_app: sourceApp,
      realms: [realm],
      scopes,
      rotation_slot: rotationSlot,
      description,
      created_by: createdBy,
    })
    .execute();

  // Única impressão do segredo em todo o ciclo de vida. Vai para stdout separado
  // dos avisos (stderr) para permitir captura sem ruído.
  console.log("credencial emitida. guarde o valor abaixo — ele não é recuperável:");
  console.log("");
  console.log(`X-Service-Token: ${tokenId}.${secret}`);
  console.log("");
  console.log(
    `source_app=${sourceApp} realm=${realm} slot=${rotationSlot} scopes=${scopes.join(",")}`,
  );
}

async function list(db: ReturnType<typeof createDb>): Promise<void> {
  const rows = await db
    .selectFrom("community_service_credential")
    .select([
      "token_id",
      "source_app",
      "realms",
      "scopes",
      "rotation_slot",
      "created_at",
      "last_used_at",
      "revoked_at",
      "description",
    ])
    .orderBy("source_app")
    .orderBy("created_at", "desc")
    .execute();

  if (rows.length === 0) {
    console.log("nenhuma credencial registrada.");
    return;
  }

  for (const row of rows) {
    const status = row.revoked_at ? `revogada em ${row.revoked_at.toISOString()}` : "ativa";
    const lastUsed = row.last_used_at ? row.last_used_at.toISOString() : "nunca";
    // Dado do banco é `unknown` até ser normalizado, e aqui a normalização é
    // **por linha**: `row.realms.join()` cru lança `TypeError` numa linha
    // corrompida, o erro sobe até o `catch` do `main` e o comando morre imprimindo
    // só "Cannot read properties of null". O operador perde a lista inteira a
    // partir dali e não descobre qual credencial quebrou.
    //
    // Isso importa justamente em T2.2a-op: `list` é o que prova quais credenciais
    // estão em uso antes de revogar a antiga. E há assimetria com
    // `resolveServiceCredential`, que **rejeita** linha fora do invariante — sem
    // este tratamento, a credencial quebrada não autentica e também não aparece,
    // ficando invisível para quem opera.
    const realms = formatArrayColumn(row.realms);
    const scopes = formatArrayColumn(row.scopes);
    console.log(
      `${row.token_id}  ${row.source_app}/${realms}  slot=${row.rotation_slot}  [${scopes}]  ${status}  último uso: ${lastUsed}  ${row.description}`,
    );
  }
}

/**
 * Formata coluna de array vinda do banco, sinalizando corrupção em vez de
 * lançar. `<INVÁLIDO: ...>` é deliberadamente ruidoso: uma linha nesse estado
 * não autentica (`resolveServiceCredential` a rejeita) e precisa ser vista pelo
 * operador, não escondida atrás de um valor vazio plausível.
 */
function formatArrayColumn(value: unknown): string {
  if (!Array.isArray(value)) return `<INVÁLIDO: ${value === null ? "null" : typeof value}>`;
  if (value.length === 0) return "<VAZIO>";
  return value.map((item) => (typeof item === "string" ? item : `<INVÁLIDO:${typeof item}>`)).join(",");
}

async function revoke(db: ReturnType<typeof createDb>, args: Map<string, string>): Promise<void> {
  const tokenId = args.get("token-id");
  const reason = args.get("reason");

  if (!tokenId) fail("--token-id obrigatório");
  if (!reason || reason.trim() === "") fail("--reason obrigatório (CHECK do banco exige motivo)");

  const result = await db
    .updateTable("community_service_credential")
    .set({ revoked_at: new Date(), revoked_reason: reason })
    .where("token_id", "=", tokenId)
    .where("revoked_at", "is", null)
    .executeTakeFirst();

  if (Number(result.numUpdatedRows) === 0) {
    fail(`nenhuma credencial ativa com token_id=${tokenId}`);
  }

  console.log(`credencial ${tokenId} revogada.`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL não configurado");

  const db = createDb(databaseUrl);
  try {
    switch (command) {
      case "issue":
        await issue(db, args);
        break;
      case "list":
        await list(db);
        break;
      case "revoke":
        await revoke(db, args);
        break;
      default:
        console.error("uso: serviceCredentialAdmin.js <issue|list|revoke> [opções]");
        process.exit(1);
    }
  } finally {
    await db.destroy();
  }
}

// Top-level await (o pacote é ESM): a cadeia `.catch()` anterior deixava a
// rejeição fora do fluxo, e um `throw` no próprio handler viraria
// unhandledRejection silencioso.
try {
  await main();
} catch (error: unknown) {
  // Nunca ecoar o erro cru: uma falha de INSERT pode carregar o hash na
  // mensagem do driver, e hash em log é material para ataque offline.
  console.error(`falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`);
  process.exit(1);
}

import { describe, expect, it } from "vitest";
import {
  hasScope,
  hashServiceSecret,
  parseServiceTokenHeader,
  resolveServiceCredential,
  SERVICE_SCOPES,
  type ServiceCredentialIdentity,
} from "./serviceCredential.js";

/**
 * Stub de Kysely com a superfície exata que `resolveServiceCredential` usa.
 * Devolve a linha configurada, ou `undefined` para simular ausência/revogação.
 */
function stubDb(row: Record<string, unknown> | undefined) {
  const builder = {
    select: () => builder,
    where: () => builder,
    executeTakeFirst: async () => row,
  };
  return { selectFrom: () => builder } as never;
}

const SECRET = "segredo-de-teste-com-tamanho-suficiente";

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    token_id: "downloads-prod-abcd1234",
    token_hash: await hashServiceSecret(SECRET),
    source_app: "downloads",
    realms: ["prod"],
    scopes: ["users.read"],
    ...overrides,
  };
}

describe("parseServiceTokenHeader", () => {
  it("separa token_id e segredo", () => {
    expect(parseServiceTokenHeader("app-prod-abcd1234.segredo")).toEqual({
      tokenId: "app-prod-abcd1234",
      secret: "segredo",
    });
  });

  it("preserva pontos dentro do segredo", () => {
    // `split('.')` cru truncaria o segredo aqui e produziria falha de
    // autenticação intermitente, difícil de diagnosticar.
    expect(parseServiceTokenHeader("app-prod-abcd1234.a.b.c")).toEqual({
      tokenId: "app-prod-abcd1234",
      secret: "a.b.c",
    });
  });

  it("recusa header malformado", () => {
    for (const header of [
      "",
      "sem-separador",
      ".comeca-com-ponto",
      "termina-com-ponto.",
      "MAIUSCULA-prod-x.segredo",
      "ab.segredo",
      undefined,
      null,
      42,
      ["a", "b"],
    ]) {
      expect(parseServiceTokenHeader(header), `header ${String(header)}`).toBeNull();
    }
  });
});

describe("resolveServiceCredential", () => {
  it("devolve identidade, nao booleano", async () => {
    // O ponto inteiro de T2.2a: a resposta diz QUEM chamou. Com `boolean` não há
    // de onde derivar `realm`/`source_app`, e a trust boundary vira decorativa.
    const identity = await resolveServiceCredential(
      stubDb(await credentialRow()),
      `downloads-prod-abcd1234.${SECRET}`,
    );

    expect(identity).not.toBeNull();
    expect(identity?.sourceApp).toBe("downloads");
    expect(identity?.realm).toBe("prod");
    expect(identity?.scopes).toEqual(["users.read"]);
  });

  it("recusa segredo errado", async () => {
    const identity = await resolveServiceCredential(
      stubDb(await credentialRow()),
      "downloads-prod-abcd1234.segredo-errado",
    );
    expect(identity).toBeNull();
  });

  it("recusa credencial inexistente ou revogada", async () => {
    // A query filtra `revoked_at IS NULL`, então revogada chega como `undefined`
    // — indistinguível de inexistente, que é o comportamento desejado.
    expect(await resolveServiceCredential(stubDb(undefined), `x-prod-abcd1234.${SECRET}`)).toBeNull();
  });

  it("recusa token_id divergente do consultado", async () => {
    // Defesa em profundidade: se a query um dia deixar de filtrar por igualdade
    // exata, a comparação em tempo constante ainda barra.
    const identity = await resolveServiceCredential(
      stubDb(await credentialRow({ token_id: "outro-prod-abcd1234" })),
      `downloads-prod-abcd1234.${SECRET}`,
    );
    expect(identity).toBeNull();
  });

  it("falha fechado quando realms nao tem exatamente um realm valido", async () => {
    // O CHECK do banco garante um realm, mas o dado que volta é `unknown` até ser
    // normalizado. Linha fora do invariante não pode produzir realm arbitrário.
    // `['prod', 42]` é o caso que a versão com `.filter()` deixava passar: o
    // elemento inválido sumia e a linha virava "realm único" válida.
    for (const realms of [[], ["beta", "prod"], "prod", null, ["staging"], ["prod", 42], [42], [null]]) {
      const identity = await resolveServiceCredential(
        stubDb(await credentialRow({ realms })),
        `downloads-prod-abcd1234.${SECRET}`,
      );
      expect(identity, `realms=${JSON.stringify(realms)}`).toBeNull();
    }
  });

  it("falha fechado com escopo desconhecido, duplicado ou de tipo errado", async () => {
    // Escopo que o código não reconhece está fora do contrato; tratá-lo como "os
    // escopos que eu entendi" concederia acesso parcial a partir de dado corrompido.
    for (const scopes of [
      [],
      null,
      "users.read",
      ["users.read", "tudo.write"],
      ["users.read", "users.read"],
      ["users.read", 42],
      [null],
    ]) {
      const identity = await resolveServiceCredential(
        stubDb(await credentialRow({ scopes })),
        `downloads-prod-abcd1234.${SECRET}`,
      );
      expect(identity, `scopes=${JSON.stringify(scopes)}`).toBeNull();
    }
  });

  it("gasta tempo de verificacao mesmo sem credencial, contra enumeracao", async () => {
    // "token_id não existe" respondia em microssegundos e "existe, segredo
    // errado" em ~50ms de Argon2id. A diferença é mensurável pela rede e permite
    // descobrir quais token_id estão registrados.
    const inicio = Date.now();
    const identity = await resolveServiceCredential(stubDb(undefined), `x-prod-abcd1234.${SECRET}`);
    const decorrido = Date.now() - inicio;

    expect(identity).toBeNull();
    // Limiar folgado de propósito: o ponto é provar que o Argon2id roda, não
    // cravar uma duração, que varia com a máquina e tornaria o teste instável.
    expect(decorrido, "verificação descartável deveria custar tempo de KDF").toBeGreaterThan(5);
  });

  it("falha fechado com hash corrompido, sem lancar", async () => {
    const identity = await resolveServiceCredential(
      stubDb(await credentialRow({ token_hash: "nao-e-um-hash-argon2" })),
      `downloads-prod-abcd1234.${SECRET}`,
    );
    expect(identity).toBeNull();
  });

  it("credencial do slot next autentica igual a current", async () => {
    // Durante a janela de rotação as duas precisam funcionar: o consumidor troca
    // para `next` antes de `current` ser revogada. Se `next` não autenticasse, a
    // rotação teria downtime obrigatório entre os passos 2 e 4.
    const identity = await resolveServiceCredential(
      stubDb(await credentialRow({ token_id: "downloads-prod-next0001", rotation_slot: "next" })),
      `downloads-prod-next0001.${SECRET}`,
    );

    expect(identity).not.toBeNull();
    expect(identity?.sourceApp).toBe("downloads");
    expect(identity?.realm).toBe("prod");
  });

  it("credencial de beta nao consegue afirmar prod", async () => {
    // O invariante que motivou a task: o realm sai da credencial, e uma
    // credencial de beta não tem `prod` de onde derivar.
    const identity = await resolveServiceCredential(
      stubDb(await credentialRow({ source_app: "mesas", realms: ["beta"] })),
      `downloads-prod-abcd1234.${SECRET}`,
    );
    expect(identity?.realm).toBe("beta");
    expect(identity?.realm).not.toBe("prod");
  });
});

describe("hashServiceSecret", () => {
  it("produz Argon2id, nao hash rapido", async () => {
    // SHA-256 aqui permitiria força bruta offline se a tabela vazasse. O prefixo
    // é verificado pelo CHECK da migration também — os dois precisam concordar.
    const hash = await hashServiceSecret(SECRET);
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("gera hash diferente para o mesmo segredo (salt por linha)", async () => {
    const [a, b] = await Promise.all([hashServiceSecret(SECRET), hashServiceSecret(SECRET)]);
    expect(a).not.toBe(b);
  });
});

describe("hasScope", () => {
  const identity: ServiceCredentialIdentity = {
    credentialId: "id",
    tokenId: "t",
    sourceApp: "downloads",
    realms: ["prod"],
    realm: "prod",
    scopes: ["users.read"],
  };

  it("separa leitura de usuario de leitura de segredo", () => {
    // É a separação que o `SERVICE_SECRET` global não tinha: quem resolvia
    // e-mail também lia chave de API decifrada.
    expect(hasScope(identity, "users.read")).toBe(true);
    expect(hasScope(identity, "secrets.read")).toBe(false);
  });

  it("escopo de escrita comunitaria nao vem de graca", () => {
    expect(hasScope(identity, "comment.write")).toBe(false);
    expect(hasScope(identity, "vote.write")).toBe(false);
  });
});

describe("SERVICE_SCOPES", () => {
  it("espelha o CHECK da migration 007", () => {
    // Divergir daqui faz o INSERT falhar em runtime com erro de constraint, o que
    // só apareceria no deploy. Manter os dois lados no mesmo teste.
    expect([...SERVICE_SCOPES]).toEqual([
      "users.read",
      "secrets.read",
      "comment.write",
      "comment.read",
      "vote.write",
      "report.write",
      "moderation.write",
    ]);
  });
});

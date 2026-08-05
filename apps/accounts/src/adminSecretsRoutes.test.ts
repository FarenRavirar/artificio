import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({ currentAdmin: vi.fn(), requireAuth: vi.fn() }));

vi.mock("./requireCurrentAdmin.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./requireCurrentAdmin.js")>();
  return { ...actual, requireCurrentAdmin: () => guardMocks.currentAdmin };
});

vi.mock("@artificio/auth", () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) =>
    guardMocks.requireAuth(req, res, next),
}));

const { requireServiceOrAdmin } = await import("./adminSecretsRoutes.js");
const { hashServiceSecret } = await import("./serviceCredential.js");

const SECRET = "service-secret-service-secret-01";
const CREDENTIAL_SECRET = "segredo-de-credencial-registrada";

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    token_id: "mesas-prod-abcd1234",
    token_hash: await hashServiceSecret(CREDENTIAL_SECRET),
    source_app: "mesas",
    realms: ["prod"],
    scopes: ["secrets.read"],
    ...overrides,
  };
}

/**
 * T2.2a tornou o guard assíncrono: antes de decidir, ele consulta o registro de
 * credenciais (`community_service_credential`). O fixture precisa devolver um
 * `db` real o bastante para essa consulta e o `run` precisa ser aguardado —
 * `{} as never` estourava dentro da promise e o teste via só "next nunca
 * chamado", sem o motivo.
 */
function stubDb(row?: Record<string, unknown>) {
  const builder = {
    select: () => builder,
    where: () => builder,
    executeTakeFirst: async () => row,
  };
  return { selectFrom: () => builder } as never;
}

async function run(
  env: Record<string, string | undefined>,
  headers: Record<string, unknown>,
  credentialRow?: Record<string, unknown>,
) {
  const req = { headers, path: "/admin/secrets/x" } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status } as unknown as Response;
  const next = vi.fn();
  requireServiceOrAdmin(env, stubDb(credentialRow))(req, res, next);
  // A decisão acontece dentro de uma promise; sem ceder o event loop o teste
  // assertaria antes de o guard rodar.
  await vi.waitFor(() => {
    if (!next.mock.calls.length && !status.mock.calls.length && !guardMocks.requireAuth.mock.calls.length) {
      throw new Error("guard ainda não decidiu");
    }
  });
  return { json, next, req, res, status };
}

describe("requireServiceOrAdmin", () => {
  beforeEach(() => {
    guardMocks.currentAdmin.mockReset().mockImplementation((_req, _res, next) => next());
    guardMocks.requireAuth.mockReset().mockImplementation((_req, _res, next) => next());
  });

  it("libera serviço com token correto sem exigir sessão", async () => {
    const { next } = await run({ SERVICE_SECRET: SECRET }, { "x-service-token": SECRET });

    expect(next).toHaveBeenCalled();
    expect(guardMocks.requireAuth).not.toHaveBeenCalled();
    expect(guardMocks.currentAdmin).not.toHaveBeenCalled();
  });

  // Token errado não devolve 401 direto: cai no caminho humano, onde a sessão
  // de admin é revalidada no banco. Sem isso, o admin logado perderia acesso ao
  // painel de segredos por mandar um header inválido.
  it("token errado cai no guard de admin, não em acesso liberado", async () => {
    const { next } = await run({ SERVICE_SECRET: SECRET }, { "x-service-token": "errado" });

    expect(guardMocks.requireAuth).toHaveBeenCalled();
    expect(guardMocks.currentAdmin).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  // O ponto que a comparação `===` anterior não garantia: sem `SERVICE_SECRET`
  // configurado, requisição sem token algum não pode ser tratada como serviço.
  it("segredo ausente nunca autentica como serviço", async () => {
    const { next } = await run({}, {});

    expect(guardMocks.requireAuth).toHaveBeenCalled();
    expect(guardMocks.currentAdmin).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("segredo ausente com token enviado também cai no guard humano", async () => {
    await run({ SERVICE_SECRET: undefined }, { "x-service-token": "qualquer" });

    expect(guardMocks.currentAdmin).toHaveBeenCalled();
  });

  it("propaga a recusa do guard de admin quando a sessão não é admin", async () => {
    guardMocks.currentAdmin.mockImplementation((_req: Request, res: Response) => {
      res.status(403).json({ error: "Acesso restrito a administradores." });
    });

    const { next, res } = await run({ SERVICE_SECRET: SECRET }, {});

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── T2.2a: registro de credencial ────────────────────────────────────────

  it("libera credencial registrada com escopo secrets.read", async () => {
    const { next } = await run(
      {},
      { "x-service-token": `mesas-prod-abcd1234.${CREDENTIAL_SECRET}` },
      await credentialRow(),
    );

    expect(next).toHaveBeenCalled();
    expect(guardMocks.requireAuth).not.toHaveBeenCalled();
  });

  // A separação que o `SERVICE_SECRET` global não tinha: quem resolvia e-mail de
  // usuário lia, com o mesmo valor, segredo decifrado.
  it("recusa com 403 credencial sem escopo secrets.read", async () => {
    const { next, res } = await run(
      {},
      { "x-service-token": `mesas-prod-abcd1234.${CREDENTIAL_SECRET}` },
      await credentialRow({ scopes: ["users.read"] }),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    // Escopo insuficiente é erro de configuração e não pode ser mascarado como
    // "tente com cookie de admin".
    expect(guardMocks.requireAuth).not.toHaveBeenCalled();
  });

  it("credencial com segredo errado cai no guard humano", async () => {
    const { next } = await run(
      {},
      { "x-service-token": "mesas-prod-abcd1234.segredo-errado" },
      await credentialRow(),
    );

    expect(guardMocks.requireAuth).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

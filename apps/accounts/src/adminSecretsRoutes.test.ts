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

const SECRET = "service-secret-service-secret-01";

function run(env: Record<string, string | undefined>, headers: Record<string, unknown>) {
  const req = { headers } as unknown as Request;
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnValue({ json }) } as unknown as Response;
  const next = vi.fn();
  requireServiceOrAdmin(env, {} as never)(req, res, next);
  return { json, next, req, res };
}

describe("requireServiceOrAdmin", () => {
  beforeEach(() => {
    guardMocks.currentAdmin.mockReset().mockImplementation((_req, _res, next) => next());
    guardMocks.requireAuth.mockReset().mockImplementation((_req, _res, next) => next());
  });

  it("libera serviço com token correto sem exigir sessão", () => {
    const { next } = run({ SERVICE_SECRET: SECRET }, { "x-service-token": SECRET });

    expect(next).toHaveBeenCalled();
    expect(guardMocks.requireAuth).not.toHaveBeenCalled();
    expect(guardMocks.currentAdmin).not.toHaveBeenCalled();
  });

  // Token errado não devolve 401 direto: cai no caminho humano, onde a sessão
  // de admin é revalidada no banco. Sem isso, o admin logado perderia acesso ao
  // painel de segredos por mandar um header inválido.
  it("token errado cai no guard de admin, não em acesso liberado", () => {
    const { next } = run({ SERVICE_SECRET: SECRET }, { "x-service-token": "errado" });

    expect(guardMocks.requireAuth).toHaveBeenCalled();
    expect(guardMocks.currentAdmin).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  // O ponto que a comparação `===` anterior não garantia: sem `SERVICE_SECRET`
  // configurado, requisição sem token algum não pode ser tratada como serviço.
  it("segredo ausente nunca autentica como serviço", () => {
    const { next } = run({}, {});

    expect(guardMocks.requireAuth).toHaveBeenCalled();
    expect(guardMocks.currentAdmin).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("segredo ausente com token enviado também cai no guard humano", () => {
    run({ SERVICE_SECRET: undefined }, { "x-service-token": "qualquer" });

    expect(guardMocks.currentAdmin).toHaveBeenCalled();
  });

  it("propaga a recusa do guard de admin quando a sessão não é admin", () => {
    guardMocks.currentAdmin.mockImplementation((_req: Request, res: Response) => {
      res.status(403).json({ error: "Acesso restrito a administradores." });
    });

    const { next, res } = run({ SERVICE_SECRET: SECRET }, {});

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

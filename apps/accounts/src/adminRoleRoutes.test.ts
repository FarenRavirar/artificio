import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ role: "admin" as "user" | "moderator" | "admin" }));
vi.mock("@artificio/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@artificio/auth")>();
  return {
    ...actual,
    requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (req as express.Request & { session?: unknown }).session = {
        user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: authState.role },
      };
      next();
    },
  };
});

const roleMocks = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn() }));
vi.mock("./globalRoles.js", () => ({
  listGlobalRoleUsers: roleMocks.list,
  setGlobalRole: roleMocks.set,
}));

import { createAdminRoleRoutes } from "./adminRoleRoutes.js";

function app() {
  const server = express();
  server.use(express.json());
  server.use(createAdminRoleRoutes({} as never));
  return server;
}

describe("admin role routes", () => {
  beforeEach(() => {
    authState.role = "admin";
    roleMocks.list.mockReset().mockResolvedValue([]);
    roleMocks.set.mockReset();
  });

  it("exige admin global", async () => {
    authState.role = "moderator";
    await request(app()).get("/admin/roles/users").expect(403);
    expect(roleMocks.list).not.toHaveBeenCalled();
  });

  it("lista contas com busca", async () => {
    await request(app()).get("/admin/roles/users?q=ana").expect(200);
    expect(roleMocks.list).toHaveBeenCalledWith(expect.anything(), "ana");
  });

  it("altera papel usando o admin da sessão como ator", async () => {
    roleMocks.set.mockResolvedValue({ id: "user-1", role: "moderator" });
    const response = await request(app())
      .patch("/admin/roles/users/user-1")
      .send({ role: "moderator" })
      .expect(200);

    expect(roleMocks.set).toHaveBeenCalledWith(expect.anything(), "admin-1", "user-1", "moderator");
    expect(response.body.user).toMatchObject({ id: "user-1", role: "moderator" });
  });

  it("recusa auto-rebaixamento", async () => {
    roleMocks.set.mockRejectedValue(new Error("SELF_DEMOTION_FORBIDDEN"));
    await request(app())
      .patch("/admin/roles/users/admin-1")
      .send({ role: "user" })
      .expect(409);
  });
});

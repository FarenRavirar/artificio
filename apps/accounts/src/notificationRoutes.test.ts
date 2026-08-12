import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- mock @artificio/auth ----
const authState = vi.hoisted(() => ({
  userId: "user-1",
  role: "user" as "user" | "moderator" | "admin",
  authenticated: true,
}));
vi.mock("@artificio/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@artificio/auth")>();
  return {
    ...actual,
    requireAuth: (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (!authState.authenticated) {
        res.status(401).json({ error: { code: "unauthorized" } });
        return;
      }
      (req as express.Request & { session?: unknown }).session = {
        user: {
          id: authState.userId,
          email: "user@example.com",
          name: "User",
          role: authState.role,
          roleVersion: 1,
        },
      };
      next();
    },
  };
});

// ---- mock notificationData ----
const dataMocks = vi.hoisted(() => ({
  countUnread: vi.fn(),
  markAllRead: vi.fn(),
  markReadThrough: vi.fn(),
  findReceiptOwner: vi.fn(),
  markOneRead: vi.fn(),
  listNotifications: vi.fn(),
}));
vi.mock("./notificationData.js", () => dataMocks);

import { createNotificationRoutes } from "./notificationRoutes.js";

function app() {
  const server = express();
  server.use(express.json());
  server.use(createNotificationRoutes({} as never, "prod"));
  return server;
}

describe("notification routes", () => {
  beforeEach(() => {
    authState.userId = "user-1";
    authState.role = "user";
    authState.authenticated = true;
    Object.values(dataMocks).forEach((fn) => fn.mockReset());
  });

  // ======================================================================
  // GET /api/v1/notifications/unread-count
  // ======================================================================
  describe("GET /api/v1/notifications/unread-count", () => {
    it("retorna contagem de não lidas", async () => {
      dataMocks.countUnread.mockResolvedValue(5);
      const res = await request(app())
        .get("/api/v1/notifications/unread-count")
        .expect(200);
      expect(res.body).toEqual({ count: 5 });
      expect(res.headers["cache-control"]).toBe("private, no-store");
    });

    it("exige sessão", async () => {
      authState.authenticated = false;
      await request(app())
        .get("/api/v1/notifications/unread-count")
        .expect(401);
      expect(dataMocks.countUnread).not.toHaveBeenCalled();
    });
  });

  // ======================================================================
  // PATCH /api/v1/notifications/read-all
  // ======================================================================
  describe("PATCH /api/v1/notifications/read-all", () => {
    it("marca todas como lidas e retorna contagem", async () => {
      dataMocks.markAllRead.mockResolvedValue(3);
      const res = await request(app())
        .patch("/api/v1/notifications/read-all")
        .expect(200);
      expect(res.body).toEqual({ marked: 3 });
      expect(res.headers["cache-control"]).toBe("private, no-store");
    });

    it("é idempotente: zero não lidas retorna 0", async () => {
      dataMocks.markAllRead.mockResolvedValue(0);
      const res = await request(app())
        .patch("/api/v1/notifications/read-all")
        .expect(200);
      expect(res.body).toEqual({ marked: 0 });
    });

    it("não é engolida por /:id/read — rota estática declarada antes", async () => {
      dataMocks.markAllRead.mockResolvedValue(1);
      await request(app())
        .patch("/api/v1/notifications/read-all")
        .expect(200);
    });
  });

  // ======================================================================
  // PUT /api/v1/notifications/read-through
  // ======================================================================
  describe("PUT /api/v1/notifications/read-through", () => {
    it("marca lidas até um instante", async () => {
      dataMocks.markReadThrough.mockResolvedValue(7);
      const res = await request(app())
        .put("/api/v1/notifications/read-through")
        .send({ through: "2026-08-11T12:00:00.000Z" })
        .expect(200);
      expect(res.body).toEqual({ marked: 7 });
    });

    it("recusa corpo inválido", async () => {
      await request(app())
        .put("/api/v1/notifications/read-through")
        .send({ through: "não-é-data" })
        .expect(400);
      expect(dataMocks.markReadThrough).not.toHaveBeenCalled();
    });

    it("recusa corpo sem through", async () => {
      await request(app())
        .put("/api/v1/notifications/read-through")
        .send({})
        .expect(400);
      expect(dataMocks.markReadThrough).not.toHaveBeenCalled();
    });
  });

  // ======================================================================
  // GET /api/v1/notifications (lista paginada)
  // ======================================================================
  describe("GET /api/v1/notifications", () => {
    const sampleItem = {
      id: "rec-1",
      event_id: "evt-1",
      event_type: "comment.replied",
      subject_type: "downloads.material",
      subject_id: "mat-1",
      source_app: "downloads",
      canonical_path: "/materiais/mat-1",
      snapshot: { comment_id: "comm-1" },
      metadata: null,
      occurred_at: "2026-08-11T10:00:00.000Z",
      read_at: null,
      created_at: "2026-08-11T10:00:01.000Z",
    };

    it("lista com limite padrão 20", async () => {
      dataMocks.listNotifications.mockResolvedValue({
        items: [sampleItem],
        cursor: null,
      });
      const res = await request(app())
        .get("/api/v1/notifications")
        .expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].event_type).toBe("comment.replied");
      expect(res.headers["cache-control"]).toBe("private, no-store");
    });

    it("aceita limite customizado", async () => {
      dataMocks.listNotifications.mockResolvedValue({ items: [], cursor: null });
      await request(app())
        .get("/api/v1/notifications?limit=5")
        .expect(200);
      const call = dataMocks.listNotifications.mock.calls[0][1];
      expect(call.limit).toBe(5);
    });

    it("recusa limite > 100", async () => {
      await request(app())
        .get("/api/v1/notifications?limit=200")
        .expect(400);
    });

    it("aceita filtro por source_app", async () => {
      dataMocks.listNotifications.mockResolvedValue({ items: [], cursor: null });
      await request(app())
        .get("/api/v1/notifications?source_app=downloads")
        .expect(200);
      expect(dataMocks.listNotifications).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sourceApp: "downloads" }),
      );
    });

    it("cursor inválido retorna 400", async () => {
      await request(app())
        .get("/api/v1/notifications?cursor=!!!invalido!!!")
        .expect(400);
    });

    it("cursor decodifica mas carrega timestamp/uuid inválidos retorna 400", async () => {
      const cursor = Buffer.from(
        JSON.stringify({ t: "abc", i: "nao-uuid" }),
      ).toString("base64url");
      await request(app())
        .get(`/api/v1/notifications?cursor=${cursor}`)
        .expect(400);
      expect(dataMocks.listNotifications).not.toHaveBeenCalled();
    });

    it("devolve cursor null na última página", async () => {
      dataMocks.listNotifications.mockResolvedValue({
        items: [sampleItem],
        cursor: null,
      });
      const res = await request(app())
        .get("/api/v1/notifications")
        .expect(200);
      expect(res.body.cursor).toBeNull();
    });

    it("devolve cursor para próxima página", async () => {
      dataMocks.listNotifications.mockResolvedValue({
        items: [sampleItem],
        cursor: "cur-nxt",
      });
      const res = await request(app())
        .get("/api/v1/notifications")
        .expect(200);
      expect(res.body.cursor).toBe("cur-nxt");
    });
  });

  // ======================================================================
  // PUT /api/v1/notifications/:id/read
  // ======================================================================
  describe("PUT /api/v1/notifications/:id/read", () => {
    it("marca como lida", async () => {
      dataMocks.findReceiptOwner.mockResolvedValue("user-1");
      dataMocks.markOneRead.mockResolvedValue(undefined);
      const res = await request(app())
        .put("/api/v1/notifications/rec-1/read")
        .expect(200);
      expect(res.body).toEqual({ id: "rec-1", read: true });
      expect(dataMocks.markOneRead).toHaveBeenCalled();
    });

    it("idempotente: já lido retorna 200", async () => {
      dataMocks.findReceiptOwner.mockResolvedValue("user-1");
      dataMocks.markOneRead.mockResolvedValue(undefined);
      await request(app())
        .put("/api/v1/notifications/rec-1/read")
        .expect(200);
    });

    it("404 uniforme para ID inexistente", async () => {
      dataMocks.findReceiptOwner.mockResolvedValue(null);
      const res = await request(app())
        .put("/api/v1/notifications/inexistente/read")
        .expect(404);
      expect(res.body.error.code).toBe("not_found");
      expect(dataMocks.markOneRead).not.toHaveBeenCalled();
    });

    it("404 uniforme para recibo de outro usuário — mesmo corpo, mesmo status", async () => {
      dataMocks.findReceiptOwner.mockResolvedValue("user-2");
      const res = await request(app())
        .put("/api/v1/notifications/rec-1/read")
        .expect(404);
      expect(res.body.error.code).toBe("not_found");
      expect(dataMocks.markOneRead).not.toHaveBeenCalled();
    });

    it("ID de terceiro e ID inexistente têm resposta idêntica", async () => {
      dataMocks.findReceiptOwner.mockResolvedValue("user-2");
      const resOther = await request(app())
        .put("/api/v1/notifications/rec-1/read")
        .expect(404);

      dataMocks.findReceiptOwner.mockResolvedValue(null);
      const resNotFound = await request(app())
        .put("/api/v1/notifications/rec-2/read")
        .expect(404);

      // Mesmo corpo, mesmo status, sem distinção
      expect(resOther.body).toEqual(resNotFound.body);
      expect(resOther.status).toBe(resNotFound.status);
    });
  });

  // ======================================================================
  // Ordem de declaração: /read-all não é engolida por /:id/read
  // ======================================================================
  describe("ordem de declaração das rotas", () => {
    it("/read-all é PATCH e não conflita com PUT /:id/read", async () => {
      dataMocks.markAllRead.mockResolvedValue(0);
      await request(app())
        .patch("/api/v1/notifications/read-all")
        .expect(200);
    });

    it("/read-through é PUT estático, não capturado como :id", async () => {
      dataMocks.markReadThrough.mockResolvedValue(0);
      await request(app())
        .put("/api/v1/notifications/read-through")
        .send({ through: "2026-08-11T12:00:00.000Z" })
        .expect(200);
      // Se /:id/read tivesse engolido, veríamos findReceiptOwner chamado
      expect(dataMocks.findReceiptOwner).not.toHaveBeenCalled();
    });
  });

  // ======================================================================
  // Cache-Control
  // ======================================================================
  describe("cache headers", () => {
    it("todas as rotas têm private, no-store", async () => {
      dataMocks.countUnread.mockResolvedValue(0);
      dataMocks.markAllRead.mockResolvedValue(0);
      dataMocks.markReadThrough.mockResolvedValue(0);
      dataMocks.listNotifications.mockResolvedValue({ items: [], cursor: null });
      dataMocks.findReceiptOwner.mockResolvedValue("user-1");
      dataMocks.markOneRead.mockResolvedValue(undefined);

      const routes = [
        { method: "get" as const, path: "/api/v1/notifications/unread-count" },
        { method: "patch" as const, path: "/api/v1/notifications/read-all" },
        {
          method: "put" as const,
          path: "/api/v1/notifications/read-through",
          body: { through: "2026-08-11T12:00:00.000Z" },
        },
        { method: "get" as const, path: "/api/v1/notifications" },
        {
          method: "put" as const,
          path: "/api/v1/notifications/rec-x/read",
        },
      ];

      for (const route of routes) {
        const res = await request(app())[route.method](route.path)
          .send((route as { body?: unknown }).body ?? undefined);
        expect(res.headers["cache-control"]).toBe("private, no-store");
      }
    });
  });
});

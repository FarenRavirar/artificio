import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  userId: "11111111-1111-4111-8111-111111111111",
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
          role: "user",
          roleVersion: 1,
        },
      };
      next();
    },
  };
});

const readMocks = vi.hoisted(() => ({
  listOwnReports: vi.fn(),
  readOwnAppeal: vi.fn(),
}));

vi.mock("./communityCommentReport.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./communityCommentReport.js")>();
  return { ...actual, listOwnReports: readMocks.listOwnReports };
});

vi.mock("./communityModerationAppeal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./communityModerationAppeal.js")>();
  return { ...actual, readOwnAppeal: readMocks.readOwnAppeal };
});

import { createCommunityModerationRoutes } from "./communityModerationRoutes.js";

const APPEAL_ID = "66666666-6666-4666-8666-666666666666";

function app() {
  const server = express();
  server.use(express.json());
  server.use(createCommunityModerationRoutes({} as never));
  return server;
}

beforeEach(() => {
  authState.authenticated = true;
  vi.clearAllMocks();
  readMocks.listOwnReports.mockResolvedValue([
    {
      id: "55555555-5555-4555-8555-555555555555",
      realm: "beta",
      source_app: "downloads",
      comment_id: "22222222-2222-4222-8222-222222222222",
      reason_code: "spam_or_off_topic",
      state: "upheld",
      result: "action_taken",
      can_withdraw: false,
      created_at: "2026-08-09T12:00:00.000Z",
    },
  ]);
  readMocks.readOwnAppeal.mockResolvedValue({
    id: APPEAL_ID,
    case_id: "44444444-4444-4444-8444-444444444444",
    status: "reversed",
    submitted_at: "2026-08-09T12:00:00.000Z",
    appeal_deadline_at: "2027-02-09T12:00:00.000Z",
    decision: "reversed",
    decided_at: "2026-08-10T12:00:00.000Z",
  });
});

describe("GET /api/v1/community/reports", () => {
  it("filtra pela conta da sessão e devolve resultado mínimo", async () => {
    const res = await request(app()).get("/api/v1/community/reports").expect(200);

    expect(readMocks.listOwnReports).toHaveBeenCalledWith(
      expect.anything(),
      authState.userId,
    );
    expect(res.body.reports[0]).toEqual(
      expect.objectContaining({ result: "action_taken", can_withdraw: false }),
    );
    expect(res.body.reports[0]).not.toHaveProperty("reporter_actor_id");
    expect(res.body.reports[0]).not.toHaveProperty("details");
    expect(res.body.reports[0]).not.toHaveProperty("resolution_reason");
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("exige sessão", async () => {
    authState.authenticated = false;
    await request(app()).get("/api/v1/community/reports").expect(401);
    expect(readMocks.listOwnReports).not.toHaveBeenCalled();
  });

  it("recusa realm/source_app da query", async () => {
    const res = await request(app())
      .get("/api/v1/community/reports?realm=prod&source_app=downloads")
      .expect(400);
    expect(res.body.error.code).toBe("invalid_query");
    expect(readMocks.listOwnReports).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/community/appeals/:id", () => {
  it("devolve status, prazo e decisão somente do titular", async () => {
    const res = await request(app())
      .get(`/api/v1/community/appeals/${APPEAL_ID}`)
      .expect(200);

    expect(readMocks.readOwnAppeal).toHaveBeenCalledWith(
      expect.anything(),
      authState.userId,
      APPEAL_ID,
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        status: "reversed",
        appeal_deadline_at: "2027-02-09T12:00:00.000Z",
        decision: "reversed",
      }),
    );
    expect(res.body).not.toHaveProperty("decision_reason");
    expect(res.body).not.toHaveProperty("decided_by_actor_id");
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("colapsa recurso alheio ou inexistente em 404", async () => {
    readMocks.readOwnAppeal.mockResolvedValue(null);
    const res = await request(app())
      .get(`/api/v1/community/appeals/${APPEAL_ID}`)
      .expect(404);
    expect(res.body.error.code).toBe("appeal_not_found");
  });

  it("recusa realm/source_app da query", async () => {
    const res = await request(app())
      .get(`/api/v1/community/appeals/${APPEAL_ID}?realm=beta`)
      .expect(400);
    expect(res.body.error.code).toBe("invalid_query");
    expect(readMocks.readOwnAppeal).not.toHaveBeenCalled();
  });
});

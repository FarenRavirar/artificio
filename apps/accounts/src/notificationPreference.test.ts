import { describe, expect, it } from "vitest";

/**
 * T3.11b — Testes de lógica pura da preferência (sem DB).
 * isModerationEvent, getEventTypeLabel, listEventTypes.
 * Testes de DB (setPreference, shouldDeliver) vão contra Postgres real.
 */

import {
  getEventTypeLabel,
  isModerationEvent,
  listEventTypes,
} from "./notificationPreference.js";

describe("isModerationEvent (T3.11b/20b)", () => {
  it("tipos de moderação são reconhecidos", () => {
    expect(isModerationEvent("moderation.comment_removed")).toBe(true);
    expect(isModerationEvent("moderation.comment_restored")).toBe(true);
    expect(isModerationEvent("moderation.report_resolved")).toBe(true);
    expect(isModerationEvent("moderation.appeal_resolved")).toBe(true);
    expect(isModerationEvent("moderation.sanction_applied")).toBe(true);
    expect(isModerationEvent("moderation.sanction_lifted")).toBe(true);
  });

  it("prefixo moderation.* é detectado mesmo sem estar no catálogo explícito", () => {
    // Tipo novo de moderação — prefixo basta
    expect(isModerationEvent("moderation.content_hidden")).toBe(true);
    expect(isModerationEvent("moderation.future_type")).toBe(true);
  });

  it("tipos sociais NÃO são moderação", () => {
    expect(isModerationEvent("comment.created")).toBe(false);
    expect(isModerationEvent("comment.replied")).toBe(false);
  });

  it("tipo desconhecido sem prefixo não é moderação", () => {
    expect(isModerationEvent("unknown.event")).toBe(false);
    expect(isModerationEvent("")).toBe(false);
  });
});

describe("getEventTypeLabel (T3.11b/20a-i)", () => {
  it("tipos conhecidos têm rótulo", () => {
    expect(getEventTypeLabel("comment.created")).toBe("Comentário no meu conteúdo");
    expect(getEventTypeLabel("comment.replied")).toBe("Resposta ao meu comentário");
    expect(getEventTypeLabel("moderation.comment_removed")).toBe(
      "Comentário removido pela moderação",
    );
  });

  it("tipo desconhecido retorna null", () => {
    expect(getEventTypeLabel("unknown.event")).toBeNull();
    expect(getEventTypeLabel("")).toBeNull();
  });
});

describe("listEventTypes (T3.11b/20a-i)", () => {
  it("todos os tipos têm label e modifiable", () => {
    const types = listEventTypes();
    expect(types.length).toBeGreaterThan(0);

    for (const t of types) {
      expect(t.event_type).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(typeof t.modifiable).toBe("boolean");
    }
  });

  it("tipos de moderação são marked as non-modifiable", () => {
    const types = listEventTypes();
    const moderationTypes = types.filter((t) =>
      t.event_type.startsWith("moderation."),
    );
    expect(moderationTypes.length).toBeGreaterThan(0);

    for (const t of moderationTypes) {
      expect(t.modifiable).toBe(false);
    }
  });

  it("tipos sociais são modifiable", () => {
    const types = listEventTypes();
    const socialTypes = types.filter(
      (t) =>
        !t.event_type.startsWith("moderation.") &&
        t.event_type !== "",
    );
    expect(socialTypes.length).toBeGreaterThan(0);

    for (const t of socialTypes) {
      expect(t.modifiable).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  CHANGELOG_CACHE_TTL,
  isChangelogEntry,
  normalizeChangelogEntries,
  type ChangelogEntry,
} from "./index.js";

const valid: ChangelogEntry = {
  id: "1",
  title: "t",
  body: "b",
  type: "app",
  published: true,
  created_at: "2026-06-21T10:00:00-03:00",
};

describe("isChangelogEntry", () => {
  it("aceita entrada valida", () => {
    expect(isChangelogEntry(valid)).toBe(true);
  });

  it("rejeita não-objeto / null", () => {
    expect(isChangelogEntry(null)).toBe(false);
    expect(isChangelogEntry("x")).toBe(false);
  });

  it("rejeita published !== true e type invalido", () => {
    expect(isChangelogEntry({ ...valid, published: false })).toBe(false);
    expect(isChangelogEntry({ ...valid, type: "outro" })).toBe(false);
  });

  it("rejeita created_at invalido", () => {
    expect(isChangelogEntry({ ...valid, created_at: "nao-data" })).toBe(false);
  });
});

describe("normalizeChangelogEntries", () => {
  it("retorna [] para payload não-array", () => {
    expect(normalizeChangelogEntries(null)).toEqual([]);
    expect(normalizeChangelogEntries({})).toEqual([]);
  });

  it("filtra invalidos e ordena por created_at desc", () => {
    const older = { ...valid, id: "old", created_at: "2026-01-01T00:00:00-03:00" };
    const newer = { ...valid, id: "new", created_at: "2026-06-01T00:00:00-03:00" };
    const out = normalizeChangelogEntries([older, { bad: 1 }, newer]);
    expect(out.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("respeita o limit", () => {
    const a = { ...valid, id: "a", created_at: "2026-06-03T00:00:00-03:00" };
    const b = { ...valid, id: "b", created_at: "2026-06-02T00:00:00-03:00" };
    const c = { ...valid, id: "c", created_at: "2026-06-01T00:00:00-03:00" };
    expect(normalizeChangelogEntries([a, b, c], 2).map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("constantes", () => {
  it("CHANGELOG_CACHE_TTL é 60s", () => {
    expect(CHANGELOG_CACHE_TTL).toBe(60_000);
  });
});

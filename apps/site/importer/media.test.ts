import { afterEach, describe, expect, it } from "vitest";
import type { Db } from "../db/connection";
import {
  __setUploadForTest,
  buildMediaMap,
  getMediaReport,
  resolveMediaUrl,
  resetMediaReport,
  stripSizeSuffix,
} from "./media";

function mockDb(): Db {
  return {
    isPg: true,
    async query(sql: string, params?: unknown[]) {
      if (sql.startsWith("SELECT")) return { rows: [] };
      inserts.push(params);
      return { rows: [] };
    },
    async exec(_sql: string) {},
    async close() {},
  };
}

const inserts: unknown[] = [];

afterEach(() => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.SITE_MIGRATE_MEDIA;
  __setUploadForTest(null);
  resetMediaReport();
  inserts.length = 0;
});

describe("stripSizeSuffix", () => {
  it("remove o sufixo de tamanho antes da extensao", () => {
    expect(stripSizeSuffix("https://artificiorpg.com/wp-content/uploads/2025/08/foo-1100x630.webp"))
      .toBe("https://artificiorpg.com/wp-content/uploads/2025/08/foo.webp");
  });

  it("preserva URLs sem sufixo", () => {
    expect(stripSizeSuffix("https://artificiorpg.com/wp-content/uploads/2025/08/foo.webp"))
      .toBe("https://artificiorpg.com/wp-content/uploads/2025/08/foo.webp");
  });

  it("preserva query string", () => {
    expect(stripSizeSuffix("https://artificiorpg.com/wp-content/uploads/foo-360x203.jpg?x=1"))
      .toBe("https://artificiorpg.com/wp-content/uploads/foo.jpg?x=1");
  });
});

describe("buildMediaMap", () => {
  it("continua o lote quando uma URL falha e grava as demais", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async (url) => {
      if (url.includes("missing")) throw new Error("Resource not found");
      return `https://res.cloudinary.com/demo/${encodeURIComponent(url)}`;
    });

    const map = await buildMediaMap(mockDb(), [
      "https://artificiorpg.com/wp-content/uploads/ok.webp",
      "https://artificiorpg.com/wp-content/uploads/missing.webp",
      "https://artificiorpg.com/wp-content/uploads/ok-360x203.webp",
    ]);

    expect(map.get("https://artificiorpg.com/wp-content/uploads/missing.webp"))
      .toBe("https://artificiorpg.com/wp-content/uploads/missing.webp");
    expect(map.get("https://artificiorpg.com/wp-content/uploads/ok.webp"))
      .toContain("https://res.cloudinary.com/demo/");
    expect(map.get("https://artificiorpg.com/wp-content/uploads/ok-360x203.webp"))
      .toContain("https://res.cloudinary.com/demo/");
    expect(getMediaReport().failures).toHaveLength(1);
    expect(getMediaReport().migrated).toBe(2);
    expect(inserts).toHaveLength(2);
  });

  it("usa fallback original e grava media_map com a chave da URL original de entrada", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async (url) => {
      if (url.endsWith("-1100x630.webp")) throw new Error("Resource not found");
      return "https://res.cloudinary.com/demo/original.webp";
    });

    const wpUrl = "https://artificiorpg.com/wp-content/uploads/lunatar-1100x630.webp";
    const map = await buildMediaMap(mockDb(), [wpUrl]);

    expect(map.get(wpUrl)).toBe("https://res.cloudinary.com/demo/original.webp");
    expect(inserts[0]).toEqual([wpUrl, "https://res.cloudinary.com/demo/original.webp"]);
    expect(getMediaReport().failures).toHaveLength(0);
    expect(getMediaReport().migrated).toBe(1);
  });

  it("propaga erro fatal de credencial Cloudinary", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    const fatal = Object.assign(new Error("Invalid API key"), { http_code: 401 });
    __setUploadForTest(async () => {
      throw fatal;
    });

    await expect(buildMediaMap(mockDb(), ["https://artificiorpg.com/wp-content/uploads/fatal.webp"]))
      .rejects.toThrow("Invalid API key");
    expect(getMediaReport().failures).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("nao tenta subir novamente a mesma URL falhada no mesmo run", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    let calls = 0;
    __setUploadForTest(async () => {
      calls += 1;
      throw new Error("Resource not found");
    });
    const db = mockDb();
    const wpUrl = "https://artificiorpg.com/wp-content/uploads/missing.webp";

    await expect(resolveMediaUrl(db, wpUrl)).resolves.toBe(wpUrl);
    await expect(resolveMediaUrl(db, wpUrl)).resolves.toBe(wpUrl);

    expect(calls).toBe(1);
    expect(getMediaReport().failures).toHaveLength(1);
    expect(inserts).toHaveLength(0);
  });
});

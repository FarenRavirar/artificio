import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/connection";
import {
  __setAvifFallbackForTest,
  __setRemoteFileForTest,
  __setUploadForTest,
  buildMediaMap,
  extractMediaUrls,
  getMediaReport,
  mediaResourceType,
  pruneWpAssets,
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

// Default: resgate por bytes desligado (devolve null) p/ nenhum teste tocar a rede real.
// Testes específicos de resgate sobrescrevem com seu próprio impl.
beforeEach(() => {
  __setRemoteFileForTest(async () => null);
});

afterEach(() => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.SITE_MIGRATE_MEDIA;
  __setUploadForTest(null);
  __setAvifFallbackForTest(null);
  __setRemoteFileForTest(null);
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

describe("extractMediaUrls", () => {
  it("captura mídia não-imagem do WP: <a>, <audio>, <video>, <source>", () => {
    const html = [
      '<a href="https://artificiorpg.com/wp-content/uploads/2025/01/manual.pdf">PDF</a>',
      '<audio controls src="https://artificiorpg.com/wp-content/uploads/2025/01/ep.mp3"></audio>',
      '<video src="https://artificiorpg.com/wp-content/uploads/2025/01/clip.mp4" poster="https://artificiorpg.com/wp-content/uploads/2025/01/cover.jpg"></video>',
      '<audio><source src="https://artificiorpg.com/wp-content/uploads/2025/01/voz.ogg" type="audio/ogg"></audio>',
      '<a href="https://externo.com/outro.pdf">externo</a>',
    ].join("");
    const urls = extractMediaUrls(html);
    expect(urls).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/manual.pdf");
    expect(urls).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/ep.mp3");
    expect(urls).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/clip.mp4");
    expect(urls).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/cover.jpg");
    expect(urls).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/voz.ogg");
    expect(urls).not.toContain("https://externo.com/outro.pdf");
  });
});

describe("mediaResourceType", () => {
  it("classifica por extensão", () => {
    expect(mediaResourceType("https://x/a.webp")).toBe("image");
    expect(mediaResourceType("https://x/a.avif")).toBe("image");
    expect(mediaResourceType("https://x/a.mp4")).toBe("video");
    expect(mediaResourceType("https://x/a.webm")).toBe("video");
    expect(mediaResourceType("https://x/a.mp3")).toBe("video");
    expect(mediaResourceType("https://x/a.ogg")).toBe("video");
    expect(mediaResourceType("https://x/a.pdf")).toBe("raw");
    expect(mediaResourceType("https://x/a.zip")).toBe("raw");
  });
});

describe("pruneWpAssets", () => {
  it("remove mídia WP e desembrulha <a>, preservando o que já é Cloudinary", () => {
    const html = [
      '<p>antes</p>',
      '<img src="https://res.cloudinary.com/demo/ok.webp" alt="ok">',
      '<img src="https://artificiorpg.com/wp-content/uploads/2025/01/dead.webp" alt="x">',
      '<a href="https://artificiorpg.com/wp-content/uploads/2025/01/manual.pdf">baixe o PDF</a>',
      '<audio controls src="https://artificiorpg.com/wp-content/uploads/2025/01/ep.mp3"></audio>',
      '<video><source src="https://artificiorpg.com/wp-content/uploads/2025/01/clip.webm" type="video/webm"></video>',
      '<p>depois</p>',
    ].join("");
    const { html: out, removed } = pruneWpAssets(html);
    expect(out).not.toMatch(/wp-content\/uploads/);
    expect(out).toContain("https://res.cloudinary.com/demo/ok.webp");
    expect(out).toContain("baixe o PDF"); // <a> desembrulhado mantém texto
    expect(out).toContain("<p>antes</p>");
    expect(out).toContain("<p>depois</p>");
    expect(removed).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/dead.webp");
    expect(removed).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/manual.pdf");
    expect(removed).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/ep.mp3");
    expect(removed).toContain("https://artificiorpg.com/wp-content/uploads/2025/01/clip.webm");
  });

  it("remove <a> que envolve <img>, ambos WP", () => {
    const html = '<a href="https://artificiorpg.com/wp-content/uploads/a.jpg"><img src="https://artificiorpg.com/wp-content/uploads/a-300x200.jpg"></a>';
    const { html: out } = pruneWpAssets(html);
    expect(out).not.toMatch(/wp-content\/uploads/);
    expect(out).toBe("");
  });

  it("não toca HTML sem WP", () => {
    const html = '<p>texto <a href="https://externo.com/x">link</a></p>';
    const { html: out, removed } = pruneWpAssets(html);
    expect(out).toBe(html);
    expect(removed).toHaveLength(0);
  });
});

describe("buildMediaMap", () => {
  it("migra mídia não-imagem (pdf/mp3) reescrevendo a URL", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async (url) => `https://res.cloudinary.com/demo/${encodeURIComponent(url)}`);

    const pdf = "https://artificiorpg.com/wp-content/uploads/2025/01/manual.pdf";
    const mp3 = "https://artificiorpg.com/wp-content/uploads/2025/01/ep.mp3";
    const map = await buildMediaMap(mockDb(), [pdf, mp3]);

    expect(map.get(pdf)).toContain("https://res.cloudinary.com/demo/");
    expect(map.get(mp3)).toContain("https://res.cloudinary.com/demo/");
    expect(getMediaReport().migrated).toBe(2);
  });


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

  it("propaga erro fatal de credencial quando Cloudinary retorna objeto comum com message", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw { message: "Invalid API key" };
    });

    await expect(buildMediaMap(mockDb(), ["https://artificiorpg.com/wp-content/uploads/fatal.webp"]))
      .rejects.toEqual({ message: "Invalid API key" });
    expect(getMediaReport().failures).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("resgata por bytes quando o fetch server-side da Cloudinary falha mas o asset esta vivo", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw Object.assign(new Error("Error in loading https://x/quem-e-ela.webm - 403 Forbidden"), { http_code: 400 });
    });
    __setRemoteFileForTest(async (url) => {
      expect(url).toBe("https://artificiorpg.com/wp-content/uploads/2025/03/quem-e-ela.webm");
      return "https://res.cloudinary.com/demo/video/upload/quem-e-ela.webm";
    });

    const wpUrl = "https://artificiorpg.com/wp-content/uploads/2025/03/quem-e-ela.webm";
    const map = await buildMediaMap(mockDb(), [wpUrl]);

    expect(map.get(wpUrl)).toBe("https://res.cloudinary.com/demo/video/upload/quem-e-ela.webm");
    expect(getMediaReport().migrated).toBe(1);
    expect(getMediaReport().failures).toHaveLength(0);
    expect(inserts[0]).toEqual([wpUrl, "https://res.cloudinary.com/demo/video/upload/quem-e-ela.webm"]);
  });

  it("poda (falha toleravel) quando nem server-side nem resgate por bytes funcionam (asset morto)", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw { message: "Error in loading https://x/morto.webp - 404 Not Found" };
    });
    __setRemoteFileForTest(async () => null); // fetch 404 -> sem bytes

    const wpUrl = "https://artificiorpg.com/wp-content/uploads/morto.webp";
    await expect(resolveMediaUrl(mockDb(), wpUrl)).resolves.toBe(wpUrl);
    expect(getMediaReport().migrated).toBe(0);
    expect(getMediaReport().failures).toHaveLength(1);
    expect(inserts).toHaveLength(0);
  });

  it("propaga erro fatal vindo do resgate por bytes", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw { message: "Error in loading https://x/a.webm - 403 Forbidden" };
    });
    __setRemoteFileForTest(async () => {
      throw Object.assign(new Error("Invalid API key"), { http_code: 401 });
    });

    await expect(buildMediaMap(mockDb(), ["https://artificiorpg.com/wp-content/uploads/a.webm"]))
      .rejects.toThrow("Invalid API key");
    expect(getMediaReport().failures).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("trata 'Error in loading ... 403 Forbidden' (carga remota) como toleravel, nao fatal", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw Object.assign(new Error("Error in loading https://artificiorpg.com/wp-content/uploads/x.webm?_=1 - 403 Forbidden"), { http_code: 400 });
    });

    const wpUrl = "https://artificiorpg.com/wp-content/uploads/x.webm";
    await expect(resolveMediaUrl(mockDb(), wpUrl)).resolves.toBe(wpUrl);
    expect(getMediaReport().failures).toHaveLength(1);
    expect(getMediaReport().failures[0].motivo).toContain("Error in loading");
    expect(inserts).toHaveLength(0);
  });

  it("trata 'Error in loading ... 404 Not Found' como toleravel", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw { message: "Error in loading https://artificiorpg.com/wp-content/uploads/y.mp3 - 404 Not Found" };
    });

    const wpUrl = "https://artificiorpg.com/wp-content/uploads/y.mp3";
    await expect(resolveMediaUrl(mockDb(), wpUrl)).resolves.toBe(wpUrl);
    expect(getMediaReport().failures).toHaveLength(1);
  });

  it("registra message de objeto comum em falha toleravel", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw { message: "Resource not found" };
    });

    const wpUrl = "https://artificiorpg.com/wp-content/uploads/missing.webp";
    await expect(resolveMediaUrl(mockDb(), wpUrl)).resolves.toBe(wpUrl);

    expect(getMediaReport().failures).toEqual([
      { wpUrl, motivo: "upload falhou: Resource not found" },
    ]);
  });

  it("converte AVIF legado quando upload remoto falha mas fallback local funciona", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw { message: "Invalid image file" };
    });
    __setAvifFallbackForTest(async (url) => {
      expect(url).toBe("https://artificiorpg.com/wp-content/uploads/legacy.avif");
      return "https://res.cloudinary.com/demo/legacy-webp.webp";
    });

    const wpUrl = "https://artificiorpg.com/wp-content/uploads/legacy.avif";
    const map = await buildMediaMap(mockDb(), [wpUrl]);

    expect(map.get(wpUrl)).toBe("https://res.cloudinary.com/demo/legacy-webp.webp");
    expect(getMediaReport().migrated).toBe(1);
    expect(getMediaReport().failures).toHaveLength(0);
    expect(inserts[0]).toEqual([wpUrl, "https://res.cloudinary.com/demo/legacy-webp.webp"]);
  });

  it("propaga erro fatal vindo do fallback local AVIF", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.SITE_MIGRATE_MEDIA = "true";
    __setUploadForTest(async () => {
      throw { message: "Invalid image file" };
    });
    __setAvifFallbackForTest(async () => {
      throw { message: "Invalid API key" };
    });

    await expect(buildMediaMap(mockDb(), ["https://artificiorpg.com/wp-content/uploads/legacy.avif"]))
      .rejects.toEqual({ message: "Invalid API key" });
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

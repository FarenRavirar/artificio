import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, sanitizeReturnUrl } from "./app.js";
import type { AccountsEnv } from "./env.js";

// Registra os `public_id` pedidos ao Cloudinary. O valor exato importa: o
// caminho tem de incluir a pasta, senão a exclusão falha em silêncio.
const destroyedAssets = vi.hoisted(() => [] as string[]);
// `hangDestroy` simula o Cloudinary que não responde: a promessa nunca resolve.
const mediaState = vi.hoisted(() => ({ hangDestroy: false }));
vi.mock("@artificio/media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@artificio/media")>();
  return {
    ...actual,
    destroyAssetResult: vi.fn(async (publicId: string) => {
      destroyedAssets.push(publicId);
      if (mediaState.hangDestroy) return new Promise<boolean>(() => { /* nunca resolve */ });
      return true;
    }),
  };
});

const originalSecret = process.env.JWT_SECRET;

const env: AccountsEnv = {
  ACCOUNTS_COMMENT_CURSOR_KEY: "cursor-key-cursor-key-cursor-key-32",
  COOKIE_DOMAIN: ".artificiorpg.com",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/artificio_auth",
  GOOGLE_CALLBACK_URL: "https://accounts.artificiorpg.com/api/auth/google/callback",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  JWT_REFRESH_SECRET: "refresh-secret-refresh-secret-refresh",
  JWT_SECRET: "access-secret-access-secret-access",
  PORT: 3000,
  PUBLIC_URL: "https://accounts.artificiorpg.com",
  TRUSTED_PROXY_CIDR: "172.18.0.0/16",
};

describe("/api/auth/me", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("returns 401 without cookie", async () => {
    const app = createApp(env, null as never);

    await request(app).get("/api/auth/me").expect(401);
  });

  it("returns user with valid JWT cookie", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      {
        sub: "user-1",
        email: "ana@example.com",
        name: "Ana",
        role: "user",
      },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [`artificio_session=${token}`])
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: "user-1",
        email: "ana@example.com",
        name: "Ana",
        role: "user",
      },
    });
  });

  it("returns moderator with valid JWT cookie", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      {
        sub: "moderator-1",
        email: "moderator@example.com",
        name: "Moderação",
        role: "moderator",
      },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [`artificio_session=${token}`])
      .expect(200);

    expect(response.body.user.role).toBe("moderator");
  });
});

function fakeAuthDb(row: {
  avatar: string | null;
  email: string;
  id: string;
  name: string;
  role: "user" | "moderator" | "admin";
  role_version: number;
} | undefined) {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          executeTakeFirst: async () => row,
        }),
      }),
    }),
  } as never;
}

function refreshToken(role: "user" | "moderator" | "admin") {
  return jwt.sign(
    {
      sub: "user-1",
      email: "old@example.com",
      name: "Nome antigo",
      role,
      typ: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    { algorithm: "HS256", expiresIn: "7d" },
  );
}

/**
 * Rotas de conta restauradas em 2026-07-31: existiam até `a7d9d20`
 * (2026-06-29), que reverteu `app.ts` a um ponto anterior e as levou junto,
 * deixando `users.avatar_source` órfã em produção.
 */
describe("/api/account/avatar", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  // Tipo declarado que nem é imagem: barrado pelo `fileFilter` do multer, que
  // então não popula `req.file` — o handler responde `invalid_avatar`.
  it("recusa arquivo cujo tipo declarado não é de imagem", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .attach("file", Buffer.from("foo"), { filename: "a.txt", contentType: "text/plain" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "invalid_avatar" });
  });

  // Tipo declarado legítimo com corpo que não é PNG. Passa pelo `fileFilter` (o
  // `mimetype` do multipart é escolhido por quem envia) e só cai na checagem de
  // magic bytes — sem ela, o Cloudinary receberia lixo com nome de imagem.
  it("recusa mime de imagem com conteúdo que não bate com os magic bytes", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .attach("file", Buffer.from("nao sou png"), { filename: "a.png", contentType: "image/png" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "invalid_avatar" });
  });

  // Acima do teto de 2 MB: o multer aborta com `LIMIT_FILE_SIZE`, que precisa
  // virar 400 com código próprio. Sem o wrapper, subiria como 500 e o usuário
  // leria "erro interno" para uma foto grande demais.
  it("recusa arquivo acima do limite com código próprio", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(3 * 1024 * 1024, 7),
    ]);

    const response = await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .attach("file", png, { filename: "grande.png", contentType: "image/png" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "avatar_too_large" });
  });

  it("exige sessão", async () => {
    const app = createApp(env, null as never);

    const response = await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .attach("file", Buffer.from("foo"), { filename: "a.txt", contentType: "text/plain" });

    expect(response.status).toBe(401);
  });

  // Caminho de ACEITE do validador: só provar rejeição não distingue "o
  // validador funciona" de "o validador recusa tudo". Aqui o PNG é válido
  // (assinatura real), passa por `decodeAvatarUpload` e para no 503 de
  // infraestrutura — o que prova que a imagem foi aceita.
  it("aceita PNG válido e para no 503 quando o Cloudinary não está configurado", async () => {
    const cloudinaryVars = [
      "CLOUDINARY_URL",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ] as const;
    const saved = new Map(cloudinaryVars.map((key) => [key, process.env[key]]));
    for (const key of cloudinaryVars) delete process.env[key];

    try {
      const app = createApp(env, null as never);
      const token = jwt.sign(
        { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
        env.JWT_SECRET,
        { algorithm: "HS256", expiresIn: "15m" },
      );
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(64, 7),
      ]);

      const response = await request(app)
        .patch("/api/account/avatar")
        .set("Origin", "https://accounts.artificiorpg.com")
        .set("Cookie", [`artificio_session=${token}`])
        .attach("file", png, { filename: "ok.png", contentType: "image/png" });

      // 503, e não 400: o PNG foi aceito pelo validador e parou na
      // indisponibilidade de infraestrutura. É isso que prova o caminho feliz.
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ error: "media_storage_unavailable" });
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  // Arquivo bem acima dos 100 KB do `express.json()` padrão, mas dentro dos
  // 2 MB da rota. Na versão anterior (data URL em JSON) isto exigia alargar o
  // parser só aqui, senão voltava 413 antes de qualquer validação. Com
  // multipart o corpo nem passa pelo parser JSON, então o arquivo chega inteiro
  // ao validador e é recusado pelo CONTEÚDO — 400, não 413.
  it("arquivo grande chega ao validador sem esbarrar no limite do JSON", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );
    const wellAboveJsonDefault = Buffer.alloc(400 * 1024, 9);

    const response = await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .attach("file", wellAboveJsonDefault, { filename: "grande.png", contentType: "image/png" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "invalid_avatar" });
  });
});

describe("DELETE /api/account", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  // Exclusão encerra o acesso a TODOS os projetos. O e-mail digitado tem de
  // bater com o da sessão — não basta estar autenticado.
  it("recusa exclusão quando o e-mail de confirmação não bate", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app)
      .delete("/api/account")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .send({ confirm: "errado@example.com" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "confirmation_required" });
  });

  it("exige sessão", async () => {
    const app = createApp(env, null as never);

    const response = await request(app)
      .delete("/api/account")
      .set("Origin", "https://accounts.artificiorpg.com")
      .send({ confirm: "ana@example.com" });

    expect(response.status).toBe(401);
  });

  // Caminho de ACEITE: e-mail confere, a conta é apagada e a sessão é limpa.
  // Sem este caso, a comparação de confirmação poderia estar recusando tudo e os
  // testes de rejeição seguiriam verdes.
  it("exclui a conta e limpa os cookies quando o e-mail confere", async () => {
    let deleted = false;
    const db = {
      deleteFrom: () => ({
        where: () => ({
          executeTakeFirst: async () => {
            deleted = true;
            return { numDeletedRows: 1n };
          },
        }),
      }),
    } as never;
    const app = createApp(env, db);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app)
      .delete("/api/account")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .send({ confirm: "ana@example.com" });

    expect(response.status).toBe(204);
    expect(deleted).toBe(true);
    // Cookie zerado com `Expires` no passado: sem isto o navegador seguiria
    // mandando a sessão de uma conta que já não existe.
    const cookies = response.headers["set-cookie"] as unknown as string[] | undefined;
    expect(cookies?.some((cookie) => cookie.startsWith("artificio_session=;"))).toBe(true);
  });

  // O Cloudinary exige o public_id COM a pasta. Com o basename ele responde
  // `not found`, e `destroyAssetResult` conta `not found` como sucesso (contrato
  // REV-019, para a exclusão ser idempotente) — então a limpeza "passaria" e a
  // foto de quem pediu exclusão continuaria pública, sem nenhum log de erro
  // (achado de review, PR #235).
  it("remove o avatar usando o caminho completo do asset, não o basename", async () => {
    const saved = {
      cloud: process.env.CLOUDINARY_CLOUD_NAME,
      key: process.env.CLOUDINARY_API_KEY,
      secret: process.env.CLOUDINARY_API_SECRET,
    };
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    destroyedAssets.length = 0;

    try {
      const db = {
        deleteFrom: () => ({
          where: () => ({ executeTakeFirst: async () => ({ numDeletedRows: 1n }) }),
        }),
      } as never;
      const app = createApp(env, db);
      const token = jwt.sign(
        { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
        env.JWT_SECRET,
        { algorithm: "HS256", expiresIn: "15m" },
      );

      const response = await request(app)
        .delete("/api/account")
        .set("Origin", "https://accounts.artificiorpg.com")
        .set("Cookie", [`artificio_session=${token}`])
        .send({ confirm: "ana@example.com" });

      expect(response.status).toBe(204);
      expect(destroyedAssets).toEqual(["artificio/accounts/avatars/avatar-user-1"]);
    } finally {
      if (saved.cloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
      else process.env.CLOUDINARY_CLOUD_NAME = saved.cloud;
      if (saved.key === undefined) delete process.env.CLOUDINARY_API_KEY;
      else process.env.CLOUDINARY_API_KEY = saved.key;
      if (saved.secret === undefined) delete process.env.CLOUDINARY_API_SECRET;
      else process.env.CLOUDINARY_API_SECRET = saved.secret;
    }
  });

  // Excluir a conta é direito do titular e não pode ficar refém de terceiro:
  // `destroyAssetResult` não tem timeout próprio, então um Cloudinary travado
  // penduraria o `await` e o usuário não conseguiria excluir a conta justamente
  // durante a falha do provedor (achado de review, PR #235). Com prazo, a
  // exclusão local segue e o asset vira órfão registrado no log.
  it("conclui a exclusão mesmo com o Cloudinary pendurado", async () => {
    const saved = {
      cloud: process.env.CLOUDINARY_CLOUD_NAME,
      key: process.env.CLOUDINARY_API_KEY,
      secret: process.env.CLOUDINARY_API_SECRET,
    };
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    mediaState.hangDestroy = true;
    const savedTimeout = process.env.ACCOUNTS_AVATAR_DELETE_TIMEOUT_MS;
    // Prazo curto: o teste prova que o estouro NÃO trava a exclusão, não que o
    // valor de produção seja 5s.
    process.env.ACCOUNTS_AVATAR_DELETE_TIMEOUT_MS = "50";

    try {
      let deleted = false;
      const db = {
        deleteFrom: () => ({
          where: () => ({
            executeTakeFirst: async () => {
              deleted = true;
              return { numDeletedRows: 1n };
            },
          }),
        }),
      } as never;
      const app = createApp(env, db);
      const token = jwt.sign(
        { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", role_version: 1 },
        env.JWT_SECRET,
        { algorithm: "HS256", expiresIn: "15m" },
      );

      // Sem o timeout esta requisição nunca responderia — o teste estouraria
      // por tempo em vez de passar.
      const response = await request(app)
        .delete("/api/account")
        .set("Origin", "https://accounts.artificiorpg.com")
        .set("Cookie", [`artificio_session=${token}`])
        .send({ confirm: "ana@example.com" });

      expect(response.status).toBe(204);
      expect(deleted).toBe(true);
    } finally {
      if (savedTimeout === undefined) delete process.env.ACCOUNTS_AVATAR_DELETE_TIMEOUT_MS;
      else process.env.ACCOUNTS_AVATAR_DELETE_TIMEOUT_MS = savedTimeout;
      mediaState.hangDestroy = false;
      if (saved.cloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
      else process.env.CLOUDINARY_CLOUD_NAME = saved.cloud;
      if (saved.key === undefined) delete process.env.CLOUDINARY_API_KEY;
      else process.env.CLOUDINARY_API_KEY = saved.key;
      if (saved.secret === undefined) delete process.env.CLOUDINARY_API_SECRET;
      else process.env.CLOUDINARY_API_SECRET = saved.secret;
    }
  });
});

describe("/api/auth/refresh", () => {
  it("promotes an active session from the database", async () => {
    const app = createApp(env, fakeAuthDb({
      id: "user-1",
      email: "user@example.com",
      name: "Pessoa",
      avatar: null,
      role: "moderator",
      role_version: 2,
    }));

    const response = await request(app)
      .get("/api/auth/refresh")
      .set("Cookie", [`artificio_refresh=${refreshToken("user")}`])
      .expect(200);

    expect(response.body.user).toMatchObject({ role: "moderator", roleVersion: 2 });
  });

  it("revokes an active moderator session from the database", async () => {
    const app = createApp(env, fakeAuthDb({
      id: "user-1",
      email: "user@example.com",
      name: "Pessoa",
      avatar: null,
      role: "user",
      role_version: 3,
    }));

    const response = await request(app)
      .get("/api/auth/refresh")
      .set("Cookie", [`artificio_refresh=${refreshToken("moderator")}`])
      .expect(200);

    expect(response.body.user).toMatchObject({ role: "user", roleVersion: 3 });
  });

  it("invalidates a session whose account no longer exists", async () => {
    const app = createApp(env, fakeAuthDb(undefined));

    await request(app)
      .get("/api/auth/refresh")
      .set("Cookie", [`artificio_refresh=${refreshToken("user")}`])
      .expect(401);
  });
});

describe("return URL allowlist", () => {
  it("allows HTTPS subdomains under artificiorpg.com", () => {
    expect(
      sanitizeReturnUrl("https://mesas.artificiorpg.com/campanhas", env),
    ).toBe("https://mesas.artificiorpg.com/campanhas");
  });

  it("allows HTTPS apex domain for the future portal", () => {
    expect(sanitizeReturnUrl("https://artificiorpg.com/blog/", env)).toBe(
      "https://artificiorpg.com/blog/",
    );
  });

  it("blocks external hosts", () => {
    expect(sanitizeReturnUrl("https://evil.com", env)).toBe(env.PUBLIC_URL);
  });

  it("blocks lookalike domains", () => {
    expect(sanitizeReturnUrl("https://evilartificiorpg.com", env)).toBe(
      env.PUBLIC_URL,
    );
  });

  it("stores only sanitized return URL in Google state", async () => {
    const app = createApp(env, null as never);

    const response = await request(app)
      .get("/api/auth/google")
      .query({ return: "https://evil.com" })
      .expect(302);
    const location = response.headers.location as string;
    const state = new URL(location).searchParams.get("state");

    expect(state).not.toBeNull();
    const body = JSON.parse(
      Buffer.from(state ?? "", "base64url").toString("utf8"),
    ) as { returnUrl: string };
    expect(body.returnUrl).toBe(env.PUBLIC_URL);
  });

  it("preserves beta origin return URL in Google state", async () => {
    const app = createApp(env, null as never);
    const betaReturn = "https://beta.artificiorpg.com/admin/";

    const response = await request(app)
      .get("/api/auth/google")
      .query({ return: betaReturn })
      .expect(302);
    const location = response.headers.location as string;
    const state = new URL(location).searchParams.get("state");

    expect(state).not.toBeNull();
    const body = JSON.parse(
      Buffer.from(state ?? "", "base64url").toString("utf8"),
    ) as { returnUrl: string };
    expect(body.returnUrl).toBe(betaReturn);
  });
});

import type { Request } from 'express';

// Spec 087 (achado de review PR #214, Codex P2) — o hash da origem da view era
// SHA-256 com sal publico (a data), sobre IPv4 + user-agent. Espaco pequeno o
// bastante pra enumerar offline, entao nao anonimizava de fato. Virou HMAC com
// segredo do servidor.

vi.mock('../db', () => ({ db: {} }));

import { viewOriginHash } from './materialMetrics';

function fakeRequest(ip: string, userAgent = 'Mozilla/5.0'): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
    get: (header: string) => (header.toLowerCase() === 'user-agent' ? userAgent : undefined),
  } as unknown as Request;
}

describe('viewOriginHash', () => {
  const originalSecret = process.env.VIEW_HASH_SECRET;

  beforeEach(() => {
    process.env.VIEW_HASH_SECRET = 'segredo-de-teste';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.VIEW_HASH_SECRET;
    else process.env.VIEW_HASH_SECRET = originalSecret;
  });

  it('é estável para a mesma origem no mesmo dia (a dedup depende disso)', () => {
    const first = viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-26');
    const second = viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-26');
    expect(first).toBe(second);
  });

  it('muda de um dia para o outro, então a dedup não vaza entre dias', () => {
    const day1 = viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-26');
    const day2 = viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-27');
    expect(day1).not.toBe(day2);
  });

  it('separa origens diferentes no mesmo dia', () => {
    const a = viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-26');
    const b = viewOriginHash(fakeRequest('203.0.113.11'), '2026-07-26');
    expect(a).not.toBe(b);
  });

  // O ponto do achado: sem o segredo, quem tem a tabela reproduz o hash e
  // recupera o IP por forca bruta. Com HMAC, segredo diferente = hash diferente.
  it('depende do segredo — sem ele o digest não é reproduzível', () => {
    const withSecret = viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-26');

    process.env.VIEW_HASH_SECRET = 'outro-segredo';
    const withOtherSecret = viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-26');

    expect(withSecret).not.toBe(withOtherSecret);
  });

  // Sem segredo, falhar alto: cair num default fixo reintroduziria em silencio
  // a reversibilidade que o HMAC existe pra impedir.
  it('recusa gerar hash quando o segredo não está configurado', () => {
    delete process.env.VIEW_HASH_SECRET;
    expect(() => viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-26')).toThrow(/VIEW_HASH_SECRET/);
  });

  it('nunca devolve o IP em claro', () => {
    const hash = viewOriginHash(fakeRequest('203.0.113.10'), '2026-07-26');
    expect(hash).not.toContain('203.0.113.10');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

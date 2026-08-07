import { describe, expect, it } from 'vitest';
import {
  CURSOR_TTL_MS,
  issueTreeCursor,
  verifyTreeCursor,
  type CommentSort,
} from './treeCursor.js';

const SECRET = 'segredo-de-cursor-com-mais-de-32-caracteres';
const OTHER_SECRET = 'outro-segredo-de-cursor-com-32-ou-mais-chars';

const NOW = 1_754_500_000_000;

const BRANCH = '11111111-1111-4111-8111-111111111111';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    subject_type: 'material',
    subject_id: 'mat-42',
    sort: 'best' as CommentSort,
    snapshot_revision: 42,
    branch_id: BRANCH,
    after: '0.5|2026-08-07T00:00:00.000Z',
    limit: 100,
    ...overrides,
  };
}

const expected = {
  subject_type: 'material',
  subject_id: 'mat-42',
  sort: 'best' as CommentSort,
};

describe('issueTreeCursor / verifyTreeCursor', () => {
  it('ida e volta preserva a posicao fixada', () => {
    const cursor = issueTreeCursor(payload(), SECRET, NOW);
    const result = verifyTreeCursor(cursor, SECRET, expected, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.snapshot_revision).toBe(42);
    expect(result.payload.branch_id).toBe(BRANCH);
    expect(result.payload.after).toBe('0.5|2026-08-07T00:00:00.000Z');
    expect(result.payload.limit).toBe(100);
  });

  it('continuacao de raiz aceita branch_id nulo', () => {
    const cursor = issueTreeCursor(payload({ branch_id: null }), SECRET, NOW);
    const result = verifyTreeCursor(cursor, SECRET, expected, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.branch_id).toBeNull();
  });

  // T2.3 · feito quando: "cursor expirado falha explicitamente em vez de
  // devolver posicao errada". Relogio injetado — sem depender do tempo real.
  it('recusa cursor expirado', () => {
    const cursor = issueTreeCursor(payload(), SECRET, NOW);

    const atExpiry = verifyTreeCursor(cursor, SECRET, expected, NOW + CURSOR_TTL_MS);
    expect(atExpiry).toEqual({ ok: false, reason: 'expired' });

    const after = verifyTreeCursor(cursor, SECRET, expected, NOW + CURSOR_TTL_MS + 1);
    expect(after).toEqual({ ok: false, reason: 'expired' });
  });

  it('aceita ate o ultimo milissegundo antes de expirar', () => {
    const cursor = issueTreeCursor(payload(), SECRET, NOW);
    const result = verifyTreeCursor(cursor, SECRET, expected, NOW + CURSOR_TTL_MS - 1);

    expect(result.ok).toBe(true);
  });

  // A razao de ser da assinatura: sem ela, trocar a revisao no corpo daria
  // leitura de outra revisao com posicao "valida".
  it('recusa corpo adulterado', () => {
    const cursor = issueTreeCursor(payload(), SECRET, NOW);
    const [body, signature] = cursor.split('.');

    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    decoded.snapshot_revision = 99;
    const forged = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');

    const result = verifyTreeCursor(`${forged}.${signature}`, SECRET, expected, NOW);
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('recusa cursor assinado com outro segredo', () => {
    const cursor = issueTreeCursor(payload(), OTHER_SECRET, NOW);
    const result = verifyTreeCursor(cursor, SECRET, expected, NOW);

    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  // `contrato-http-v1.md` §2: "cursor de outra consulta → 400/invalid_cursor".
  it('recusa cursor de outro assunto', () => {
    const cursor = issueTreeCursor(payload({ subject_id: 'mat-99' }), SECRET, NOW);
    const result = verifyTreeCursor(cursor, SECRET, expected, NOW);

    expect(result).toEqual({ ok: false, reason: 'other_query' });
  });

  it('recusa cursor de outro subject_type', () => {
    const cursor = issueTreeCursor(payload({ subject_type: 'post' }), SECRET, NOW);
    const result = verifyTreeCursor(cursor, SECRET, expected, NOW);

    expect(result).toEqual({ ok: false, reason: 'other_query' });
  });

  // Trocar o sort reordena os irmaos: a sort-key congelada perde o sentido.
  it('recusa cursor de outra ordenacao', () => {
    const cursor = issueTreeCursor(payload({ sort: 'new' }), SECRET, NOW);
    const result = verifyTreeCursor(cursor, SECRET, expected, NOW);

    expect(result).toEqual({ ok: false, reason: 'other_query' });
  });

  it.each([
    ['vazio', ''],
    ['sem separador', 'somentecorpo'],
    ['sem assinatura', 'corpo.'],
    ['sem corpo', '.assinatura'],
    ['lixo', 'a.b.c'],
  ])('recusa cursor malformado: %s', (_label, cursor) => {
    const result = verifyTreeCursor(cursor, SECRET, expected, NOW);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(['malformed', 'bad_signature']).toContain(result.reason);
  });

  // Assinatura verificada ANTES da expiracao: um `exp` forjado nao pode
  // decidir o fluxo, entao o motivo aqui e adulteracao, nao vencimento.
  it('corpo forjado com exp futuro ainda recusa por assinatura', () => {
    const forged = Buffer.from(
      JSON.stringify({ ...payload(), v: 1, exp: NOW + 10 * CURSOR_TTL_MS }),
      'utf8',
    ).toString('base64url');

    const result = verifyTreeCursor(`${forged}.assinaturainventada`, SECRET, expected, NOW);
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('exige segredo de ao menos 32 caracteres', () => {
    expect(() => issueTreeCursor(payload(), 'curto-demais', NOW)).toThrow(/32 caracteres/);
    expect(() => verifyTreeCursor('a.b', 'curto-demais', expected, NOW)).toThrow(/32 caracteres/);
  });
});
